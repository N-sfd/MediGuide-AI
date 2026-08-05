import hashlib

from src.config import (
    CHUNK_OVERLAP_WORDS,
    CHUNK_SIZE_WORDS,
)
from src.schemas import (
    DocumentChunk,
    SourceDocument,
)


def create_chunk_id(
    source_id: str,
    chunk_number: int,
    text: str,
) -> str:
    digest = hashlib.sha256(
        text.encode("utf-8")
    ).hexdigest()[:12]

    return (
        f"{source_id}-chunk-{chunk_number}-{digest}"
    )


def chunk_document(
    document: SourceDocument,
) -> list[DocumentChunk]:
    words = document.text.split()

    if not words:
        return []

    step = max(
        1,
        CHUNK_SIZE_WORDS - CHUNK_OVERLAP_WORDS,
    )

    chunks: list[DocumentChunk] = []

    for start in range(0, len(words), step):
        selected_words = words[
            start:start + CHUNK_SIZE_WORDS
        ]

        if not selected_words:
            continue

        chunk_text = " ".join(selected_words)
        chunk_number = len(chunks) + 1

        chunks.append(
            DocumentChunk(
                chunk_id=create_chunk_id(
                    document.source_id,
                    chunk_number,
                    chunk_text,
                ),
                source_id=document.source_id,
                text=chunk_text,
                metadata={
                    "source_id": document.source_id,
                    "title": document.title,
                    "publisher": document.publisher,
                    "source_url": document.source_url,
                    "publication_date": (
                        document.publication_date
                    ),
                    "review_date": document.review_date,
                    "document_type": (
                        document.document_type
                    ),
                    "local_path": document.local_path,
                    "chunk_number": chunk_number,
                },
            )
        )

        if start + CHUNK_SIZE_WORDS >= len(words):
            break

    return chunks
