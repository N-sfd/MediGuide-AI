from src.vector_store import get_chroma_collection


def main() -> None:
    collection = get_chroma_collection()
    print(f"Count: {collection.count()}")


if __name__ == "__main__":
    main()
