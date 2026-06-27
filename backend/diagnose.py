import os
os.environ["TOKENIZERS_PARALLELISM"] = "false"

from ingest import get_vectorstore

db = get_vectorstore()
result = db.get(include=["metadatas"])
sources = set(m.get("source", "") for m in result["metadatas"] if m)
print(f"KB: {len(result['ids'])} chunks, {len(sources)} sources")
for s in sorted(sources):
    count = sum(1 for m in result["metadatas"] if m and m.get("source") == s)
    print(f"  {count:4d} | {s}")

test_queries = [
    "How do I apply for leave?",
    "What is the process to apply for leave?",
    "How many leave types are available?",
    "What documents are required for maternity leave?",
    "office hours grace period",
    "recruitment equal opportunity",
]

print("\nRETRIEVAL SCORES (top 3 per query):")
for q in test_queries:
    results = db.similarity_search_with_score(q, k=3)
    print(f"\nQ: {q}")
    for doc, score in results:
        snippet = doc.page_content[:70].replace('\n', ' ')
        print(f"  {score:.4f} | {snippet}")
