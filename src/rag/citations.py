from src.schemas import Citation, RetrievedChunk


def chunks_to_citations(chunks: list[RetrievedChunk], snippet_len: int = 180) -> list[Citation]:
    citations = []
    for chunk in chunks:
        snippet = chunk.text.strip().replace("\n", " ")
        if len(snippet) > snippet_len:
            snippet = snippet[:snippet_len].rsplit(" ", 1)[0] + "…"
        citations.append(Citation(source=chunk.source, snippet=snippet, score=round(chunk.score, 3)))
    return citations


def format_context_block(chunks: list[RetrievedChunk]) -> str:
    if not chunks:
        return ""

    lines = ["Reference material (cite by source name when used):"]
    for i, chunk in enumerate(chunks, start=1):
        lines.append(f"[{i}] Source: {chunk.source}\n{chunk.text.strip()}")
    return "\n\n".join(lines)


def format_citations_footer(citations: list[Citation]) -> str:
    if not citations:
        return ""

    lines = ["Sources:"]
    for i, citation in enumerate(citations, start=1):
        lines.append(f"[{i}] {citation.source} — \"{citation.snippet}\"")
    return "\n".join(lines)
