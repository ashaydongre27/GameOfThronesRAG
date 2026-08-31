import os
import requests
import json
import time
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SECRET_KEY")

if not GOOGLE_API_KEY:
    raise ValueError("Missing GOOGLE_API_KEY in .env file.")
if not SUPABASE_URL or not SUPABASE_SECRET_KEY:
    raise ValueError("Missing Supabase credentials in .env file.")

supabase = create_client(SUPABASE_URL, SUPABASE_SECRET_KEY)

def get_google_embedding(text: str) -> list:
    """Generates a 768-dimensional embedding vector via Google Gemini API."""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key={GOOGLE_API_KEY}"
    payload = {
        "model": "models/gemini-embedding-001",
        "content": {"parts": [{"text": text[:2048]}]},
        "outputDimensionality": 768
    }
    res = requests.post(url, json=payload, timeout=20)
    if res.ok:
        return res.json()["embedding"]["values"]
    else:
        raise Exception(f"Google embedding error ({res.status_code}): {res.text}")

def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list:
    """Simple sliding window text chunker."""
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
    print(f"\n--- Ingesting {len(chunks)} chunks into table: '{table_name}' ---")
    inserted_count = 0
    for idx, text in enumerate(chunks):
        try:
            vec = get_google_embedding(text)
            row = {
                "uid": f"{table_name.lower()}_{idx + 1}_{int(time.time())}",
                "text": text,
                "embeddings": vec
            }
            supabase.table(table_name).insert(row).execute()
            inserted_count += 1
            print(f"  [{inserted_count}/{len(chunks)}] Embedded chunk {idx + 1}")
            time.sleep(0.4) # Respect Google API rate limit
        except Exception as e:
            print(f"  Error on chunk {idx + 1}: {e}")

    print(f"Successfully seeded {inserted_count} records into '{table_name}'!")

def main():
    # 1. Game of Thrones data from doc files
    got_file = os.path.join("doc", "gotTheory.txt")
    if os.path.exists(got_file):
        with open(got_file, "r", encoding="utf-8") as f:
            got_content = f.read()
        got_chunks = chunk_text(got_content, chunk_size=600)[:15] # 15 high-density chunks
        seed_table("GameofThronesVDB", got_chunks)

    # 2. Spider-Man Knowledge Base
    spiderman_text = """
Spider-Man, created by Stan Lee and Steve Ditko, first appeared in Amazing Fantasy #15 in August 1962. Peter Parker is an orphaned science prodigy raised by Uncle Ben and Aunt May in Queens, New York. After being bitten by a radioactive spider, he develops superhuman strength, agility, wall-crawling capabilities, and a precognitive "spider-sense."

Uncle Ben's tragic murder by a burglar Peter refused to stop teaches him his defining life lesson: "With great power there must also come great responsibility." Peter designs mechanical web-shooters and creates a distinctive red-and-blue suit, fighting crime as Spider-Man while working as a freelance photographer for the Daily Bugle under J. Jonah Jameson.

Spider-Man's rogues gallery includes iconic villains: Green Goblin (Norman Osborn), Doctor Octopus (Otto Octavius), Venom (Eddie Brock bonded with the alien symbiote), Carnage (Cletus Kasady), Sandman, Electro, Kraven the Hunter, Mysterio, the Lizard, and the Kingpin (Wilson Fisk).

In the Marvel Multiverse and Spider-Verse storylines, numerous alternate variants exist: Miles Morales (the Brooklyn teenager who gains camouflage and venom strike bio-electricity), Gwen Stacy (Spider-Woman / Ghost-Spider from Earth-65), Miguel O'Hara (Spider-Man 2099), Peter B. Parker, and Spider-Noir.

Key comic storylines include "The Night Gwen Stacy Died" (Amazing Spider-Man #121-122), "Kraven's Last Hunt" (1987), "The Symbiote Saga" / Secret Wars, and "Spider-Verse" (2014) where Morlun and the Inheritors hunt spider-totems across alternate realities.
"""
    spiderman_chunks = chunk_text(spiderman_text, chunk_size=500)
    seed_table("SpiderManVDB", spiderman_chunks)

    # 3. Apollo 11 Knowledge Base
    apollo_text = """
Apollo 11 was the American spaceflight that first landed humans on the Moon on July 20, 1969. Commander Neil Armstrong and Lunar Module Pilot Buzz Aldrin landed the Apollo Lunar Module Eagle at Tranquility Base (Mare Tranquillitatis), while Command Module Pilot Michael Collins orbited above in Columbia.

Neil Armstrong became the first person to step onto the lunar surface on July 21 at 02:56 UTC, speaking the immortal words: "That's one small step for [a] man, one giant leap for mankind." Buzz Aldrin joined him 19 minutes later, describing the lunar landscape as "magnificent desolation."

The mission was launched by a massive three-stage Saturn V rocket from Launch Complex 39A at Kennedy Space Center in Florida on July 16, 1969. The Saturn V stood 363 feet (111 meters) tall, generated 7.5 million pounds of thrust using five F-1 rocket engines, and remains one of the most powerful launch vehicles ever built.

During their 21 hours and 36 minutes on the lunar surface (including a 2-hour 31-minute extravehicular moonwalk), Armstrong and Aldrin collected 47.5 pounds (21.5 kg) of lunar material, deployed the Early Apollo Scientific Experiments Package (EASEP) including a passive seismometer and laser ranging retroreflector, and planted the United States flag.

Apollo 11 fulfilled President John F. Kennedy's national goal proposed before a joint session of Congress on May 25, 1961: "before this decade is out, of landing a man on the Moon and returning him safely to the Earth." The astronauts splashed down safely in the Pacific Ocean on July 24, 1969, recovered by the USS Hornet.
"""
    apollo_chunks = chunk_text(apollo_text, chunk_size=500)
    seed_table("Apollo11VDB", apollo_chunks)

    print("\n=======================================================")
    print("All 3 Vector Tables (GameofThronesVDB, SpiderManVDB, Apollo11VDB) have been seeded with 768-dim Google embeddings!")
    print("=======================================================")

if __name__ == "__main__":
    main()
