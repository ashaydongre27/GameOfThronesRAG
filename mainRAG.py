import os
from dotenv import load_dotenv
from supabase import create_client
from langchain_ollama import OllamaEmbeddings, ChatOllama
from langchain_core.prompts import PromptTemplate

# 1. Setup and Environment
load_dotenv()
def generate_rag_response(
    query="why ned move to capital",
    usermodel="granite4:350m",
    usertemperature=0.5,
    umatch_count=10,
    umatch_threshold=0.4,
    sysprompt="\nYou are a helpful assistant. Use the following context to answer the user's question. \nIf you don't know the answer based on the context, just say that you don't know.\n"
):
    """
    Searches a Supabase vector database for context and generates an answer using ChatOllama.
    """
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_KEY = os.getenv("SUPABASE_SECRET_KEY")

    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError("Missing Supabase credentials. Please check your .env file.")

    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Initialize Embeddings and LLM
    embeddings = OllamaEmbeddings(model="nomic-embed-text")
    llm = ChatOllama(model=usermodel, temperature=usertemperature)

    print(f"Searching for: '{query}'...\n")

    # Generate query embedding
    query_embedding = embeddings.embed_query(query)

    try:
        # Search Vector Database
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
            
        # Extract context from matches
        retrieved_context = ""
        for doc in result.data:
            doc_id = doc.get('uid', doc.get('id', 'N/A'))
            text_content = doc.get('text', doc.get('content', 'N/A'))
            similarity = doc.get('similarity', 0.0)
            
            print(f"ID: {doc_id} | Similarity: {similarity:.3f}")
            print(f"Text: {text_content[:100]}...") # Print a snippet for debugging
            print("-" * 25)
            
            # Append text to our context block
            retrieved_context += f"{text_content}\n\n"

        # Prompt the LLM
        print("\n--- GENERATING ANSWER ---")
        prompt_template = """
        {sysprompt}
        
        Context:{context}
        
        Question: {question}
        
        Answer:
        """
        
        prompt = PromptTemplate.from_template(prompt_template)
        
        # Combine the prompt and LLM using LangChain Expression Language (LCEL)
        chain = prompt | llm 
        
        # Execute and print the result
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