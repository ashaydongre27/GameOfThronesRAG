import os
import hashlib
import traceback
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from dotenv import load_dotenv
from supabase import create_client
from langchain_ollama import OllamaEmbeddings, ChatOllama
from langchain_core.prompts import PromptTemplate

load_dotenv()
app = Flask(__name__)
CORS(app)

# Absolute path to the directory containing this file (Crucial for Vercel)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# 1. Initialize Connections 
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SECRET_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Missing Supabase credentials. Please check your .env file.")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# 2. Routes for serving pages
@app.route("/")
def home():
    return send_file(os.path.join(BASE_DIR, "index.html"))

@app.route("/index.html")
def index_page():
    return send_file(os.path.join(BASE_DIR, "index.html"))

@app.route("/login.html")
def login_page():
    return send_file(os.path.join(BASE_DIR, "login.html"))

@app.route("/signup.html")
def signup_page():
    return send_file(os.path.join(BASE_DIR, "signup.html"))

@app.route("/style.css")
def serve_css():
    return send_file(os.path.join(BASE_DIR, "style.css"))

@app.route("/script.js")
def serve_js():
    return send_file(os.path.join(BASE_DIR, "script.js"))

# 3. Route for user authentication
@app.route("/login", methods=["POST"])
def login():
    data = request.json
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
        return jsonify({"success": False, "error": "An internal error occurred."}), 500

# 4. Route for user registration
@app.route("/signup", methods=["POST"])
def signup():
    data = request.json
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
        return jsonify({"success": False, "error": "An internal error occurred."}), 500

# 5. Route for processing the AI questions
@app.route("/ask", methods=["POST"])
def ask_question():
    # READ OLLAMA VARIABLES INSIDE THE ROUTE FOR VERCEL COMPATIBILITY
    OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    OLLAMA_API_KEY = os.getenv("OLLAMA_API_KEY", "")

    # Safeguard: Ensure the URL has a protocol
    if not OLLAMA_BASE_URL.startswith("http://") and not OLLAMA_BASE_URL.startswith("https://"):
        OLLAMA_BASE_URL = "https://" + OLLAMA_BASE_URL

    data = request.json
    query = data.get("query")
    rag_id = data.get("rag_id", "spiderman")
    
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
        # Setup Auth headers for LangChain
        client_kwargs = {}
        if OLLAMA_API_KEY:
            client_kwargs['headers'] = {'Authorization': f'Bearer {OLLAMA_API_KEY}'}

        # Initialize clients inside the route
        embeddings = OllamaEmbeddings(
            model="nomic-embed-text", 
            base_url=OLLAMA_BASE_URL,
            client_kwargs=client_kwargs
        )

        # Generate query embedding
        query_embedding = embeddings.embed_query(query)

        # Search Vector Database
        result = supabase.rpc(
            rpc_name,
            {
                "query_embedding": query_embedding,
                "match_threshold": match_threshold,
                "match_count": match_count
            }
        ).execute()

        if not result.data:
            return jsonify({
                "answer": "No matches found in the database to answer this question.", 
                "sources": [],
                "chunks": [],
                "stats": {}
            })

        retrieved_context = ""
        sources = []
        chunks = []
        for doc in result.data:
            doc_id = doc.get('uid', doc.get('id', 'N/A'))
            text_content = doc.get('text', doc.get('content', 'N/A'))
            similarity = doc.get('similarity', 0.0)
            
            retrieved_context += f"{text_content}\n\n"
            sources.append(doc_id)
            
            chunks.append({
                "id": doc_id,
                "similarity": round(similarity, 3),
                "text": text_content[:500] + "..." if len(text_content) > 500 else text_content
            })

        # Setup LangChain LLM
        llm = ChatOllama(
            model=model_name, 
            temperature=user_temperature, 
            base_url=OLLAMA_BASE_URL,
            client_kwargs=client_kwargs
        )
        
        prompt_template = "{sysprompt}\n\nContext:\n{context}\n\nQuestion: {question}\n\nAnswer:"
        prompt = PromptTemplate.from_template(prompt_template)
        chain = prompt | llm

        # Generate response
        response = chain.invoke({
            "sysprompt": sysprompt,
            "context": retrieved_context,
            "question": query
        })

        answer = response.content

        # Extract Metadata
        metadata = response.response_metadata or {}
        total_duration = metadata.get('total_duration', 0) / 1e9
        eval_count = metadata.get('eval_count', 0)
        eval_duration = metadata.get('eval_duration', 1e9) / 1e9
        tokens_per_sec = eval_count / eval_duration if eval_duration > 0 else 0

        llm_stats = {
            "total_duration_sec": round(total_duration, 3),
            "eval_count": eval_count,
            "tokens_per_sec": round(tokens_per_sec, 2)
        }

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
        # EXPLICITLY TELL THE USER WHAT URL VERCEL IS USING
        error_msg = f"Connection Failed. Vercel tried using URL: {OLLAMA_BASE_URL}. Error: {str(e)}"
        return jsonify({"error": error_msg}), 500

if __name__ == "__main__":
    app.run(debug=True, port=5000)