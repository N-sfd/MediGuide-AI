from src.retriever import retrieve_chunks


def main() -> None:
    queries = [
        "What is blood pressure?",
        "What do systolic and diastolic blood pressure mean?",
        "What is hemoglobin?",
        "What is amoxicillin?",
    ]
    for query in queries:
        print(f"=== {query}")
        results = retrieve_chunks(query)
        if not results:
            print("No results\n")
            continue
        for result in results[:3]:
            print(result.distance)
            print(result.metadata.get("title"))
            print(result.text[:300])
            print()


if __name__ == "__main__":
    main()
