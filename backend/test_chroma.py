import os
from dotenv import load_dotenv
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import Chroma

load_dotenv()

# Create the embedding model
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")

# Sample "documents" — imagine these are HR doc chunks
docs = [
    "Employees get 12 days of paid annual leave per year.",
    "Reimbursement claims must be submitted within 30 days.",
    "The IT helpdesk is available Monday to Friday 9am-6pm.",
    "New employees must complete onboarding in their first week.",
]

# Store them in ChromaDB (creates a chroma_db/ folder)
db = Chroma.from_texts(
    texts=docs,
    embedding=embeddings,
    persist_directory="./chroma_db"
)

# Now search with a question that uses DIFFERENT words
query = "How many vacation days do I have?"
results = db.similarity_search(query, k=2)

print("Query:", query)
print("\nTop 2 most relevant chunks:")
for r in results:
    print(" →", r.page_content)