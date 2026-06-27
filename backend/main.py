import os
import json
import shutil
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from ingest import ingest_document, ingest_url, get_ingested_documents, delete_document, get_vectorstore
from retriever import ask_question

load_dotenv()

app = FastAPI(title="Lumora API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DOCS_DIR = os.path.join(os.path.dirname(__file__), "..", "docs")
os.makedirs(DOCS_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt"}

class AskRequest(BaseModel):
    question: str

class AskResponse(BaseModel):
    answer: str
    sources: list[str]

class UrlRequest(BaseModel):
    url: str

class RelatedRequest(BaseModel):
    questions: list[str]

class FeedbackRequest(BaseModel):
    question: str
    answer: str
    sources: list[str]
    feedback: str
    timestamp: str

FEEDBACK_FILE = os.path.join(os.path.dirname(__file__), "data", "feedback_log.json")

@app.get("/")
def root():
    return {"status": "running", "assistant": "Lumora"}

@app.post("/ingest")
async def ingest_file(file: UploadFile = File(...)):
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"'{ext}' not supported. Use PDF, DOCX, or TXT.")

    save_path = os.path.join(DOCS_DIR, file.filename)
    with open(save_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    try:
        chunks = ingest_document(save_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {"message": f"'{file.filename}' ingested successfully.", "chunks": chunks}

@app.post("/ingest-url")
def ingest_from_url(body: UrlRequest):
    if not body.url.startswith("http"):
        raise HTTPException(status_code=400, detail="Please provide a valid URL starting with http/https.")

    try:
        chunks = ingest_url(body.url)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {"message": f"URL ingested successfully.", "source": body.url, "chunks": chunks}

@app.post("/ask", response_model=AskResponse)
def ask(body: AskRequest):
    if not body.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    try:
        result = ask_question(body.question)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return AskResponse(answer=result["answer"], sources=result["sources"])


@app.post("/related")
def get_related(body: RelatedRequest):
    db = get_vectorstore()
    valid = []

    for q in body.questions:
        # similarity_search_with_score returns L2 distance — lower = better match
        # scores tested against this KB: good matches < 0.80, weak > 0.80, no match > 1.0
        results = db.similarity_search_with_score(q, k=1)
        if results:
            _, score = results[0]
            if score < 0.80:
                valid.append(q)

    return {"questions": valid}


@app.post("/feedback")
def submit_feedback(body: FeedbackRequest):
    os.makedirs(os.path.dirname(FEEDBACK_FILE), exist_ok=True)

    # normalize feedback value regardless of what frontend sends
    raw = body.feedback.lower().strip()
    if raw in ("up", "thumbs_up", "positive"):
        normalized = "positive"
    elif raw in ("down", "thumbs_down", "negative"):
        normalized = "negative"
    else:
        normalized = raw  # unknown value — store as-is

    if os.path.exists(FEEDBACK_FILE):
        with open(FEEDBACK_FILE, "r", encoding="utf-8") as f:
            entries = json.load(f)
    else:
        entries = []

    entry = body.model_dump()
    entry["feedback"] = normalized
    entries.append(entry)

    with open(FEEDBACK_FILE, "w", encoding="utf-8") as f:
        json.dump(entries, f, indent=2, ensure_ascii=False)

    return {"status": "saved"}


@app.get("/feedback")
def get_feedback():
    if not os.path.exists(FEEDBACK_FILE):
        return {"feedback": []}
    with open(FEEDBACK_FILE, "r", encoding="utf-8") as f:
        entries = json.load(f)
    return {"feedback": entries}


@app.get("/documents")
def list_documents():
    try:
        docs = get_ingested_documents()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"documents": docs}


@app.delete("/documents/{source_name:path}")
def remove_document(source_name: str):
    try:
        deleted = delete_document(source_name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    if deleted == 0:
        raise HTTPException(status_code=404, detail=f"'{source_name}' not found in knowledge base.")

    # also remove the local file if it exists
    file_path = os.path.join(DOCS_DIR, source_name)
    if os.path.exists(file_path):
        os.remove(file_path)

    return {"message": f"'{source_name}' removed successfully.", "chunks_deleted": deleted}
