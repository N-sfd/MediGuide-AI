import chromadb
from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction

from src.config import CONFIG
from src.schemas import RetrievedChunk

COLLECTION_NAME = "mediguide_knowledge"

_client: chromadb.ClientAPI | None = None
_embedding_fn = None


def _get_client() -> chromadb.ClientAPI:
    global _client
    if _client is None:
        CONFIG.vector_store_dir.mkdir(parents=True, exist_ok=True)
        _client = chromadb.PersistentClient(path=str(CONFIG.vector_store_dir))
    return _client


def _get_embedding_fn():
    global _embedding_fn
    if _embedding_fn is None:
        _embedding_fn = SentenceTransformerEmbeddingFunction(model_name=CONFIG.embedding_model)
    return _embedding_fn


def get_collection():
    return _get_client().get_or_create_collection(
        name=COLLECTION_NAME, embedding_function=_get_embedding_fn()
    )


class Retriever:
    def __init__(self, top_k: int = 4):
        self.top_k = top_k
        self.collection = get_collection()

    def retrieve(self, query: str, top_k: int | None = None) -> list[RetrievedChunk]:
        if self.collection.count() == 0:
            return []

        n_results = min(top_k or self.top_k, self.collection.count())
        results = self.collection.query(query_texts=[query], n_results=n_results)

        chunks: list[RetrievedChunk] = []
        documents = results.get("documents") or [[]]
        metadatas = results.get("metadatas") or [[]]
        distances = results.get("distances") or [[]]
        for text, metadata, distance in zip(documents[0], metadatas[0], distances[0]):
            chunks.append(
                RetrievedChunk(
                    text=text,
                    source=(metadata or {}).get("source", "unknown"),
                    score=1.0 - distance,
                )
            )
        return chunks
