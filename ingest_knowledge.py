from src.config import KNOWLEDGE_DIR
from src.ingest import ingest_directory


def main() -> None:
    print(
        f"Ingesting approved documents from: "
        f"{KNOWLEDGE_DIR}"
    )

    results = ingest_directory(KNOWLEDGE_DIR)

    total_chunks = sum(results.values())

    for filename, chunk_count in results.items():
        print(
            f"{filename}: {chunk_count} chunks"
        )

    print(
        f"Completed ingestion: {total_chunks} chunks"
    )


if __name__ == "__main__":
    main()
