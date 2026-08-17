import os
from dotenv import load_dotenv
from supabase import create_client
from langchain_ollama import OllamaEmbeddings, ChatOllama
from langchain_core.prompts import PromptTemplate

load_dotenv()

def generate_rag_response(
    query="why ned move to capital",
    usermodel="gemma4:31b-cloud",
    usertemperature=0.5,
    umatch_count=10,
    umatch_threshold=0.4,
    sysprompt="\nYou are a helpful assistant. Use the following context to answer the user's question.\nIf you don't know the answer based on the context, just say that you don't know.\n"
):
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_KEY = os.getenv("SUPABASE_SECRET_KEY")
    OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    OLLAMA_API_KEY = os.getenv("OLLAMA_API_KEY", "")
    
    # Force local ollama package to respect cloud URL
    os.environ['OLLAMA_HOST'] = OLLAMA_BASE_URL

    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError("Missing Supabase credentials. Please check your .env file.")
        
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # Pass headers for cloud authentication
    client_kwargs = {}
    if OLLAMA_API_KEY:
        client_kwargs['headers'] = {'Authorization': f'Bearer {OLLAMA_API_KEY}'}

    embeddings = OllamaEmbeddings(model="nomic-embed-text", base_url=OLLAMA_BASE_URL, client_kwargs=client_kwargs)
    llm = ChatOllama(model=usermodel, temperature=usertemperature, base_url=OLLAMA_BASE_URL, client_kwargs=client_kwargs)

    print(f"Searching for: '{query}'...\n")
    query_embedding = embeddings.embed_query(query)

    try:
        result = supabase.rpc(
            "match_mainragvdb",
            {
                "query_embedding": query_embedding,
                "match_threshold": umatch_threshold,
                "match_count": umatch_count
            }
        ).execute()

        print("--- TOP MATCHES ---")
        if not result.data:
            print("No matches found above the threshold.")
            return None

        retrieved_context = ""
        for doc in result.data:
            doc_id = doc.get('uid', doc.get('id', 'N/A'))
            text_content = doc.get('text', doc.get('content', 'N/A'))
            similarity = doc.get('similarity', 0.0)
            
            print(f"ID: {doc_id} | Similarity: {similarity:.3f}")
            print(f"Text: {text_content[:100]}...") 
            print("-" * 25)
            
            retrieved_context += f"{text_content}\n\n"

        print("\n--- GENERATING ANSWER ---")
        prompt_template = """
        {sysprompt}
        Context:{context}
        Question: {question}
        Answer:
        """
        
        prompt = PromptTemplate.from_template(prompt_template)
        chain = prompt | llm 
        
        response = chain.invoke({
            "sysprompt": sysprompt,
            "context": retrieved_context,
            "question": query
        })
        
        print(response.content)
        return response.content

    except Exception as e:
        print(f"Error performing search or generation: {e}")
        return None