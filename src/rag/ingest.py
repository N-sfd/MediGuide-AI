import hashlib
from pathlib import Path

from pypdf import PdfReader

from src.config import CONFIG
from src.rag.retriever import get_collection

CHUNK_SIZE = 800
CHUNK_OVERLAP = 100


def _read_text(path: Path) -> str:
    if path.suffix.lower() == ".pdf":
        reader = PdfReader(str(path))
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    return path.read_text(encoding="utf-8", errors="ignore")


def _chunk(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    words = text.split()
    if not words:
        return []

    chunks = []
    step = max(chunk_size - overlap, 1)
    for start in range(0, len(words), step):
        chunk = " ".join(words[start : start + chunk_size])
        if chunk.strip():
            chunks.append(chunk)
    return chunks


def ingest_directory(knowledge_dir: Path | None = None) -> int:
    knowledge_dir = knowledge_dir or CONFIG.knowledge_dir
    collection = get_collection()

    supported = {".txt", ".md", ".pdf"}
    files = [p for p in knowledge_dir.rglob("*") if p.is_file() and p.suffix.lower() in supported]

    total_chunks = 0
    for path in files:
        text = _read_text(path)
        chunks = _chunk(text)
        if not chunks:
            continue

        ids = [hashlib.sha1(f"{path}:{i}".encode()).hexdigest() for i in range(len(chunks))]
        metadatas = [{"source": str(path.relative_to(knowledge_dir))} for _ in chunks]
        collection.upsert(ids=ids, documents=chunks, metadatas=metadatas)
        total_chunks += len(chunks)

    return total_chunks


if __name__ == "__main__":
    count = ingest_directory()
    print(f"Ingested {count} chunks from {CONFIG.knowledge_dir}")
