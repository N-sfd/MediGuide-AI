from typing import Any

import ollama
from src.validator import validate_response
from src.prompts import MEDICAL_SYSTEM_PROMPT
from src.safety import check_for_emergency


MODEL_NAME = "gemma3:4b"


def format_history(
    history: list[dict[str, Any]] | None,
) -> list[dict[str, str]]:
    formatted_messages: list[dict[str, str]] = []

    if not history:
        return formatted_messages

    for item in history:
        role = item.get("role")
        content = item.get("content")

        if role not in {"user", "assistant"}:
            continue

        if not isinstance(content, str):
            continue

        formatted_messages.append(
            {
                "role": role,
                "content": content,
            }
        )

    return formatted_messages


def generate_response(
    user_message: str,
    history: list[dict[str, Any]] | None = None,
) -> str:
    if not user_message or not user_message.strip():
        return "Please enter a health-education question."

    safety_result = check_for_emergency(user_message)

    if safety_result.is_emergency:
        return safety_result.message or (
            "Call 911 or your local emergency number immediately."
        )

    messages: list[dict[str, str]] = [
        {
            "role": "system",
            "content": MEDICAL_SYSTEM_PROMPT,
        }
    ]

    messages.extend(format_history(history))

    messages.append(
        {
            "role": "user",
            "content": user_message.strip(),
        }
    )

    try:
        response = ollama.chat(
            model=MODEL_NAME,
            messages=messages,
            options={
                "temperature": 0.2,
            },
        )

        answer = response["message"]["content"].strip()
        is_valid, violations = validate_response(answer)

if not is_valid:
    return (
        "I cannot safely provide that response. I can offer general "
        "educational information or help you prepare questions for a "
        "qualified healthcare professional."
    )

        return (
            f"{answer}\n\n"
            "---\n"
            "**Safety reminder:** This is general educational information, "
            "not a diagnosis or personalized treatment recommendation."
        )

    except Exception as error:
        return (
            "I could not connect to the local AI model. Make sure Ollama is "
            f"running and that `{MODEL_NAME}` is installed.\n\n"
            f"Technical details: {error}"
        )