from src import retriever as retriever_module
from src.retriever import diversify_results


class FakeEmbeddingService:
    def __init__(self, *args, **kwargs) -> None:
        pass

    def embed_query(self, query: str) -> list[float]:
        return [0.1, 0.2, 0.3]


class FakeCollection:
    def __init__(self, results: dict) -> None:
        self._results = results

    def query(self, query_embeddings, n_results, include):
        return self._results


def _make_results(
    ids: list[str],
    documents: list[str],
    metadatas: list[dict],
    distances: list[float],
) -> dict:
    return {
        "ids": [ids],
        "documents": [documents],
        "metadatas": [metadatas],
        "distances": [distances],
    }


def test_empty_query_returns_no_results() -> None:
    assert retriever_module.retrieve_chunks("") == []
    assert retriever_module.retrieve_chunks("   ") == []


def test_relevant_chunks_are_returned(monkeypatch) -> None:
    results = _make_results(
        ids=["c1"],
        documents=["Blood pressure passage."],
        metadatas=[{"source_id": "doc-a", "title": "BP"}],
        distances=[0.2],
    )

    monkeypatch.setattr(
        retriever_module, "OllamaEmbeddingService", FakeEmbeddingService
    )
    monkeypatch.setattr(
        retriever_module,
        "get_chroma_collection",
        lambda: FakeCollection(results),
    )

    retrieved = retriever_module.retrieve_chunks("What is blood pressure?")

    assert len(retrieved) == 1
    assert retrieved[0].chunk_id == "c1"
    assert retrieved[0].text == "Blood pressure passage."


def test_high_distance_chunks_are_filtered(monkeypatch) -> None:
    results = _make_results(
        ids=["c1", "c2"],
        documents=["Relevant passage.", "Irrelevant passage."],
        metadatas=[{"source_id": "doc-a"}, {"source_id": "doc-b"}],
        distances=[0.2, 0.9],
    )

    monkeypatch.setattr(
        retriever_module, "OllamaEmbeddingService", FakeEmbeddingService
    )
    monkeypatch.setattr(
        retriever_module,
        "get_chroma_collection",
        lambda: FakeCollection(results),
    )

    retrieved = retriever_module.retrieve_chunks("query")

    assert len(retrieved) == 1
    assert retrieved[0].chunk_id == "c1"


def test_duplicate_source_limits_work(monkeypatch) -> None:
    results = _make_results(
        ids=["a1", "a2", "a3", "b1"],
        documents=["t1", "t2", "t3", "t4"],
        metadatas=[
            {"source_id": "doc-a"},
            {"source_id": "doc-a"},
            {"source_id": "doc-a"},
            {"source_id": "doc-b"},
        ],
        distances=[0.1, 0.2, 0.3, 0.4],
    )

    monkeypatch.setattr(
        retriever_module, "OllamaEmbeddingService", FakeEmbeddingService
    )
    monkeypatch.setattr(
        retriever_module,
        "get_chroma_collection",
        lambda: FakeCollection(results),
    )

    retrieved = retriever_module.retrieve_chunks("query")
    diversified = diversify_results(retrieved, maximum_per_source=2)

    assert [chunk.chunk_id for chunk in diversified] == ["a1", "a2", "b1"]


def test_metadata_remains_attached(monkeypatch) -> None:
    results = _make_results(
        ids=["c1"],
        documents=["passage"],
        metadatas=[
            {
                "source_id": "doc-a",
                "title": "Title A",
                "publisher": "Publisher A",
            }
        ],
        distances=[0.1],
    )

    monkeypatch.setattr(
        retriever_module, "OllamaEmbeddingService", FakeEmbeddingService
    )
    monkeypatch.setattr(
        retriever_module,
        "get_chroma_collection",
        lambda: FakeCollection(results),
    )

    retrieved = retriever_module.retrieve_chunks("query")

    assert retrieved[0].metadata["title"] == "Title A"
    assert retrieved[0].metadata["publisher"] == "Publisher A"


def test_results_are_ordered_by_relevance(monkeypatch) -> None:
    results = _make_results(
        ids=["c1", "c2", "c3"],
        documents=["t1", "t2", "t3"],
        metadatas=[
            {"source_id": "doc-a"},
            {"source_id": "doc-b"},
            {"source_id": "doc-c"},
        ],
        distances=[0.1, 0.25, 0.4],
    )

    monkeypatch.setattr(
        retriever_module, "OllamaEmbeddingService", FakeEmbeddingService
    )
    monkeypatch.setattr(
        retriever_module,
        "get_chroma_collection",
        lambda: FakeCollection(results),
    )

    retrieved = retriever_module.retrieve_chunks("query")

    assert [chunk.chunk_id for chunk in retrieved] == ["c1", "c2", "c3"]
    assert [chunk.distance for chunk in retrieved] == [0.1, 0.25, 0.4]
