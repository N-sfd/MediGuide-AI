from ollama import Client

from src.config import (
    EMBEDDING_MODEL_NAME,
    OLLAMA_HOST,
)


class OllamaEmbeddingService:
    def __init__(self) -> None:
        self.client = Client(host=OLLAMA_HOST)
        self.model = EMBEDDING_MODEL_NAME

    def embed_documents(
        self,
        texts: list[str],
    ) -> list[list[float]]:
        if not texts:
            return []

        response = self.client.embed(
            model=self.model,
            input=texts,
        )

        return response.embeddings

    def embed_query(
        self,
        query: str,
    ) -> list[float]:
        response = self.client.embed(
            model=self.model,
            input=query,
        )

        if not response.embeddings:
            raise RuntimeError(
                "Embedding model returned no vector."
            )

        return response.embeddings[0]
