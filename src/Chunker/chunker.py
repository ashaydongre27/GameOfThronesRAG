import os
import glob
import json
import warnings

# Suppress Pydantic deprecation warnings on newer Python versions
warnings.filterwarnings('ignore', category=UserWarning)

try:
    from langchain_text_splitters import RecursiveCharacterTextSplitter
except ImportError:
    from langchain.text_splitter import RecursiveCharacterTextSplitter


def detect_topic(filename: str) -> str:
    lower_name = filename.lower()
    if "got" in lower_name or "throne" in lower_name or "westeros" in lower_name:
        return "GameofThronesVDB"
    elif "sm" in lower_name or "spider" in lower_name or "parker" in lower_name:
        return "SpiderManVDB"
    elif "apollo" in lower_name or "moon" in lower_name or "nasa" in lower_name:
        return "Apollo11VDB"
    return "GeneralVDB"


class DocumentChunker:
    def __init__(self, chunk_size: int = 1000, chunk_overlap: int = 200):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=self.chunk_size,
            chunk_overlap=self.chunk_overlap,
            length_function=len,
            separators=["\n\n", "\n", ". ", " ", ""]
        )

    def chunk_text(self, text: str) -> list[str]:
        if not text or not text.strip():
            return []
        return self.splitter.split_text(text.strip())

    def chunk_file(self, file_path: str) -> list[dict]:
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")

        # Try multiple encodings for safety
        content = ""
        for encoding in ["utf-8", "utf-8-sig", "latin-1", "cp1252"]:
            try:
                with open(file_path, "r", encoding=encoding) as f:
                    content = f.read()
                break
            except (UnicodeDecodeError, Exception):
                continue

        raw_chunks = self.chunk_text(content)
        filename = os.path.basename(file_path)
        base_name = os.path.splitext(filename)[0]
        topic = detect_topic(filename)

        structured_chunks = []
        for idx, chunk_text in enumerate(raw_chunks):
            structured_chunks.append({
                "uid": f"{base_name}_chunk_{idx + 1:03d}",
                "source_file": filename,
                "topic": topic,
                "chunk_index": idx + 1,
                "char_count": len(chunk_text),
                "text": chunk_text
            })

        return structured_chunks

    def chunk_directory(self, docs_dir: str = "docs", output_dir: str = None) -> dict:
        project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        target_dir = os.path.join(project_root, docs_dir) if not os.path.isabs(docs_dir) else docs_dir

        if not os.path.exists(target_dir):
            target_dir = os.path.abspath(docs_dir)
            if not os.path.exists(target_dir):
                raise FileNotFoundError(f"Documents directory not found: {target_dir}")

        if output_dir is None:
            output_dir = os.path.join(target_dir, "chunks")
        elif not os.path.isabs(output_dir):
            output_dir = os.path.join(project_root, output_dir)

        os.makedirs(output_dir, exist_ok=True)

        txt_files = sorted(glob.glob(os.path.join(target_dir, "*.txt")))
        print(f"Processing Directory: {target_dir}")
        print(f"Chunk Size: {self.chunk_size} | Overlap: {self.chunk_overlap}")

        all_chunks = []
        chunks_by_file = {}
        chunks_by_topic = {}

        for file_path in txt_files:
            file_name = os.path.basename(file_path)
            file_chunks = self.chunk_file(file_path)
            chunks_by_file[file_name] = file_chunks
            all_chunks.extend(file_chunks)

            # Export individual file JSON and JSONL
            base_name = os.path.splitext(file_name)[0]
            file_json_path = os.path.join(output_dir, f"{base_name}_chunks.json")
            file_jsonl_path = os.path.join(output_dir, f"{base_name}_chunks.jsonl")

            with open(file_json_path, "w", encoding="utf-8") as out_f:
                json.dump(file_chunks, out_f, indent=2, ensure_ascii=False)

            with open(file_jsonl_path, "w", encoding="utf-8") as out_l:
                for c in file_chunks:
                    out_l.write(json.dumps({"uid": c["uid"], "text": c["text"]}, ensure_ascii=False) + "\n")

            topic = detect_topic(file_name)
            chunks_by_topic.setdefault(topic, []).extend(file_chunks)

            print(f" -> {file_name:<24} : {len(file_chunks):>3} chunks -> {os.path.basename(file_jsonl_path)}")

        # Combined JSON and JSONL
        combined_path = os.path.join(output_dir, "all_chunks.json")
        combined_jsonl_path = os.path.join(output_dir, "all_chunks.jsonl")
        with open(combined_path, "w", encoding="utf-8") as out_f:
            json.dump(all_chunks, out_f, indent=2, ensure_ascii=False)
        with open(combined_jsonl_path, "w", encoding="utf-8") as out_l:
            for c in all_chunks:
                out_l.write(json.dumps({"uid": c["uid"], "text": c["text"]}, ensure_ascii=False) + "\n")

        # Topic-specific JSON and JSONL
        for topic, topic_chunks in chunks_by_topic.items():
            topic_path = os.path.join(output_dir, f"{topic}_all_chunks.json")
            topic_jsonl_path = os.path.join(output_dir, f"{topic}_all_chunks.jsonl")
            with open(topic_path, "w", encoding="utf-8") as out_f:
                json.dump(topic_chunks, out_f, indent=2, ensure_ascii=False)
            with open(topic_jsonl_path, "w", encoding="utf-8") as out_l:
                for c in topic_chunks:
                    out_l.write(json.dumps({"uid": c["uid"], "text": c["text"]}, ensure_ascii=False) + "\n")

        print(f"Total files processed: {len(txt_files)}")
        print(f"Total chunks created: {len(all_chunks)}")
        print(f"Output directory: {output_dir}")

        return {
            "total_files": len(txt_files),
            "total_chunks": len(all_chunks),
            "output_dir": output_dir,
            "chunks_by_topic": chunks_by_topic,
            "chunks_by_file": chunks_by_file,
            "all_chunks": all_chunks
        }


def main():
    chunker = DocumentChunker(chunk_size=1000, chunk_overlap=200)
    result = chunker.chunk_directory(docs_dir="docs")
    return result


if __name__ == "__main__":
    main()
