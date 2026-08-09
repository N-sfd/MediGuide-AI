from collections.abc import Iterator
from typing import Any

from ollama import Client

from src.chatbot import (
    SAFETY_REMINDER,
    format_history,
)
from src.citations import (
    CitationSource,
    build_citation_sources,
    build_source_number_map,
    find_citation_numbers,
    format_evidence_context,
    format_source_list,
    validate_citation_numbers,
)
from src.config import (
    MODEL_NAME,
    OLLAMA_HOST,
    RAG_MAX_OUTPUT_TOKENS,
    RAG_MAX_PASSAGE_WORDS,
    TEMPERATURE,
)
from src.prompts import RAG_MEDICAL_SYSTEM_PROMPT
from src.retriever import (
    diversify_results,
    retrieve_chunks,
)
from src.safety import check_for_emergency
from src.validator import validate_response


ANSWER_DETAIL_INSTRUCTIONS = {
    "Concise": (
        "Answer briefly: one to two sentences per section. Omit any "
        "section that would only restate a point already made."
    ),
    "Detailed": (
        "Provide thorough detail in each section, including relevant "
        "nuances, and note any caveats present in the evidence."
    ),
}

READING_LEVEL_INSTRUCTIONS = {
    "Plain": (
        "Use plain, everyday language at roughly a sixth-grade reading "
        "level. Avoid medical jargon; when a medical term is necessary, "
        "briefly define it in parentheses the first time it appears."
    ),
}


def _prepare_generation(
    user_message: str,
    history: list[dict[str, Any]] | None,
    *,
    answer_detail: str = "Standard",
    reading_level: str = "Standard",
) -> tuple[str, list[dict[str, Any]] | None, list[CitationSource] | None]:
    """Runs the pre-generation pipeline.

    Returns ("early", answer, None) if a final answer can already be
    given without calling the model, otherwise
    ("ready", messages, sources).
    """
    if not user_message or not user_message.strip():
        return "early", "Please enter a health-education question.", None

    clean_message = user_message.strip()

    emergency = check_for_emergency(clean_message)

    if emergency.is_emergency:
        return (
            "early",
            emergency.message or "Call emergency services immediately.",
            None,
        )

    try:
        retrieved = retrieve_chunks(clean_message)
        retrieved = diversify_results(retrieved)
    except Exception as error:
        return (
            "early",
            "MediGuide could not search the approved knowledge base.\n\n"
            f"Technical detail: {type(error).__name__}: {error}",
            None,
        )

    if not retrieved:
        return (
            "early",
            "Not enough trusted information found.\n\n"
            "MediGuide will not answer this question using unsupported "
            "model knowledge.\n\n"
            "Consider asking a qualified healthcare professional or "
            "adding an approved source covering this topic.\n\n"
            "---\n"
            f"{SAFETY_REMINDER}",
            None,
        )

    sources = build_citation_sources(retrieved)
    source_map = build_source_number_map(sources)

    evidence_context = format_evidence_context(
        retrieved,
        source_map,
        max_words_per_passage=RAG_MAX_PASSAGE_WORDS,
    )

    valid_source_numbers = sorted(
        source.number for source in sources
    )

    style_instructions = " ".join(
        instruction
        for instruction in (
            ANSWER_DETAIL_INSTRUCTIONS.get(answer_detail),
            READING_LEVEL_INSTRUCTIONS.get(reading_level),
        )
        if instruction
    )

    user_prompt = f"""
USER QUESTION

{clean_message}

APPROVED EVIDENCE

{evidence_context}

The only valid citation numbers for this answer are:
{valid_source_numbers}

Write a patient-education answer using only this evidence.

Use these exact headings in order:
## General explanation
## What this means
## What MediGuide cannot determine
## Questions to ask a healthcare professional
## When to seek professional care

Cite factual statements with valid numbers such as
[{valid_source_numbers[0]}]. Do not invent citations. Do not write a
Sources section. Keep sections short — not one large paragraph. If the
evidence cannot fully answer the question, say what remains unknown in
"What MediGuide cannot determine".{(" " + style_instructions) if style_instructions else ""}
"""

    messages = [
        {
            "role": "system",
            "content": RAG_MEDICAL_SYSTEM_PROMPT,
        },
        *format_history(history),
        {
            "role": "user",
            "content": user_prompt,
        },
    ]

    return "ready", messages, sources


def _finalize_answer(
    answer: str,
    sources: list[CitationSource],
) -> str:
    valid_numbers = {
        source.number
        for source in sources
    }

    citations_valid, invalid_numbers = (
        validate_citation_numbers(
            answer,
            valid_numbers,
        )
    )

    if not citations_valid:
        return (
            "The model generated an invalid citation reference. "
            "The answer was withheld to prevent unsupported sourcing."
        )

    used_citations = find_citation_numbers(answer)

    if not used_citations:
        return (
            "The response did not include evidence citations, so it was "
            "withheld. Please try the question again."
        )

    validation = validate_response(answer)

    if not validation.is_valid:
        return (
            "The generated response failed the medical-safety check. "
            "Please rephrase the question or consult a qualified "
            "healthcare professional."
        )

    source_list = format_source_list(sources)

    return (
        f"{answer}\n\n"
        f"---\n"
        f"{source_list}\n\n"
        f"---\n"
        f"{SAFETY_REMINDER}"
    )


def stream_rag_response(
    user_message: str,
    history: list[dict[str, Any]] | None = None,
    *,
    answer_detail: str = "Standard",
    reading_level: str = "Standard",
) -> Iterator[str]:
    """Yields the answer as it is generated.

    Every yielded value before the last one is an unvalidated draft of
    the model's output, shown only so the wait does not feel frozen.
    The final yielded value is always the fully validated answer (or a
    withheld/error message), exactly as ``generate_rag_response``
    would return.
    """
    stage, payload, sources = _prepare_generation(
        user_message,
        history,
        answer_detail=answer_detail,
        reading_level=reading_level,
    )

    if stage == "early":
        yield payload
        return

    messages = payload
    client = Client(host=OLLAMA_HOST)
    accumulated = ""

    try:
        for chunk in client.chat(
            model=MODEL_NAME,
            messages=messages,
            options={
                "temperature": TEMPERATURE,
                "num_predict": RAG_MAX_OUTPUT_TOKENS,
            },
            stream=True,
        ):
            piece = chunk.message.content or ""

            if not piece:
                continue

            accumulated += piece
            yield accumulated

    except Exception as error:
        yield (
            "The evidence was retrieved, but the local model could "
            "not generate the answer.\n\n"
            f"Technical detail: {type(error).__name__}: {error}"
        )
        return

    yield _finalize_answer(accumulated.strip(), sources)


def generate_rag_response(
    user_message: str,
    history: list[dict[str, Any]] | None = None,
    *,
    answer_detail: str = "Standard",
    reading_level: str = "Standard",
) -> str:
    answer = "Please enter a health-education question."

    for answer in stream_rag_response(
        user_message,
        history,
        answer_detail=answer_detail,
        reading_level=reading_level,
    ):
        pass

    return answer
