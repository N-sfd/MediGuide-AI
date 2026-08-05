from typing import Any

from ollama import Client

from src.chatbot import (
    SAFETY_REMINDER,
    format_history,
)
from src.citations import (
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
    TEMPERATURE,
)
from src.prompts import RAG_MEDICAL_SYSTEM_PROMPT
from src.retriever import (
    diversify_results,
    retrieve_chunks,
)
from src.safety import check_for_emergency
from src.validator import validate_response


def generate_rag_response(
    user_message: str,
    history: list[dict[str, Any]] | None = None,
) -> str:
    if not user_message or not user_message.strip():
        return "Please enter a health-education question."

    clean_message = user_message.strip()

    emergency = check_for_emergency(clean_message)

    if emergency.is_emergency:
        return emergency.message or (
            "Call emergency services immediately."
        )

    try:
        retrieved = retrieve_chunks(clean_message)
        retrieved = diversify_results(retrieved)
    except Exception as error:
        return (
            "MediGuide could not search the approved knowledge base.\n\n"
            f"Technical detail: {type(error).__name__}: {error}"
        )

    if not retrieved:
        return (
            "I could not find sufficiently relevant information in the "
            "approved medical knowledge base. I should not answer this "
            "question from unsupported model knowledge.\n\n"
            "Consider asking a qualified healthcare professional or "
            "adding an approved source covering this topic.\n\n"
            "---\n"
            f"{SAFETY_REMINDER}"
        )

    sources = build_citation_sources(retrieved)
    source_map = build_source_number_map(sources)

    evidence_context = format_evidence_context(
        retrieved,
        source_map,
    )

    user_prompt = f"""
USER QUESTION

{clean_message}

APPROVED EVIDENCE

{evidence_context}

Write a clear patient-education answer using only this evidence.
Use inline citations such as [1] and [2]. If the evidence cannot
fully answer the question, explicitly state what remains unknown.
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

    client = Client(host=OLLAMA_HOST)

    try:
        response = client.chat(
            model=MODEL_NAME,
            messages=messages,
            options={
                "temperature": TEMPERATURE,
            },
        )

        answer = response.message.content.strip()

    except Exception as error:
        return (
            "The evidence was retrieved, but the local model could "
            "not generate the answer.\n\n"
            f"Technical detail: {type(error).__name__}: {error}"
        )

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
