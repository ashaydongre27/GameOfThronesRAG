import os
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from dotenv import load_dotenv
from supabase import create_client
from langchain_ollama import OllamaEmbeddings, ChatOllama
from langchain_core.prompts import PromptTemplate

# 1. Setup Environment and Flask
load_dotenv()
app = Flask(__name__)
CORS(app)

# 2. Initialize Connections 
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SECRET_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Missing Supabase credentials. Please check your .env file.")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
embeddings = OllamaEmbeddings(model="nomic-embed-text")

# 3. Routes for serving pages
@app.route("/")
def home():
    return send_file("index.html")

@app.route("/index.html")
def index_page():
    return send_file("index.html")

@app.route("/login.html")
def login_page():
    return send_file("login.html")

@app.route("/style.css")
def serve_css():
    return send_file("style.css")

@app.route("/script.js")
def serve_js():
    return send_file("script.js")

# 4. Route for processing the AI questions
@app.route("/ask", methods=["POST"])
def ask_question():
    data = request.json
    query = data.get("query")
    rag_id = data.get("rag_id", "mainragvdb")
    
    rpc_functions = {
        "mainragvdb": "match_mainragvdb",
        "hr_rag": "match_hr_rag",
        "tech_rag": "match_tech_rag",
        "legal_rag": "match_legal_rag"
    }
    rpc_name = rpc_functions.get(rag_id, "match_mainragvdb")

    if not query:
        return jsonify({"error": "No query provided"}), 400

    model_name = data.get("usermodel", "granite4:350m")
    user_temperature = float(data.get("usertemperature", 0.2))
    match_count = int(data.get("umatch_count", 10))
    match_threshold = float(data.get("umatch_threshold", 0.3))
    sysprompt = data.get("sysprompt", "You are a helpful assistant. Use the following context to answer the user's question. If you don't know the answer based on the context, just say that you don't know.")

    try:
        dynamic_llm = ChatOllama(model=model_name, temperature=user_temperature)
        dynamic_prompt = PromptTemplate.from_template(
            "{sysprompt}\n\nContext:\n{context}\n\nQuestion: {question}\n\nAnswer:"
        )
        dynamic_chain = dynamic_prompt | dynamic_llm

        query_embedding = embeddings.embed_query(query)

        result = supabase.rpc(
            rpc_name,
            {
                "query_embedding": query_embedding,
                "match_threshold": match_threshold,
                "match_count": match_count
            }
        ).execute()

        if not result.data:
            return jsonify({"answer": "No matches found in the database to answer this question.", "sources": []})

        retrieved_context = ""
        sources = []
        chunks = []
        for doc in result.data:
            doc_id = doc.get('uid', doc.get('id', 'N/A'))
            text_content = doc.get('text', doc.get('content', 'N/A'))
            similarity = doc.get('similarity', 0.0)
            
            retrieved_context += f"{text_content}\n\n"
            sources.append(doc_id)
            
            # Save individual chunk data for the frontend
            chunks.append({
                "id": doc_id,
                "similarity": round(similarity, 3),
                "text": text_content
            })

        response = dynamic_chain.invoke({
            "sysprompt": sysprompt,
            "context": retrieved_context,
            "question": query
        })

        metadata = response.response_metadata or {}
        total_duration = metadata.get('total_duration', 0) / 1e9
        eval_count = metadata.get('eval_count', 0)
        eval_duration = metadata.get('eval_duration', 1e9) / 1e9
        tokens_per_sec = eval_count / eval_duration if eval_duration > 0 else 0

        print(f"Total duration: {total_duration:.3f} sec")
        print(f"Eval count: {eval_count}")
        print(f"Token per sec: {tokens_per_sec:.2f}")

        llm_stats = {
            "total_duration_sec": round(total_duration, 3),
            "eval_count": eval_count,
            "tokens_per_sec": round(tokens_per_sec, 2)
        }

        return jsonify({
            "answer": response.content,
            "sources": sources,
            "stats": llm_stats,
            "chunks": chunks
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True, port=5000)