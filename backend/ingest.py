import os
import requests
from datetime import datetime
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup
from langchain_community.document_loaders import PyPDFLoader, Docx2txtLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma
from langchain_core.documents import Document

CHROMA_PATH = os.path.join(os.path.dirname(__file__), "chroma_db")

print("Loading embedding model...")
EMBEDDINGS = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
print("Embedding model ready.")

def get_vectorstore():
    return Chroma(persist_directory=CHROMA_PATH, embedding_function=EMBEDDINGS)

def load_file(file_path: str):
    if file_path.endswith(".pdf"):
        return PyPDFLoader(file_path).load()
    elif file_path.endswith(".docx"):
        return Docx2txtLoader(file_path).load()
    elif file_path.endswith(".txt"):
        return TextLoader(file_path, encoding="utf-8").load()
    else:
        raise ValueError(f"Unsupported file type: {file_path}")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

def _extract_text_from_html(html: str, url: str) -> str:
    soup = BeautifulSoup(html, "html.parser")

    # remove noise tags
    for tag in soup(["script", "style", "nav", "footer", "header",
                     "noscript", "iframe", "svg", "form", "button",
                     "meta", "link", "aside"]):
        tag.decompose()

    # try to find main content area first
    main = (soup.find("main") or soup.find("article") or
            soup.find(id="content") or soup.find(class_="content") or
            soup.find(class_="main-content") or soup.body)

    if not main:
        return ""

    # get text with spacing
    lines = []
    for element in main.find_all(["h1", "h2", "h3", "h4", "p", "li", "td", "th", "span", "div"]):
        text = element.get_text(separator=" ", strip=True)
        # skip very short fragments and duplicates
        if len(text) > 30 and text not in lines:
            lines.append(text)

    return "\n".join(lines)

def _scrape_page(url: str) -> str:
    try:
        resp = requests.get(url, headers=HEADERS, timeout=12)
        if resp.status_code != 200:
            return ""
        return _extract_text_from_html(resp.text, url)
    except Exception:
        return ""

def _find_subpage_links(html: str, base_url: str) -> list[str]:
    soup = BeautifulSoup(html, "html.parser")
    base_domain = urlparse(base_url).netloc
    links = set()

    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        full_url = urljoin(base_url, href)
        parsed = urlparse(full_url)

        if (parsed.netloc == base_domain and
                not parsed.fragment and
                not parsed.query and
                not parsed.path.endswith((".pdf", ".jpg", ".png", ".zip")) and
                full_url != base_url):
            links.add(full_url.rstrip("/"))

    return list(links)[:20]


def load_url(url: str) -> list[Document]:
    parsed = urlparse(url)
    is_root = parsed.path in ("", "/")

    docs = []
    scraped_urls = set()

    def scrape_and_add(page_url: str):
        if page_url in scraped_urls:
            return
        scraped_urls.add(page_url)
        text = _scrape_page(page_url)
        if len(text) > 150:
            docs.append(Document(
                page_content=text,
                metadata={"source": url, "page_url": page_url}
            ))

    scrape_and_add(url)

    if is_root:
        base = f"{parsed.scheme}://{parsed.netloc}"
        for path in ["about-us", "about", "services", "team", "contact"]:
            scrape_and_add(f"{base}/{path}/")

        try:
            resp = requests.get(url, headers=HEADERS, timeout=10)
            if resp.status_code == 200:
                links = _find_subpage_links(resp.text, url)
                for link in links[:5]:
                    scrape_and_add(link)
        except Exception:
            pass

    if not docs:
        raise ValueError(
            "No readable content found at this URL. "
            "The website likely uses JavaScript to render content (React/Angular/Vue SPA). "
            "Solution: copy the page content into a .txt file and upload it via the file upload instead."
        )

    print(f"Scraped {len(docs)} pages from {url}")
    return docs


def _chunk_and_store(docs: list[Document], source_name: str) -> int:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=100,
        separators=["\n\n", "\n", ".", " "]
    )
    chunks = splitter.split_documents(docs)

    if not chunks:
        raise ValueError("No text could be extracted.")

    existing = get_ingested_documents()
    current_version = next(
        (d["version"] for d in existing if d["source"] == source_name), 0
    )
    new_version = current_version + 1
    uploaded_at = datetime.now().strftime("%Y-%m-%d %H:%M")

    for i, chunk in enumerate(chunks):
        chunk.metadata["source"] = source_name
        chunk.metadata["version"] = new_version
        chunk.metadata["uploaded_at"] = uploaded_at
        chunk.metadata["chunk_index"] = i

    db = get_vectorstore()
    db.add_documents(chunks)
    return len(chunks)


def ingest_document(file_path: str) -> int:
    docs = load_file(file_path)
    source_name = os.path.basename(file_path)
    return _chunk_and_store(docs, source_name)


def ingest_url(url: str) -> int:
    docs = load_url(url)
    return _chunk_and_store(docs, url)


def get_ingested_documents() -> list[dict]:
    db = get_vectorstore()
    result = db.get(include=["metadatas"])

    # group by source, keep latest metadata per source
    seen: dict[str, dict] = {}
    chunk_counts: dict[str, int] = {}

    for meta in result["metadatas"]:
        if not meta or not meta.get("source"):
            continue
        src = meta["source"]
        chunk_counts[src] = chunk_counts.get(src, 0) + 1
        # keep the entry with the highest version
        if src not in seen or meta.get("version", 1) >= seen[src].get("version", 1):
            seen[src] = meta

    docs = []
    for src, meta in seen.items():
        docs.append({
            "source": src,
            "version": meta.get("version", 1),
            "uploaded_at": meta.get("uploaded_at", "Unknown"),
            "chunks": chunk_counts.get(src, 0),
            "type": "url" if src.startswith("http") else "file"
        })

    return sorted(docs, key=lambda x: x["source"])


def delete_document(source_name: str):
    db = get_vectorstore()
    # get IDs of all chunks belonging to this source
    result = db.get(include=["metadatas"])
    ids_to_delete = [
        result["ids"][i]
        for i, meta in enumerate(result["metadatas"])
        if meta and meta.get("source") == source_name
    ]
    if ids_to_delete:
        db.delete(ids=ids_to_delete)
    return len(ids_to_delete)
