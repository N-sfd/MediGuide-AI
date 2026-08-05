from src.chunking import chunk_document
from src.schemas import SourceDocument


def create_document(text: str) -> SourceDocument:
    return SourceDocument(
        source_id="test-source",
        title="Test",
        publisher="Test Publisher",
        source_url="https://example.org",
        publication_date="2026-01-01",
        review_date="2026-08-04",
        document_type="patient_education",
        local_path="test.txt",
        text=text,
    )


def test_short_document_creates_one_chunk() -> None:
    document = create_document(
        "This is a short medical education document."
    )

    chunks = chunk_document(document)

    assert len(chunks) == 1
    assert chunks[0].source_id == "test-source"


def test_chunk_ids_are_stable() -> None:
    document = create_document(
        "Repeated stable document content."
    )

    first = chunk_document(document)
    second = chunk_document(document)

    assert (
        first[0].chunk_id
        == second[0].chunk_id
    )
