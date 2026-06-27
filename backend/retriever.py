import os
import re
from dotenv import load_dotenv
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage, AIMessage
from ingest import get_vectorstore

load_dotenv()

GREETING_STARTS = ["hi", "hello", "hey", "helo", "sup", "yo", "howdy",
                   "good morning", "good afternoon", "good evening", "greetings"]

THANKS_WORDS = ["thank", "thanks", "thx", "ty", "cheers", "appreciate"]

GOODBYE_WORDS = ["bye", "goodbye", "see you", "see ya", "later", "cya",
                 "good night", "goodnight", "take care"]

ACKNOWLEDGEMENTS = ["ok", "okay", "alright", "got it",
                    "noted", "understood", "sure", "cool", "great", "nice", "perfect",
                    "sounds good", "makes sense"]

FOLLOWUP_PHRASES = [
    "explain", "explain me", "explain in brief", "explain me in brief",
    "tell me more", "more details", "elaborate", "in brief", "brief",
    "summarize", "summary", "what does it say", "more info", "details"
]

# keywords that identify leave-related questions — used for k=4 retrieval
LEAVE_KEYWORDS = [
    "leave", "earned leave", "sick leave", "casual leave",
    "vacation", "holiday", "time off", "leave request", "leave application",
]

# chunks containing these phrases are deprioritized for general leave questions
# (only relevant when user explicitly asks about emergency/special leave)
SECONDARY_LEAVE_TERMS = [
    "emergency leave", "urgent leave", "medical leave",
    "maternity leave", "bereavement leave", "special leave",
    "exceptional leave",
]


def is_leave_question(text: str) -> bool:
    t = text.lower()
    return any(kw in t for kw in LEAVE_KEYWORDS)


def is_explicit_special_leave(text: str) -> bool:
    t = text.lower()
    return any(term in t for term in SECONDARY_LEAVE_TERMS)


def rerank_leave_docs(docs: list, question: str) -> list:
    """
    For general leave questions (not explicitly emergency/special),
    push chunks about planned/earned leave to the front.
    Chunks about emergency/special leave go to the back.
    Order within each group is preserved (similarity score order).
    """
    if is_explicit_special_leave(question):
        return docs  # user asked about special leave — don't reorder

    primary = []
    secondary = []
    for doc in docs:
        content = doc.page_content.lower()
        is_secondary = any(term in content for term in SECONDARY_LEAVE_TERMS)
        if is_secondary:
            secondary.append(doc)
        else:
            primary.append(doc)

    return primary + secondary


LLM = ChatGroq(
    model="llama-3.3-70b-versatile",
    temperature=0,
    api_key=os.getenv("GROQ_API_KEY")
)

# main prompt for document-based answers
PROMPT = ChatPromptTemplate.from_messages([
    ("system", """You are Lumora, an intelligent knowledge assistant built for Space-O Technologies.
You help employees find answers from company documents quickly and clearly.

STRICT RULES — follow these exactly:
1. Answer ONLY using information present in the context below. Do not add anything from outside.
2. If the context does not contain the answer, say exactly: "I couldn't find specific information about that in the knowledge base." Then stop. Do not guess or make up details.
3. Never say "I would recommend checking" or "contact HR" — just give the answer.
4. Keep answers concise and clear. Do not repeat yourself.
5. If explaining a policy, cover all points from the context — but only the context.
6. Use a dash (-) for lists. No markdown bold, italic, or headers.
7. Use conversation history to understand follow-up questions.
8. When answering leave-related questions, prioritize Earned Leave and Planned Leave information before emergency, urgent, medical, maternity, bereavement, or special leave types — unless the user explicitly mentions one of those leave categories.
9. For process questions, explain the standard workflow first and exceptions second.
10. When answering questions about leave application or leave procedures, recognize that these phrases all mean the same thing: "process to apply for leave", "how do I apply for leave", "leave application process", "steps to take leave", "how to request leave". Search the context thoroughly for any of these phrasings before concluding no information is found.

Context from knowledge base:
{context}"""),
    MessagesPlaceholder(variable_name="history"),
    ("human", "{question}"),
])

# prompt for out-of-scope questions — generates a natural, varied response
OUT_OF_SCOPE_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """You are Lumora, a knowledge assistant for Space-O Technologies.
A user asked you something that is completely outside your scope (not related to company documents, policies, or work).
Politely decline in a natural, friendly way. Keep it to 1-2 sentences. Vary your response — don't always say the same thing.
Suggest they ask about work-related topics instead."""),
    ("human", "{question}"),
])

chat_history: list = []


def normalize(text: str) -> str:
    # collapse repeated chars: "okayyy" → "okay", "okkkk" → "ok", "hiiii" → "hi"
    return re.sub(r'(.)\1+', r'\1', text.strip().lower().rstrip("!.,? "))


def is_greeting(text: str) -> bool:
    t = normalize(text)
    if t in GREETING_STARTS:
        return True
    for g in GREETING_STARTS:
        if len(t) <= len(g) + 4:
            matches = sum(1 for c in g if c in t)
            if matches >= len(g) * 0.8 and not any(
                w in t for w in ["policy", "leave", "how", "what", "when", "why", "can", "do", "is"]
            ):
                return True
    return False


def is_thanks(text: str) -> bool:
    return any(w in text.strip().lower() for w in THANKS_WORDS)


def is_goodbye(text: str) -> bool:
    return any(w in text.strip().lower() for w in GOODBYE_WORDS)


def is_acknowledgement(text: str) -> bool:
    return normalize(text) in ACKNOWLEDGEMENTS


def is_out_of_scope(text: str) -> bool:
    # things clearly unrelated to work/company docs
    out_of_scope = [
        "mount everest", "height of", "capital of", "population of",
        "who is the president", "cricket score", "ipl", "football",
        "recipe", "weather", "temperature outside",
        "movie", "song", "music", "netflix", "youtube",
        "stock price", "bitcoin", "crypto", "share market",
        "who invented", "history of", "when was", "geography",
        "religion", "politics", "election",
        "homework", "assignment", "solve this math",
    ]
    t = text.lower()
    return any(phrase in t for phrase in out_of_scope)


def is_short_followup(text: str) -> bool:
    return text.strip().lower().rstrip("!.,?") in FOLLOWUP_PHRASES


def get_last_user_question() -> str:
    for msg in reversed(chat_history):
        if isinstance(msg, HumanMessage):
            return msg.content
    return ""


def clean_answer(text: str) -> str:
    text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)
    text = re.sub(r'\*(.+?)\*', r'\1', text)
    text = re.sub(r'^#{1,6}\s+', '', text, flags=re.MULTILINE)
    text = text.replace('**', '').replace('*', '')
    return text.strip()


def ask_question(question: str) -> dict:

    # --- instant local responses ---

    # acknowledgements run first — "okay" must not fall into greeting check
    if is_acknowledgement(question):
        return {
            "answer": "You're welcome!",
            "sources": []
        }

    if is_greeting(question):
        return {
            "answer": "Hi! I'm Lumora, your Space-O knowledge assistant. Ask me anything — leaves, reimbursements, policies, office hours, and more.",
            "sources": []
        }

    if is_thanks(question):
        return {
            "answer": "You're welcome!",
            "sources": []
        }

    if is_goodbye(question):
        return {
            "answer": "Goodbye! Come back anytime you need help.",
            "sources": []
        }

    # --- out-of-scope: dynamic LLM response, varied each time ---
    if is_out_of_scope(question):
        response = (OUT_OF_SCOPE_PROMPT | LLM).invoke({"question": question})
        return {
            "answer": clean_answer(response.content),
            "sources": []
        }

    # --- build search query (handle short follow-ups) ---
    if is_short_followup(question):
        last = get_last_user_question()
        search_query = f"{last} {question}" if last else question
    else:
        search_query = question

    # normalize leave procedure phrasings so they retrieve the same chunks
    leave_procedure_phrases = [
        "process to apply for leave",
        "leave application process",
        "steps to take leave",
        "steps for leave",
        "procedure for leave",
        "how to request leave",
    ]
    q_lower = search_query.lower()
    if any(phrase in q_lower for phrase in leave_procedure_phrases):
        search_query = "how do I apply for leave leave application"

    # --- retrieve from knowledge base ---
    # broader keyword set — use k=6 for leave, reimbursement, process queries
    broad_keywords = [
        "leave", "apply", "process", "procedure", "reimbursement",
        "claim", "expense", "steps", "request",
    ]
    k = 6 if any(kw in search_query.lower() for kw in broad_keywords) else 3
    vectorstore = get_vectorstore()
    docs = vectorstore.similarity_search(search_query, k=k)

    if not docs:
        return {
            "answer": "I couldn't find anything about that in the knowledge base. Make sure the relevant document has been uploaded via KB Manager.",
            "sources": []
        }

    # for general leave questions, push planned/earned leave chunks first
    if is_leave_question(search_query):
        docs = rerank_leave_docs(docs, question)

    context = "\n\n".join(doc.page_content for doc in docs)

    response = (PROMPT | LLM).invoke({
        "context": context,
        "history": chat_history,
        "question": question
    })

    answer = clean_answer(response.content)

    chat_history.append(HumanMessage(content=question))
    chat_history.append(AIMessage(content=answer))
    if len(chat_history) > 12:
        chat_history.pop(0)
        chat_history.pop(0)

    sources = list({
        doc.metadata.get("source", "")
        for doc in docs
        if doc.metadata.get("source")
    })

    return {"answer": answer, "sources": sources}



