import sys
from app import get_embedding, retrieve_vector_context, generate_chat_answer

def generate_rag_response(
    query="why ned move to capital",
    rag_id="game_of_thrones",
    usermodel="gemini-3.6-flash",
    usertemperature=0.5,
    umatch_count=10,
    umatch_threshold=0.35,
    sysprompt="You are a helpful assistant. Use the following context to answer the user's question accurately."
):
    print(f"Searching for: '{query}' ({rag_id})...\n")
    query_embedding = get_embedding(query)
    context, sources, chunks = retrieve_vector_context(
        rag_id=rag_id,
        query_embedding=query_embedding,
        match_threshold=umatch_threshold,
        match_count=umatch_count
    )

    print("--- TOP MATCHES ---")
    for chunk in chunks:
        print(f"ID: {chunk.get('id')} | Similarity: {chunk.get('similarity')}")
        print(f"Text: {chunk.get('text', '')[:100]}...")
        print("-" * 25)

    print("\n--- GENERATING ANSWER ---")
    answer, stats = generate_chat_answer(
        model_name=usermodel,
        sysprompt=sysprompt,
        context=context,
        query=query,
        temperature=usertemperature
    )
    print(answer)
    return answer

if __name__ == "__main__":
    q = sys.argv[1] if len(sys.argv) > 1 else "why ned move to capital"
    generate_rag_response(query=q)