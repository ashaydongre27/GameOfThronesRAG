import os
import hashlib
import traceback
import json
import requests
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = Flask(__name__, static_folder=BASE_DIR, static_url_path="")
CORS(app)

# 1. Initialize Supabase Connection Safely
SUPABASE_URL = (os.getenv("SUPABASE_URL") or "").strip()
SUPABASE_KEY = (
    os.getenv("SUPABASE_SECRET_KEY") or
    os.getenv("SUPABASE_SERVICE_ROLE_KEY") or
    os.getenv("SUPABASE_KEY") or
    os.getenv("SUPABASE_ANON_KEY") or
    os.getenv("SUPABASE_PUBLISHABLE_KEY") or
    ""
).strip()

supabase = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        print(f"Warning: Failed to initialize Supabase client: {e}")
else:
    print("Notice: Missing Supabase credentials in environment variables.")


# 2. Helper functions for Ollama / Cloud AI API calls
def normalize_url(base_url):
    """
    Clean up user-provided URL: add scheme, remove trailing slashes.
    Returns the URL as-is (preserving /api if present).
    """
    url = (base_url or "").strip()
    while url.endswith("/"):
        url = url[:-1]
    if not url.startswith("http://") and not url.startswith("https://"):
        url = "https://" + url
    return url


def build_api_path(root_url, path):
    """
    Build the full API URL. If root_url already ends with /api,
    append path directly. Otherwise prepend /api.
    Example:
      build_api_path("https://ollama.com/api", "/embed") -> "https://ollama.com/api/embed"
      build_api_path("http://localhost:11434", "/embed")  -> "http://localhost:11434/api/embed"
    """
    if root_url.endswith("/api"):
        return f"{root_url}{path}"
    else:
        return f"{root_url}/api{path}"


def get_ollama_embedding(base_url, query, api_key=""):
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    root_url = normalize_url(base_url)
    last_error = ""

    # 1. Try Ollama /api/embed (newer Ollama & Ollama Cloud)
    try:
        url = build_api_path(root_url, "/embed")
        res = requests.post(
            url,
            json={"model": "nomic-embed-text", "input": query},
            headers=headers,
            timeout=25
        )
        if res.ok:
            data = res.json()
            embeddings = data.get("embeddings", [])
            if embeddings:
                return embeddings[0]
            # Some versions return "embedding" directly
            if "embedding" in data:
                return data["embedding"]
        else:
            last_error = f"{url} returned {res.status_code}: {res.text[:200]}"
    except Exception as e:
        last_error = f"{url} error: {str(e)}"

    # 2. Try Ollama /api/embeddings (older Ollama versions)
    try:
        url = build_api_path(root_url, "/embeddings")
        res = requests.post(
            url,
            json={"model": "nomic-embed-text", "prompt": query},
            headers=headers,
            timeout=25
        )
        if res.ok:
            data = res.json()
            if "embedding" in data:
                return data["embedding"]
        else:
            last_error = f"{url} returned {res.status_code}: {res.text[:200]}"
    except Exception as e:
        last_error = f"{url} error: {str(e)}"

    # 3. Try OpenAI-compatible /v1/embeddings (Nomic AI, OpenRouter, cloud proxies)
    try:
        # Strip /api if present to build /v1 path
        v1_base = root_url[:-4] if root_url.endswith("/api") else root_url
        url = f"{v1_base}/v1/embeddings"
        res = requests.post(
            url,
            json={"model": "nomic-embed-text", "input": query},
            headers=headers,
            timeout=25
        )
        if res.ok:
            v1_data = res.json()
            data_arr = v1_data.get("data", [])
            if data_arr and "embedding" in data_arr[0]:
                return data_arr[0]["embedding"]
        else:
            last_error = f"{url} returned {res.status_code}: {res.text[:200]}"
    except Exception as e:
        last_error = f"{url} error: {str(e)}"

    # 4. Try LangChain OllamaEmbeddings (for local machine execution)
    try:
        from langchain_ollama import OllamaEmbeddings
        client_kwargs = {}
        if api_key:
            client_kwargs["headers"] = {"Authorization": f"Bearer {api_key}"}
        embed_client = OllamaEmbeddings(
            model="nomic-embed-text",
            base_url=root_url,
            client_kwargs=client_kwargs
        )
        return embed_client.embed_query(query)
    except Exception as e:
        last_error = f"{last_error} | LangChain: {str(e)}"

    raise Exception(
        f"Could not connect to Ollama embedding endpoint at '{root_url}'. Error: {last_error}"
    )



def generate_ollama_chat(base_url, model_name, sysprompt, context, query, temperature=0.5, api_key=""):
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    root_url = normalize_url(base_url)
    last_error = ""

    # 1. Try Ollama Native /api/chat
    try:
        payload = {
            "model": model_name,
            "messages": [
                {"role": "system", "content": sysprompt},
                {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {query}"}
            ],
            "stream": False,
            "options": {"temperature": float(temperature)}
        }
        res = requests.post(build_api_path(root_url, "/chat"), json=payload, headers=headers, timeout=50)
        if res.ok:
            data = res.json()
            answer = data.get("message", {}).get("content", "")
            total_duration = data.get("total_duration", 0) / 1e9
            eval_count = data.get("eval_count", 0)
            eval_duration = data.get("eval_duration", 1e9) / 1e9
            tokens_per_sec = eval_count / eval_duration if eval_duration > 0 else 0
            stats = {
                "total_duration_sec": round(total_duration, 3),
                "eval_count": eval_count,
                "tokens_per_sec": round(tokens_per_sec, 2)
            }
            return answer, stats
        else:
            last_error = f"{res.status_code} {res.text[:150]}"
    except Exception as e:
        last_error = str(e)

    # 2. Try OpenAI-compatible /v1/chat/completions
    try:
        v1_payload = {
            "model": model_name,
            "messages": [
                {"role": "system", "content": sysprompt},
                {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {query}"}
            ],
            "temperature": float(temperature)
        }
        v1_base = root_url[:-4] if root_url.endswith("/api") else root_url
        res = requests.post(f"{v1_base}/v1/chat/completions", json=v1_payload, headers=headers, timeout=50)
        if res.ok:
            v1_data = res.json()
            answer = v1_data["choices"][0]["message"]["content"]
            return answer, {"total_duration_sec": 0, "eval_count": 0, "tokens_per_sec": 0}
        else:
            last_error = f"{res.status_code} {res.text[:150]}"
    except Exception as e:
        last_error = str(e)

    # 3. Try LangChain ChatOllama (for local machine execution)
    try:
        from langchain_ollama import ChatOllama
        from langchain_core.messages import SystemMessage, HumanMessage
        client_kwargs = {}
        if api_key:
            client_kwargs["headers"] = {"Authorization": f"Bearer {api_key}"}
        llm = ChatOllama(
            model=model_name,
            base_url=root_url,
            temperature=float(temperature),
            client_kwargs=client_kwargs
        )
        response = llm.invoke([
            SystemMessage(content=sysprompt),
            HumanMessage(content=f"Context:\n{context}\n\nQuestion: {query}")
        ])
        return response.content, {"total_duration_sec": 0, "eval_count": 0, "tokens_per_sec": 0}
    except Exception as e:
        last_error = f"{last_error} | LangChain Chat: {str(e)}"

    raise Exception(f"Failed to generate answer from '{root_url}'. Details: {last_error}")


# 3. Static File Routes
@app.route("/")
def home():
    return send_from_directory(BASE_DIR, "index.html")

@app.route("/index.html")
def index_page():
    return send_from_directory(BASE_DIR, "index.html")

@app.route("/login.html")
def login_page():
    return send_from_directory(BASE_DIR, "login.html")

@app.route("/signup.html")
def signup_page():
    return send_from_directory(BASE_DIR, "signup.html")

@app.route("/game-of-thrones")
@app.route("/game-of-thrones.html")
def got_page():
    return send_from_directory(BASE_DIR, "game-of-thrones.html")

@app.route("/spiderman")
@app.route("/spiderman.html")
def spiderman_page():
    return send_from_directory(BASE_DIR, "spiderman.html")

@app.route("/apollo-11")
@app.route("/apollo-11.html")
def apollo_page():
    return send_from_directory(BASE_DIR, "apollo-11.html")

@app.route("/style.css")
def serve_css():
    return send_from_directory(BASE_DIR, "style.css", mimetype="text/css")

@app.route("/script.js")
def serve_js():
    return send_from_directory(BASE_DIR, "script.js", mimetype="application/javascript")

@app.route("/api/health", methods=["GET"])
def health_check():
    return jsonify({
        "status": "ok",
        "supabase_connected": supabase is not None,
        "base_dir": BASE_DIR
    })


# 4. User Authentication Routes
@app.route("/login", methods=["POST"])
def login():
    if not supabase:
        return jsonify({"success": False, "error": "Database not configured on server. Please check Supabase credentials in Vercel."}), 500

    data = request.get_json(silent=True) or {}
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()

    if not username or not password:
        return jsonify({"success": False, "error": "Username and password are required."}), 400

    try:
        result = supabase.table("UserDetails").select("*").eq("username", username).execute()

        if not result.data or len(result.data) == 0:
            return jsonify({"success": False, "error": "Invalid username or password."}), 401

        user = result.data[0]
        password_hash = hashlib.sha256(password.encode("utf-8")).hexdigest()

        if user.get("password_hash") != password_hash:
            return jsonify({"success": False, "error": "Invalid username or password."}), 401

        user_details = {k: v for k, v in user.items() if k != "password_hash"}
        return jsonify({"success": True, "user": user_details})

    except Exception as e:
        print(f"Login error: {e}")
        return jsonify({"success": False, "error": f"Authentication failed: {str(e)}"}), 500


@app.route("/signup", methods=["POST"])
def signup():
    if not supabase:
        return jsonify({"success": False, "error": "Database not configured on server. Please check Supabase credentials in Vercel."}), 500

    data = request.get_json(silent=True) or {}
    first_name = data.get("first_name", "").strip()
    last_name = data.get("last_name", "").strip()
    email = data.get("email", "").strip()
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()

    if not all([first_name, last_name, email, username, password]):
        return jsonify({"success": False, "error": "All fields are required."}), 400

    try:
        existing_user = supabase.table("UserDetails").select("username").or_(f"username.eq.{username},email.eq.{email}").execute()
        if existing_user.data:
            return jsonify({"success": False, "error": "Username or Email already exists."}), 409

        password_hash = hashlib.sha256(password.encode("utf-8")).hexdigest()
        new_user = {
            "first_name": first_name,
            "last_name": last_name,
            "email": email,
            "username": username,
            "password_hash": password_hash
        }

        supabase.table("UserDetails").insert(new_user).execute()
        return jsonify({"success": True, "message": "Account created successfully."})

    except Exception as e:
        print(f"Signup error: {e}")
        return jsonify({"success": False, "error": f"Signup failed: {str(e)}"}), 500


# 5. Chat History Routes
@app.route("/history", methods=["GET"])
def get_chat_history():
    if not supabase:
        return jsonify({"success": False, "error": "Database not configured."}), 500

    username = request.args.get("username", "").strip()
    rag_id = request.args.get("rag_id", "").strip()

    if not username:
        return jsonify({"success": False, "error": "Username is required to fetch history."}), 400

    try:
        query = supabase.table("chat_history").select("*").eq("username", username)
        if rag_id:
            query = query.eq("rag_id", rag_id)

        result = query.order("created_at", desc=False).execute()
        return jsonify({"success": True, "messages": result.data or [], "cloud_synced": True})

    except Exception as e:
        print(f"Chat history fetch notice: {e}")
        return jsonify({
            "success": True,
            "messages": [],
            "cloud_synced": False,
            "message": "Using local client storage."
        })


@app.route("/history", methods=["POST"])
def save_chat_history():
    if not supabase:
        return jsonify({"success": False, "error": "Database not configured."}), 500

    data = request.get_json(silent=True) or {}
    username = data.get("username", "").strip()
    rag_id = data.get("rag_id", "default").strip()
    messages_to_save = []

    if "user_message" in data and "bot_message" in data:
        messages_to_save.append({
            "username": username,
            "rag_id": rag_id,
            "sender": "user",
            "message": data.get("user_message", ""),
            "stats": {},
            "chunks": []
        })
        messages_to_save.append({
            "username": username,
            "rag_id": rag_id,
            "sender": "bot",
            "message": data.get("bot_message", ""),
            "stats": data.get("stats", {}),
            "chunks": data.get("chunks", [])
        })
    elif "message" in data and "sender" in data:
        messages_to_save.append({
            "username": username,
            "rag_id": rag_id,
            "sender": data.get("sender"),
            "message": data.get("message", ""),
            "stats": data.get("stats", {}),
            "chunks": data.get("chunks", [])
        })
    else:
        return jsonify({"success": False, "error": "Invalid history payload."}), 400

    if not username:
        return jsonify({"success": False, "error": "Username is required."}), 400

    try:
        supabase.table("chat_history").insert(messages_to_save).execute()
        return jsonify({"success": True, "cloud_synced": True})
    except Exception as e:
        print(f"Chat history insert notice: {e}")
        return jsonify({
            "success": True,
            "cloud_synced": False,
            "message": "Saved to local client storage."
        })


@app.route("/history", methods=["DELETE"])
def clear_chat_history():
    if not supabase:
        return jsonify({"success": False, "error": "Database not configured."}), 500

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
        print(f"Chat history clear error: {e}")
        return jsonify({"success": True, "message": "Local history will be cleared.", "cloud_synced": False})


# 6. Route for processing AI questions with RAG
@app.route("/ask", methods=["POST"])
def ask_question():
    if not supabase:
        return jsonify({"error": "Supabase database connection is not configured on server."}), 500

    data = request.get_json(silent=True) or {}
    query = data.get("query", "").strip()
    rag_id = data.get("rag_id", "game_of_thrones").strip()
    username = data.get("username", "").strip()

    OLLAMA_BASE_URL = (os.getenv("OLLAMA_BASE_URL") or "http://localhost:11434").strip()
    OLLAMA_API_KEY = (os.getenv("OLLAMA_API_KEY") or "").strip()

    rpc_functions = {
        "spiderman": "match_mainragvdb",
        "game_of_thrones": "match_mainragvdb",
        "apollo_11": "match_mainragvdb"
    }
    rpc_name = rpc_functions.get(rag_id, "match_mainragvdb")

    if not query:
        return jsonify({"error": "No query provided"}), 400

    model_name = data.get("usermodel", "gemma4:31b-cloud")
    user_temperature = float(data.get("usertemperature", 0.5))
    match_count = int(data.get("umatch_count", 10))
    match_threshold = float(data.get("umatch_threshold", 0.4))
    sysprompt = data.get("sysprompt", "You are a helpful assistant. Use the following context to answer the user's question. If you don't know the answer based on the context, just say that you don't know.")

    try:
        # 1. Generate query embedding
        query_embedding = get_ollama_embedding(OLLAMA_BASE_URL, query, OLLAMA_API_KEY)

        # 2. Search Supabase Vector Database
        result = supabase.rpc(
            rpc_name,
            {
                "query_embedding": query_embedding,
                "match_threshold": match_threshold,
                "match_count": match_count
            }
        ).execute()

        retrieved_context = ""
        sources = []
        chunks = []

        if result.data:
            for doc in result.data:
                doc_id = doc.get('uid', doc.get('id', 'N/A'))
                text_content = doc.get('text', doc.get('content', 'N/A'))
                similarity = doc.get('similarity', 0.0)

                retrieved_context += f"{text_content}\n\n"
                sources.append(doc_id)

                chunks.append({
                    "id": str(doc_id),
                    "similarity": round(float(similarity), 3),
                    "text": text_content[:500] + "..." if len(text_content) > 500 else text_content
                })

        if not retrieved_context.strip():
            answer = "No matching documents found in the knowledge base to answer this question. Try lowering the match threshold in Settings or asking a related question."
            llm_stats = {"total_duration_sec": 0, "eval_count": 0, "tokens_per_sec": 0}
        else:
            # 3. Generate LLM Answer
            answer, llm_stats = generate_ollama_chat(
                base_url=OLLAMA_BASE_URL,
                model_name=model_name,
                sysprompt=sysprompt,
                context=retrieved_context,
                query=query,
                temperature=user_temperature,
                api_key=OLLAMA_API_KEY
            )

        # 4. Auto-persist to database if username is provided
        if username and supabase:
            try:
                supabase.table("chat_history").insert([
                    {
                        "username": username,
                        "rag_id": rag_id,
                        "sender": "user",
                        "message": query,
                        "stats": {},
                        "chunks": []
                    },
                    {
                        "username": username,
                        "rag_id": rag_id,
                        "sender": "bot",
                        "message": answer,
                        "stats": llm_stats,
                        "chunks": chunks
                    }
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
        print("--- ERROR IN /ask ROUTE ---")
        traceback.print_exc()
        print("----------------------------")
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5000)