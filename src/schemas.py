from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class SourceDocument:
    source_id: str
    title: str
    publisher: str
    source_url: str
    publication_date: str
    review_date: str
    document_type: str
    local_path: str
    text: str


@dataclass(frozen=True)
class DocumentChunk:
    chunk_id: str
    source_id: str
    text: str
    metadata: dict[str, Any]


@dataclass(frozen=True)
class RetrievedChunk:
    chunk_id: str
    text: str
    distance: float
    metadata: dict[str, Any]
