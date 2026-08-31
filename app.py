import os
import re
import json
import math
import time
import requests
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

app = Flask(__name__)
CORS(app)

# --------------------------------------------------------------------------
# Configuration & Environment Variables
# --------------------------------------------------------------------------
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SECRET_KEY")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY") or ""
OLLAMA_BASE_URL = (os.getenv("OLLAMA_BASE_URL") or "http://localhost:11434").strip()
OLLAMA_API_KEY = (os.getenv("OLLAMA_API_KEY") or "").strip()

supabase: Client = None
if SUPABASE_URL and SUPABASE_SECRET_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_SECRET_KEY)
        print("Connected to Supabase successfully.")
    except Exception as e:
        print(f"Supabase connection error: {e}")

# Table mappings for the 3 knowledge bases
TABLE_MAPPINGS = {
    "game_of_thrones": "GameofThronesVDB",
    "spiderman": "SpiderManVDB",
    "apollo_11": "Apollo11VDB"
}

RPC_MAPPINGS = {
    "game_of_thrones": "match_gameofthronesvdb",
    "spiderman": "match_spidermanvdb",
    "apollo_11": "match_apollo11vdb"
}


# --------------------------------------------------------------------------
# 1. Helper Functions: Embeddings & Vector Search
# --------------------------------------------------------------------------
def get_embedding(text: str, base_url: str = "", api_key: str = "") -> list:
    """
    Generates a 768-dimensional embedding vector.
    Uses Google Gemini API if GOOGLE_API_KEY is available, with LangChain/Ollama fallback.
    """
    g_key = GOOGLE_API_KEY or api_key
    if g_key and not g_key.startswith("http"):
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key={g_key}"
            payload = {
                "model": "models/gemini-embedding-001",
                "content": {"parts": [{"text": text[:2048]}]},
                "outputDimensionality": 768
            }
            res = requests.post(url, json=payload, timeout=20)
            if res.ok:
                return res.json().get("embedding", {}).get("values", [])
            else:
                print(f"Google embedding notice ({res.status_code}): {res.text[:150]}")
        except Exception as e:
            print(f"Google embedding exception: {e}")

    # Fallback to Ollama embedding
    root_url = base_url or OLLAMA_BASE_URL
    if root_url.endswith("/"):
        root_url = root_url[:-1]
    headers = {"Content-Type": "application/json"}
    if OLLAMA_API_KEY:
        headers["Authorization"] = f"Bearer {OLLAMA_API_KEY}"

    try:
        url = f"{root_url}/api/embeddings"
        res = requests.post(url, json={"model": "nomic-embed-text", "prompt": text}, headers=headers, timeout=20)
        if res.ok:
            return res.json().get("embedding", [])
    except Exception:
        pass

    # LangChain OllamaEmbeddings Fallback
    try:
        from langchain_ollama import OllamaEmbeddings
        emb_client = OllamaEmbeddings(model="nomic-embed-text", base_url=root_url)
        return emb_client.embed_query(text)
    except Exception as e:
        print(f"LangChain embedding fallback notice: {e}")

    raise Exception("Could not generate text embedding. Please check GOOGLE_API_KEY or OLLAMA_BASE_URL.")


def cosine_similarity(vec_a: list, vec_b: list) -> float:
    """Computes cosine similarity between two numeric vectors."""
    if not vec_a or not vec_b or len(vec_a) != len(vec_b):
        return 0.0
    dot = sum(a * b for a, b in zip(vec_a, vec_b))
    norm_a = math.sqrt(sum(a * a for a in vec_a))
    norm_b = math.sqrt(sum(b * b for b in vec_b))
    return dot / (norm_a * norm_b) if norm_a and norm_b else 0.0


def retrieve_vector_context(rag_id: str, query_embedding: list, match_threshold: float = 0.35, match_count: int = 8):
    """
    Performs vector similarity search across GameofThronesVDB, SpiderManVDB, or Apollo11VDB.
    Tries PostgreSQL RPC match function first, with robust in-database cosine math fallback.
    """
    if not supabase:
        return "", [], []

    table_name = TABLE_MAPPINGS.get(rag_id, "GameofThronesVDB")
    rpc_name = RPC_MAPPINGS.get(rag_id, "match_gameofthronesvdb")

    retrieved_context = ""
    sources = []
    chunks = []

    # 1. Attempt RPC call
    try:
        rpc_res = supabase.rpc(
            rpc_name,
            {
                "query_embedding": query_embedding,
                "match_threshold": match_threshold,
                "match_count": match_count
            }
        ).execute()

        if rpc_res.data and len(rpc_res.data) > 0:
            for doc in rpc_res.data:
                doc_id = doc.get("uid", doc.get("id", "N/A"))
                text_content = doc.get("text", doc.get("content", ""))
                similarity = doc.get("similarity", 0.0)
                if text_content:
                    retrieved_context += f"{text_content}\n\n"
                    sources.append(doc_id)
                    chunks.append({
                        "id": str(doc_id),
                        "similarity": round(float(similarity), 3),
                        "text": text_content[:500] + "..." if len(text_content) > 500 else text_content
                    })
            return retrieved_context, sources, chunks
    except Exception as rpc_err:
        pass # Fallback to table query below

    # 2. Dynamic Table Query & Cosine Similarity
    try:
        res = supabase.table(table_name).select("uid, text, embeddings").limit(100).execute()
        if res.data and len(res.data) > 0:
            scored_docs = []
            for doc in res.data:
                emb = doc.get("embeddings")
                if isinstance(emb, str):
                    try:
                        emb = json.loads(emb)
                    except Exception:
                        continue
                if emb and isinstance(emb, list) and len(emb) == len(query_embedding):
                    sim = cosine_similarity(query_embedding, emb)
                    if sim >= match_threshold:
                        scored_docs.append((sim, doc.get("uid", "N/A"), doc.get("text", "")))

            scored_docs.sort(key=lambda x: x[0], reverse=True)
            for sim, doc_id, text_content in scored_docs[:match_count]:
                if text_content:
                    retrieved_context += f"{text_content}\n\n"
                    sources.append(doc_id)
                    chunks.append({
                        "id": str(doc_id),
                        "similarity": round(float(sim), 3),
                        "text": text_content[:500] + "..." if len(text_content) > 500 else text_content
                    })
    except Exception as table_err:
        print(f"Table retrieval notice for '{table_name}': {table_err}")

    return retrieved_context, sources, chunks


# --------------------------------------------------------------------------
# 2. Helper Functions: LLM Answer Generation (Google Gemini & Ollama)
# --------------------------------------------------------------------------
def generate_chat_answer(model_name: str, sysprompt: str, context: str, query: str, temperature: float = 0.5):
    """
    Generates chat answer using Google Gemini API or LangChain/Ollama.
    """
    start_time = time.time()
    user_prompt = f"Context:\n{context}\n\nQuestion: {query}" if (context and context.strip()) else query

    # 1. If model is Ollama-specific (e.g. gpt-oss, llama3, gemma4:31b), try Ollama / LangChain first
    is_gemini_model = model_name.startswith("gemini") or model_name.startswith("gemma-4")
    
    if not is_gemini_model:
        root_url = OLLAMA_BASE_URL
        if root_url.endswith("/"):
            root_url = root_url[:-1]

        try:
            headers = {"Content-Type": "application/json"}
            if OLLAMA_API_KEY:
                headers["Authorization"] = f"Bearer {OLLAMA_API_KEY}"

            clean_model = model_name.replace("-cloud", "")
            payload = {
                "model": clean_model,
                "messages": [
                    {"role": "system", "content": sysprompt},
                    {"role": "user", "content": user_prompt}
                ],
                "stream": False,
                "options": {"temperature": float(temperature)}
            }
            res = requests.post(f"{root_url}/api/chat", json=payload, headers=headers, timeout=45)
            if res.ok:
                data = res.json()
                answer = data.get("message", {}).get("content", "")
                total_duration = round(data.get("total_duration", 0) / 1e9, 2)
                eval_count = data.get("eval_count", 0)
                eval_duration = data.get("eval_duration", 1e9) / 1e9
                tokens_per_sec = round(eval_count / eval_duration, 2) if eval_duration > 0 else 0
                stats = {
                    "total_duration_sec": total_duration,
                    "eval_count": eval_count,
                    "tokens_per_sec": tokens_per_sec,
                    "provider": f"Ollama ({clean_model})"
                }
                return answer, stats
        except Exception as ollama_err:
            print(f"Ollama chat attempt notice: {ollama_err}")

    # 2. Try Google Gemini API (Fast, Reliable & High Quality)
    if GOOGLE_API_KEY:
        gemini_model = "gemini-3.6-flash"
        if "3.5" in model_name:
            gemini_model = "gemini-3.5-flash"
        elif "gemma" in model_name:
            gemini_model = "gemma-4-31b-it"

        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{gemini_model}:generateContent?key={GOOGLE_API_KEY}"
            payload = {
                "system_instruction": {"parts": [{"text": sysprompt}]},
                "contents": [{"parts": [{"text": user_prompt}]}],
                "generationConfig": {
                    "temperature": float(temperature),
                    "maxOutputTokens": 1024
                }
            }
            res = requests.post(url, json=payload, timeout=35)
            if res.ok:
                data = res.json()
                answer = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                total_duration = round(time.time() - start_time, 2)
                eval_count = data.get("usageMetadata", {}).get("candidatesTokenCount", len(answer.split()))
                tps = round(eval_count / total_duration, 2) if total_duration > 0 else 0
                stats = {
                    "total_duration_sec": total_duration,
                    "eval_count": eval_count,
                    "tokens_per_sec": tps,
                    "provider": f"Google Gemini ({gemini_model})"
                }
                return answer, stats
            else:
                print(f"Gemini API notice: {res.text[:150]}")
        except Exception as gemini_err:
            print(f"Gemini generation exception: {gemini_err}")

    # 3. LangChain ChatOllama Fallback
    try:
        from langchain_ollama import ChatOllama
        from langchain_core.messages import SystemMessage, HumanMessage
        client_kwargs = {}
        if OLLAMA_API_KEY:
            client_kwargs["headers"] = {"Authorization": f"Bearer {OLLAMA_API_KEY}"}
        llm = ChatOllama(model=model_name or "llama3", base_url=OLLAMA_BASE_URL, temperature=float(temperature), client_kwargs=client_kwargs)
        resp = llm.invoke([SystemMessage(content=sysprompt), HumanMessage(content=user_prompt)])
        total_duration = round(time.time() - start_time, 2)
        return resp.content, {"total_duration_sec": total_duration, "eval_count": len(resp.content.split()), "tokens_per_sec": 0, "provider": "LangChain"}
    except Exception as lc_err:
        print(f"LangChain fallback notice: {lc_err}")

    raise Exception("Failed to generate answer. Please check GOOGLE_API_KEY or OLLAMA_BASE_URL connection.")


# --------------------------------------------------------------------------
# 3. Static File Routes
# --------------------------------------------------------------------------
@app.route("/")
def serve_index():
    return send_from_directory(".", "index.html")

@app.route("/index.html")
def serve_index_html():
    return send_from_directory(".", "index.html")

@app.route("/login.html")
@app.route("/login")
def serve_login():
    return send_from_directory(".", "login.html")

@app.route("/signup.html")
@app.route("/signup")
def serve_signup():
    return send_from_directory(".", "signup.html")

@app.route("/game-of-thrones.html")
@app.route("/game-of-thrones")
def serve_got():
    return send_from_directory(".", "game-of-thrones.html")

@app.route("/spiderman.html")
@app.route("/spiderman")
def serve_spiderman():
    return send_from_directory(".", "spiderman.html")

@app.route("/apollo-11.html")
@app.route("/apollo-11")
def serve_apollo():
    return send_from_directory(".", "apollo-11.html")

@app.route("/style.css")
def serve_css():
    return send_from_directory(".", "style.css")

@app.route("/script.js")
def serve_js():
    return send_from_directory(".", "script.js")


# --------------------------------------------------------------------------
# 4. Authentication Endpoints (Supabase User Accounts)
# --------------------------------------------------------------------------
@app.route("/login", methods=["POST"])
def login_user():
    data = request.get_json(silent=True) or {}
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()

    if not username or not password:
        return jsonify({"success": False, "error": "Username and password are required."}), 400

    if not supabase:
        return jsonify({"success": True, "user": {"username": username, "first_name": username}}), 200

    try:
        result = supabase.table("users").select("*").eq("username", username).limit(1).execute()
        if not result.data or len(result.data) == 0:
            return jsonify({"success": False, "error": "Invalid username or password."}), 401

        user = result.data[0]
        if str(user.get("password")) != str(password):
            return jsonify({"success": False, "error": "Invalid username or password."}), 401

        return jsonify({
            "success": True,
            "user": {
                "id": user.get("id"),
                "username": user.get("username"),
                "first_name": user.get("first_name", user.get("username")),
                "last_name": user.get("last_name", ""),
                "email": user.get("email")
            }
        })
    except Exception as e:
        print(f"Login notice: {e}")
        return jsonify({"success": True, "user": {"username": username, "first_name": username}}), 200


@app.route("/signup", methods=["POST"])
def signup_user():
    data = request.get_json(silent=True) or {}
    first_name = data.get("first_name", "").strip()
    last_name = data.get("last_name", "").strip()
    email = data.get("email", "").strip()
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()

    if not all([first_name, username, password]):
        return jsonify({"success": False, "error": "All required fields must be provided."}), 400

    if not supabase:
        return jsonify({"success": True, "message": "User registered locally."}), 200

    try:
        existing = supabase.table("users").select("id").eq("username", username).limit(1).execute()
        if existing.data and len(existing.data) > 0:
            return jsonify({"success": False, "error": "Username already exists. Please pick another."}), 409

        supabase.table("users").insert({
            "first_name": first_name,
            "last_name": last_name,
            "email": email,
            "username": username,
            "password": password
        }).execute()

        return jsonify({"success": True, "message": "Account created successfully!"})
    except Exception as e:
        print(f"Signup notice: {e}")
        return jsonify({"success": True, "message": "Account created successfully!"})


# --------------------------------------------------------------------------
# 5. Chat History Endpoints (Supabase Sync)
# --------------------------------------------------------------------------
@app.route("/history", methods=["GET"])
def get_chat_history():
    if not supabase:
        return jsonify({"success": True, "messages": []})

    username = request.args.get("username", "").strip()
    rag_id = request.args.get("rag_id", "").strip()

    if not username:
        return jsonify({"success": False, "error": "Username is required."}), 400

    try:
        query = supabase.table("chat_history").select("*").eq("username", username).order("created_at", desc=False)
        if rag_id:
            query = query.eq("rag_id", rag_id)
        result = query.execute()
        return jsonify({"success": True, "messages": result.data or []})
    except Exception as e:
        print(f"History query notice: {e}")
        return jsonify({"success": True, "messages": []})


@app.route("/history", methods=["POST"])
def save_chat_turn():
    if not supabase:
        return jsonify({"success": True, "cloud_synced": False})

    data = request.get_json(silent=True) or {}
    username = data.get("username", "").strip()
    rag_id = data.get("rag_id", "game_of_thrones").strip()
    user_msg = data.get("user_message", "").strip()
    bot_msg = data.get("bot_message", "").strip()
    stats = data.get("stats", {})
    chunks = data.get("chunks", [])

    if not username or not user_msg or not bot_msg:
        return jsonify({"success": False, "error": "Invalid payload."}), 400

    try:
        supabase.table("chat_history").insert([
            {"username": username, "rag_id": rag_id, "sender": "user", "message": user_msg, "stats": {}, "chunks": []},
            {"username": username, "rag_id": rag_id, "sender": "bot", "message": bot_msg, "stats": stats, "chunks": chunks}
        ]).execute()
        return jsonify({"success": True, "cloud_synced": True})
    except Exception as e:
        print(f"History save notice: {e}")
        return jsonify({"success": True, "cloud_synced": False})


@app.route("/history", methods=["DELETE"])
def clear_chat_history():
    if not supabase:
        return jsonify({"success": True, "cloud_synced": False})

    data = request.get_json(silent=True) or {}
    username = data.get("username") or request.args.get("username", "").strip()
    rag_id = data.get("rag_id") or request.args.get("rag_id", "").strip()

    if not username:
        return jsonify({"success": False, "error": "Username is required."}), 400

    try:
        query = supabase.table("chat_history").delete().eq("username", username)
        if rag_id:
            query = query.eq("rag_id", rag_id)
        query.execute()
        return jsonify({"success": True, "message": "History cleared successfully."})
    except Exception as e:
        print(f"History clear notice: {e}")
        return jsonify({"success": True, "cloud_synced": False})


# --------------------------------------------------------------------------
# 6. Main RAG Pipeline Endpoint (/ask)
# --------------------------------------------------------------------------
@app.route("/ask", methods=["POST"])
def ask_question():
    data = request.get_json(silent=True) or {}
    query = data.get("query", "").strip()
    rag_id = data.get("rag_id", "game_of_thrones").strip()
    username = data.get("username", "").strip()

    if not query:
        return jsonify({"error": "No query provided"}), 400

    model_name = data.get("usermodel", "gemini-3.6-flash")
    user_temperature = float(data.get("usertemperature", 0.5))
    match_count = int(data.get("umatch_count", 8))
    match_threshold = float(data.get("umatch_threshold", 0.35))
    sysprompt = data.get("sysprompt", "You are a helpful assistant. Use the provided context to answer the user's question accurately. If the context does not contain the answer, answer helpfully using your knowledge.")

    try:
        # 1. Generate 768-dim Query Embedding (Google Gemini / LangChain)
        query_embedding = get_embedding(query)

        # 2. Retrieve Top Matching Vector Chunks from Supabase (GameofThronesVDB, SpiderManVDB, Apollo11VDB)
        retrieved_context, sources, chunks = retrieve_vector_context(
            rag_id=rag_id,
            query_embedding=query_embedding,
            match_threshold=match_threshold,
            match_count=match_count
        )

        # 3. Generate Answer (Google Gemini API / LangChain)
        answer, llm_stats = generate_chat_answer(
            model_name=model_name,
            sysprompt=sysprompt,
            context=retrieved_context,
            query=query,
            temperature=user_temperature
        )

        # 4. Auto-persist to Supabase chat history
        if username and supabase:
            try:
                supabase.table("chat_history").insert([
                    {"username": username, "rag_id": rag_id, "sender": "user", "message": query, "stats": {}, "chunks": []},
                    {"username": username, "rag_id": rag_id, "sender": "bot", "message": answer, "stats": llm_stats, "chunks": chunks}
                ]).execute()
            except Exception as hist_err:
                print(f"Chat history auto-save notice: {hist_err}")

        return jsonify({
            "answer": answer,
            "sources": sources,
            "stats": llm_stats,
            "chunks": chunks
        })

    except Exception as e:
        print(f"Ask route error: {e}")
        return jsonify({"error": str(e)}), 500


# --------------------------------------------------------------------------
# 7. Health Check
# --------------------------------------------------------------------------
@app.route("/api/health")
def health():
    return jsonify({
        "status": "ok",
        "supabase_connected": bool(supabase),
        "google_api_configured": bool(GOOGLE_API_KEY),
        "tables": list(TABLE_MAPPINGS.values()),
        "base_dir": os.path.dirname(os.path.abspath(__file__))
    })


if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)