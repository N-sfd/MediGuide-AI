from typing import Any

from ollama import Client, ResponseError

from src.config import (
    MAX_HISTORY_MESSAGES,
    MODEL_NAME,
    OLLAMA_HOST,
    TEMPERATURE,
)
from src.prompts import MEDICAL_SYSTEM_PROMPT
from src.safety import check_for_emergency
from src.validator import validate_response


SAFETY_REMINDER = (
    "**Safety reminder:** This is general educational information, not a "
    "diagnosis or personalized treatment recommendation."
)

SAFE_FALLBACK = (
    "I cannot safely provide that response. I can explain the topic generally "
    "or help you prepare questions for a qualified healthcare professional."
)


def _content_to_text(content: Any) -> str | None:
    """Extract plain text from Gradio message content."""
    if isinstance(content, str):
        return content.strip() or None
    return None


def format_history(
    history: list[dict[str, Any]] | None,
) -> list[dict[str, str]]:
    """Convert recent Gradio history into Ollama chat messages."""
    if not history:
        return []

    formatted: list[dict[str, str]] = []

    for item in history[-MAX_HISTORY_MESSAGES:]:
        role = item.get("role")
        content = _content_to_text(item.get("content"))

        if role in {"user", "assistant"} and content:
            formatted.append({"role": role, "content": content})

    return formatted


def generate_response(
    user_message: str,
    history: list[dict[str, Any]] | None = None,
) -> str:
    """Run emergency checks, call Ollama, validate, and return the answer."""
    if not user_message or not user_message.strip():
        return "Please enter a general health-education question."

    clean_message = user_message.strip()
    emergency = check_for_emergency(clean_message)

    if emergency.is_emergency:
        return emergency.message or (
            "Call 911 or your local emergency number immediately."
        )

    messages: list[dict[str, str]] = [
        {"role": "system", "content": MEDICAL_SYSTEM_PROMPT},
        *format_history(history),
        {"role": "user", "content": clean_message},
    ]

    client = Client(host=OLLAMA_HOST)

    try:
        response = client.chat(
            model=MODEL_NAME,
            messages=messages,
            options={"temperature": TEMPERATURE},
        )
        answer = response.message.content.strip()

    except ResponseError as error:
        if error.status_code == 404:
            return (
                f"The model `{MODEL_NAME}` is not installed. Run:\n\n"
                f"`ollama pull {MODEL_NAME}`"
            )
        return f"Ollama returned an error: {error.error}"

    except (ConnectionError, OSError):
        return (
            "MediGuide could not reach Ollama. Start Ollama, then verify it with "
            "`ollama list` and restart this application."
        )

    except Exception as error:
        return f"Unexpected local-model error: {type(error).__name__}: {error}"

    if not answer:
        return "The local model returned an empty response. Please try again."

    validation = validate_response(answer)

    if not validation.is_valid:
        return SAFE_FALLBACK

    return f"{answer}\n\n---\n{SAFETY_REMINDER}"
