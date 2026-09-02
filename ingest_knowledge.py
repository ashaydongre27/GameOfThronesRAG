import os
import requests
import json
import time
from dotenv import load_dotenv
from supabase import create_client
from src.Embedder import DocumentEmbedder

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SECRET_KEY")

if not SUPABASE_URL or not SUPABASE_SECRET_KEY:
    raise ValueError("Missing Supabase credentials in .env file.")

supabase = create_client(SUPABASE_URL, SUPABASE_SECRET_KEY)
embedder = DocumentEmbedder(dimensionality=3072)

def get_google_embedding(text: str) -> list:
    return embedder.embed_text(text)

def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list:
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    chunks = []
    current_chunk = ""

    for p in paragraphs:
        if len(current_chunk) + len(p) < chunk_size:
            current_chunk += ("\n\n" if current_chunk else "") + p
        else:
            if current_chunk:
                chunks.append(current_chunk)
            current_chunk = p

    if current_chunk:
        chunks.append(current_chunk)

    return chunks

def seed_table(table_name: str, chunks: list):
    print(f"Ingesting {len(chunks)} chunks into table '{table_name}'...")
    try:
        # Batch embedding with multi-key failover
        vectors = embedder.embed_batch(chunks)

        rows = []
        for idx, (text, vec) in enumerate(zip(chunks, vectors)):
            rows.append({
                "uid": f"{table_name.lower()}_{idx + 1}_{int(time.time())}",
                "text": text,
                "embeddings": vec
            })

        supabase.table(table_name).insert(rows).execute()
        print(f"Successfully seeded {len(rows)} records into '{table_name}'")
    except Exception as e:
        print(f"Error inserting rows into '{table_name}': {e}")

def main():
    # 1. Game of Thrones
    got_file = os.path.join("docs", "gotTheory.txt")
    if os.path.exists(got_file):
        with open(got_file, "r", encoding="utf-8") as f:
            got_content = f.read()
        got_chunks = chunk_text(got_content, chunk_size=600)[:15]
        seed_table("GameofThronesVDB", got_chunks)

    # 2. Spider-Man
    spiderman_text = (
        "Spider-Man, created by Stan Lee and Steve Ditko, first appeared in Amazing Fantasy #15 in August 1962. "
        "Peter Parker is an orphaned science prodigy raised by Uncle Ben and Aunt May in Queens, New York. "
        "After being bitten by a radioactive spider, he develops superhuman strength, agility, wall-crawling capabilities, and a precognitive spider-sense.\n\n"
        "Uncle Ben's tragic murder by a burglar Peter refused to stop teaches him his defining life lesson: With great power there must also come great responsibility. "
        "Peter designs mechanical web-shooters and creates a distinctive red-and-blue suit, fighting crime as Spider-Man while working as a freelance photographer.\n\n"
        "Spider-Man's rogues gallery includes iconic villains: Green Goblin, Doctor Octopus, Venom, Carnage, Sandman, Electro, Kraven the Hunter, Mysterio, the Lizard, and Kingpin.\n\n"
        "In the Marvel Multiverse and Spider-Verse storylines, numerous alternate variants exist: Miles Morales, Gwen Stacy, Miguel O'Hara, Peter B. Parker, and Spider-Noir."
    )
    spiderman_chunks = chunk_text(spiderman_text, chunk_size=500)
    seed_table("SpiderManVDB", spiderman_chunks)

    # 3. Apollo 11
    apollo_text = (
        "Apollo 11 was the American spaceflight that first landed humans on the Moon on July 20, 1969. "
        "Commander Neil Armstrong and Lunar Module Pilot Buzz Aldrin landed the Apollo Lunar Module Eagle at Tranquility Base, while Command Module Pilot Michael Collins orbited above in Columbia.\n\n"
        "Neil Armstrong became the first person to step onto the lunar surface on July 21 at 02:56 UTC, speaking the immortal words: That's one small step for a man, one giant leap for mankind. "
        "Buzz Aldrin joined him 19 minutes later, describing the lunar landscape as magnificent desolation.\n\n"
        "The mission was launched by a massive three-stage Saturn V rocket from Launch Complex 39A at Kennedy Space Center in Florida on July 16, 1969. "
        "The Saturn V stood 363 feet tall, generated 7.5 million pounds of thrust using five F-1 rocket engines, and remains one of the most powerful launch vehicles ever built.\n\n"
        "During their 21 hours and 36 minutes on the lunar surface, Armstrong and Aldrin collected 47.5 pounds of lunar material, deployed the Early Apollo Scientific Experiments Package, and planted the US flag."
    )
    apollo_chunks = chunk_text(apollo_text, chunk_size=500)
    seed_table("Apollo11VDB", apollo_chunks)

if __name__ == "__main__":
    main()
