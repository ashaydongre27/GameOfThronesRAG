import os
import sys
import re
import json
import time
import glob
import argparse
import warnings

# Suppress warnings
warnings.filterwarnings("ignore")

# Safe console output for Windows
try:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

from langchain_google_genai import GoogleGenerativeAIEmbeddings

def clean_key_val(v: str) -> str:
    if not v:
        return ""
    v = v.strip()
    if len(v) >= 2 and ((v[0] == '"' and v[-1] == '"') or (v[0] == "'" and v[-1] == "'")):
        v = v[1:-1].strip()
    return v


class DocumentEmbedder:
    def __init__(self, primary_key: str = None, backup_key: str = None, model_name: str = "models/gemini-embedding-001", dimensionality: int = 768, delay: float = 1.0):
        self.primary_key = clean_key_val(primary_key or os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_PRIMARY"))
        self.backup_key = clean_key_val(backup_key or os.getenv("GOOGLE_API_KEY_BACKUP") or os.getenv("GOOGLE_API_BACKUP") or os.getenv("GOOGLE_API_KEY_2") or os.getenv("GEMINI_API_KEY_BACKUP"))
        self.model_name = model_name
        self.dimensionality = dimensionality
        self.delay = delay
        self.primary_embedder = None
        self.backup_embedder = None
        self.use_backup = False

    def _ensure_initialized(self):
        if not self.primary_key:
            self.primary_key = clean_key_val(os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_PRIMARY"))
            self.backup_key = clean_key_val(os.getenv("GOOGLE_API_KEY_BACKUP") or os.getenv("GOOGLE_API_BACKUP") or os.getenv("GOOGLE_API_KEY_2") or os.getenv("GEMINI_API_KEY_BACKUP"))

        if not self.primary_key and self.backup_key:
            self.primary_key, self.backup_key = self.backup_key, ""

        if not self.primary_key:
            raise ValueError("Google API key is missing. Please set GOOGLE_API_KEY in your environment variables.")

        if not self.primary_embedder:
            primary_kwargs = {"model": self.model_name, "google_api_key": self.primary_key}
            if self.dimensionality:
                primary_kwargs["output_dimensionality"] = self.dimensionality
            self.primary_embedder = GoogleGenerativeAIEmbeddings(**primary_kwargs)

        if self.backup_key and self.backup_key != self.primary_key and not self.backup_embedder:
            backup_kwargs = {"model": self.model_name, "google_api_key": self.backup_key}
            if self.dimensionality:
                backup_kwargs["output_dimensionality"] = self.dimensionality
            self.backup_embedder = GoogleGenerativeAIEmbeddings(**backup_kwargs)

    @property
    def current_embedder(self) -> GoogleGenerativeAIEmbeddings:
        self._ensure_initialized()
        if self.use_backup and self.backup_embedder:
            return self.backup_embedder
        return self.primary_embedder

    def _switch_to_backup(self) -> bool:
        if self.backup_embedder and not self.use_backup:
            self.use_backup = True
            print(" [Failover] Primary Google API key hit quota limit (429). Switched to backup API key.")
            return True
        return False

    def _extract_wait_time(self, err_str: str, default: int = 38) -> int:
        match = re.search(r'retry in (\d+\.?\d*)s|retryDelay\D+(\d+)s', err_str, re.IGNORECASE)
        if match:
            val = match.group(1) or match.group(2)
            try:
                return max(int(float(val)) + 2, 5)
            except Exception:
                pass
        return default

    def embed_text(self, text: str, max_retries: int = 5) -> list[float]:
        dim = self.dimensionality or 768
        if not text or not text.strip():
            return [0.0] * dim

        cleaned = text.strip()[:2048]
        for attempt in range(max_retries):
            try:
                vec = self.current_embedder.embed_query(cleaned)
                if self.delay > 0:
                    time.sleep(self.delay)
                return vec
            except Exception as e:
                err_str = str(e)
                if "RESOURCE_EXHAUSTED" in err_str or "429" in err_str:
                    # Switch to backup key if available
                    if self._switch_to_backup():
                        time.sleep(0.5)
                        continue
                    # Backup key exhausted or not configured: wait for quota reset
                    wait_time = self._extract_wait_time(err_str, default=(attempt + 1) * 20)
                    print(f" [429 Quota] API limit reached. Pausing {wait_time}s before retry ({attempt + 1}/{max_retries})...")
                    time.sleep(wait_time)
                else:
                    if attempt == max_retries - 1:
                        raise e
                    time.sleep(2)
        return [0.0] * dim

    def embed_batch(self, texts: list[str], max_retries: int = 6) -> list[list[float]]:
        if not texts:
            return []

        # Google batchEmbedContents limit is max 100 chunks per request
        chunk_limit = 90
        all_vectors = []

        for i in range(0, len(texts), chunk_limit):
            sub_batch = texts[i:i + chunk_limit]
            cleaned = [t.strip()[:2048] if t and t.strip() else " " for t in sub_batch]

            for attempt in range(max_retries):
                try:
                    vectors = self.current_embedder.embed_documents(cleaned)
                    all_vectors.extend(vectors)
                    if self.delay > 0 and (i + chunk_limit) < len(texts):
                        time.sleep(self.delay)
                    break
                except Exception as e:
                    err_str = str(e)
                    if "RESOURCE_EXHAUSTED" in err_str or "429" in err_str or "Quota" in err_str:
                        # Switch to backup key if available
                        if self._switch_to_backup():
                            time.sleep(0.5)
                            continue

                        # Both keys exhausted or no backup: sleep before retry
                        wait_time = self._extract_wait_time(err_str, default=38)
                        print(f" [429 Quota] API limit reached. Waiting {wait_time}s before auto-retrying ({attempt + 1}/{max_retries})...")
                        time.sleep(wait_time)
                    else:
                        if attempt == max_retries - 1:
                            raise e
                        print(f" [Retry] Attempt {attempt + 1}/{max_retries} failed: {e}. Retrying in 5s...")
                        time.sleep(5)

        return all_vectors

    def process_jsonl(self, input_path: str, output_path: str = None) -> str:
        if not os.path.exists(input_path):
            raise FileNotFoundError(f"Input file not found: {input_path}")

        if output_path is None:
            base_dir = os.path.dirname(input_path)
            base_name = os.path.splitext(os.path.basename(input_path))[0]
            output_dir = os.path.join(base_dir, "..", "embedded_jsonl")
            os.makedirs(output_dir, exist_ok=True)
            output_path = os.path.join(output_dir, f"{base_name}_embedded.jsonl")
        else:
            os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)

        records = []
        with open(input_path, "r", encoding="utf-8") as f:
            first_char = f.read(1)
            f.seek(0)
            if first_char == "[":
                try:
                    records = json.load(f)
                except Exception as e:
                    raise ValueError(f"Error parsing JSON array: {e}")
            else:
                for line in f:
                    line_str = line.strip()
                    if line_str:
                        try:
                            records.append(json.loads(line_str))
                        except Exception:
                            continue

        if not records:
            print(f"No records found in {input_path}")
            return output_path

        total_records = len(records)
        all_texts = [r.get("text", "") for r in records]

        start_time = time.time()
        print(f"Embedding file '{os.path.basename(input_path)}' ({total_records} chunks)...")

        all_vectors = self.embed_batch(all_texts)
        duration = time.time() - start_time

        with open(output_path, "w", encoding="utf-8") as out_f:
            for rec, vec in zip(records, all_vectors):
                output_obj = {
                    "uid": str(rec.get("uid", "")),
                    "text": str(rec.get("text", "")),
                    "embeddings": vec
                }
                out_f.write(json.dumps(output_obj, ensure_ascii=False) + "\n")

        print(f" [SUCCESS] Embedded {total_records} chunks in {duration:.2f}s -> {os.path.basename(output_path)}")
        return output_path

    def process_directory(self, input_dir: str, output_dir: str = None) -> list[str]:
        if not os.path.exists(input_dir):
            raise FileNotFoundError(f"Directory not found: {input_dir}")

        if output_dir is None:
            output_dir = os.path.join(input_dir, "..", "embedded_jsonl")
        os.makedirs(output_dir, exist_ok=True)

        target_files = sorted(glob.glob(os.path.join(input_dir, "*.jsonl")) + glob.glob(os.path.join(input_dir, "*.json")))
        input_files = [f for f in target_files if not f.endswith("_embedded.jsonl") and not os.path.basename(f).startswith("all_")]

        if not input_files:
            input_files = target_files

        print(f"Processing {len(input_files)} file(s) in {input_dir}")
        output_files = []
        for idx, file_path in enumerate(input_files, 1):
            base_name = os.path.splitext(os.path.basename(file_path))[0]
            out_file = os.path.join(output_dir, f"{base_name}_embedded.jsonl")
            self.process_jsonl(file_path, out_file)
            output_files.append(out_file)

            if self.delay > 0 and idx < len(input_files):
                time.sleep(self.delay)

        return output_files


def main():
    parser = argparse.ArgumentParser(description="LangChain Google GenAI Embedder (768-dim, Primary + Backup Key Failover)")
    parser.add_argument("-i", "--input", help="Path to input .jsonl file")
    parser.add_argument("-o", "--output", help="Path to output .jsonl file")
    parser.add_argument("-d", "--dir", help="Path to directory containing .jsonl files")
    parser.add_argument("--output-dir", help="Path to output directory")
    parser.add_argument("--dim", type=int, default=768, help="Embedding dimensionality (default: 768)")
    parser.add_argument("--delay", type=float, default=1.0, help="Proactive sleep delay between files/batches (default: 1.0s)")

    args = parser.parse_args()
    embedder = DocumentEmbedder(dimensionality=args.dim, delay=args.delay)

    if args.input:
        embedder.process_jsonl(args.input, args.output)
    elif args.dir:
        embedder.process_directory(args.dir, args.output_dir)
    else:
        sample_input = os.path.join(PROJECT_ROOT, "docs", "sample_apollo11.jsonl")
        sample_output = os.path.join(PROJECT_ROOT, "docs", "sample_apollo11_embedded.jsonl")

        if not os.path.exists(sample_input):
            sample_data = [
                {
                    "uid": "apollo11_chunk_001",
                    "text": "Apollo 11 was the American spaceflight that first landed humans on the Moon on July 20, 1969. Commander Neil Armstrong and Lunar Module Pilot Buzz Aldrin landed the Apollo Lunar Module Eagle at Tranquility Base."
                },
                {
                    "uid": "apollo11_chunk_002",
                    "text": "Neil Armstrong became the first person to step onto the lunar surface on July 21 at 02:56 UTC, speaking the immortal words: 'That\\'s one small step for [a] man, one giant leap for mankind.'"
                },
                {
                    "uid": "apollo11_chunk_003",
                    "text": "The Saturn V rocket launched Apollo 11 from Launch Complex 39A at Kennedy Space Center in Florida on July 16, 1969, generating 7.5 million pounds of thrust using five F-1 rocket engines."
                }
            ]
            with open(sample_input, "w", encoding="utf-8") as sf:
                for item in sample_data:
                    sf.write(json.dumps(item, ensure_ascii=False) + "\n")

        embedder.process_jsonl(sample_input, sample_output)


if __name__ == "__main__":
    main()
