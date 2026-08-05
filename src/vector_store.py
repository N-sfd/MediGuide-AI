import chromadb

from src.config import (
    CHROMA_COLLECTION_NAME,
    VECTOR_STORE_DIR,
)


def get_chroma_collection():
    VECTOR_STORE_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    client = chromadb.PersistentClient(
        path=str(VECTOR_STORE_DIR)
    )

    return client.get_or_create_collection(
        name=CHROMA_COLLECTION_NAME,
        metadata={
            "description": (
                "Approved patient-education medical sources"
            )
        },
    )
