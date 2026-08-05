import re
from dataclasses import dataclass

from src.schemas import RetrievedChunk


@dataclass(frozen=True)
class CitationSource:
    number: int
    source_id: str
    title: str
    publisher: str
    source_url: str
    publication_date: str
    review_date: str


def build_citation_sources(
    chunks: list[RetrievedChunk],
) -> list[CitationSource]:
    sources: list[CitationSource] = []
    seen_source_ids: set[str] = set()

    for chunk in chunks:
        source_id = str(
            chunk.metadata.get(
                "source_id",
                chunk.chunk_id,
            )
        )

        if source_id in seen_source_ids:
            continue

        seen_source_ids.add(source_id)

        sources.append(
            CitationSource(
                number=len(sources) + 1,
                source_id=source_id,
                title=str(
                    chunk.metadata.get(
                        "title",
                        "Untitled source",
                    )
                ),
                publisher=str(
                    chunk.metadata.get(
                        "publisher",
                        "Unknown publisher",
                    )
                ),
                source_url=str(
                    chunk.metadata.get(
                        "source_url",
                        "",
                    )
                ),
                publication_date=str(
                    chunk.metadata.get(
                        "publication_date",
                        "",
                    )
                ),
                review_date=str(
                    chunk.metadata.get(
                        "review_date",
                        "",
                    )
                ),
            )
        )

    return sources


def format_source_list(
    sources: list[CitationSource],
) -> str:
    if not sources:
        return (
            "### Sources\n"
            "No sufficiently relevant approved sources were found."
        )

    lines = ["### Sources"]

    for source in sources:
        details = [
            f"**[{source.number}] {source.title}**",
            source.publisher,
        ]

        if source.publication_date:
            details.append(
                f"Published: {source.publication_date}"
            )

        if source.review_date:
            details.append(
                f"Knowledge-base review: {source.review_date}"
            )

        if source.source_url:
            details.append(source.source_url)

        lines.append(" — ".join(details))

    return "\n\n".join(lines)


def build_source_number_map(
    sources: list[CitationSource],
) -> dict[str, int]:
    return {
        source.source_id: source.number
        for source in sources
    }


def format_evidence_context(
    chunks: list[RetrievedChunk],
    source_number_map: dict[str, int],
) -> str:
    evidence_sections: list[str] = []

    for chunk in chunks:
        source_id = str(
            chunk.metadata.get(
                "source_id",
                chunk.chunk_id,
            )
        )

        citation_number = source_number_map.get(
            source_id
        )

        evidence_sections.append(
            f"[Source {citation_number}]\n"
            f"Title: {chunk.metadata.get('title', '')}\n"
            f"Publisher: {chunk.metadata.get('publisher', '')}\n"
            f"Passage:\n{chunk.text}"
        )

    return "\n\n".join(evidence_sections)


def find_citation_numbers(
    answer: str,
) -> set[int]:
    return {
        int(number)
        for number in re.findall(
            r"\[(\d+)\]",
            answer,
        )
    }


def validate_citation_numbers(
    answer: str,
    valid_numbers: set[int],
) -> tuple[bool, set[int]]:
    used_numbers = find_citation_numbers(answer)
    invalid_numbers = (
        used_numbers - valid_numbers
    )

    return (
        len(invalid_numbers) == 0,
        invalid_numbers,
    )
