from pathlib import Path

from src.chunking import chunk_document
from src.document_loader import load_source_document
from src.embeddings import OllamaEmbeddingService
from src.vector_store import get_chroma_collection


SUPPORTED_DOCUMENTS = {
    ".pdf",
    ".txt",
}


def find_knowledge_documents(
    knowledge_directory: Path,
) -> list[Path]:
    return sorted(
        path
        for path in knowledge_directory.rglob("*")
        if (
            path.is_file()
            and path.suffix.lower() in SUPPORTED_DOCUMENTS
        )
    )


def ingest_document(
    document_path: Path,
) -> int:
    document = load_source_document(document_path)
    chunks = chunk_document(document)

    if not chunks:
        return 0

    embedding_service = OllamaEmbeddingService()
    collection = get_chroma_collection()

    texts = [chunk.text for chunk in chunks]
    embeddings = embedding_service.embed_documents(texts)

    collection.delete(
        where={"source_id": document.source_id},
    )

    collection.upsert(
        ids=[chunk.chunk_id for chunk in chunks],
        documents=texts,
        embeddings=embeddings,
        metadatas=[
            chunk.metadata
            for chunk in chunks
        ],
    )

    return len(chunks)


def ingest_directory(
    knowledge_directory: Path,
) -> dict[str, int]:
    results: dict[str, int] = {}

    for document_path in find_knowledge_documents(
        knowledge_directory
    ):
        try:
            results[document_path.name] = (
                ingest_document(document_path)
            )
        except Exception as error:
            print(
                f"Failed to ingest {document_path.name}: "
                f"{type(error).__name__}: {error}"
            )

    return results
