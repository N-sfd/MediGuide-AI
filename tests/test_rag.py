import chromadb
import pytest

from src.rag.citations import chunks_to_citations, format_citations_footer, format_context_block
from src.rag.ingest import _chunk
from src.schemas import RetrievedChunk


def test_chunk_splits_long_text_with_overlap():
    text = " ".join(f"word{i}" for i in range(50))
    chunks = _chunk(text, chunk_size=20, overlap=5)
    assert len(chunks) > 1
    assert all(chunk.strip() for chunk in chunks)


def test_chunk_returns_empty_list_for_blank_text():
    assert _chunk("   ") == []


def test_citation_formatting_round_trip():
    chunks = [
        RetrievedChunk(text="Fever is a common sign of infection.", source="fever.md", score=0.91),
        RetrievedChunk(text="Rest and fluids are typically recommended.", source="fever.md", score=0.82),
    ]
    citations = chunks_to_citations(chunks)
    assert len(citations) == 2
    assert citations[0].source == "fever.md"

    context_block = format_context_block(chunks)
    assert "fever.md" in context_block

    footer = format_citations_footer(citations)
    assert "Sources:" in footer
    assert "fever.md" in footer


def test_format_helpers_handle_empty_input():
    assert format_context_block([]) == ""
    assert format_citations_footer([]) == ""


@pytest.mark.slow
def test_ingest_and_retrieve_round_trip(tmp_path, monkeypatch):
    from src.rag import ingest, retriever

    knowledge_dir = tmp_path / "knowledge"
    knowledge_dir.mkdir()
    (knowledge_dir / "sleep.md").write_text(
        "Adults generally need seven to nine hours of sleep per night for good health.",
        encoding="utf-8",
    )

    monkeypatch.setattr(retriever, "_client", None)
    monkeypatch.setattr(retriever, "_embedding_fn", None)
    monkeypatch.setattr(
        retriever,
        "_get_client",
        lambda: chromadb.EphemeralClient(),
    )

    chunk_count = ingest.ingest_directory(knowledge_dir)
    assert chunk_count > 0

    results = retriever.Retriever(top_k=1).retrieve("how much sleep do adults need")
    assert results
    assert "sleep" in results[0].text.lower()
