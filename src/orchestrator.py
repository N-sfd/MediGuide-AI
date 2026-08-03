from typing import Any

from src.models.text_model import generate_text_response
from src.models.vision_model import describe_image
from src.safety.emergency import check_emergency

VISION_DISCLAIMER = (
    "**Important:** This is a general-purpose description of what's visible in "
    "the image, not a validated clinical interpretation. A licensed professional "
    "should review the original document or image directly."
)


def process_message(
    message: str,
    history: list[dict[str, Any]] | None = None,
) -> str:
    if not message or not message.strip():
        return "Please enter a question."

    safety_result = check_emergency(message)

    if safety_result.is_emergency:
        return safety_result.response or "Seek emergency help immediately."

    answer = generate_text_response(
        user_message=message,
        history=history,
    )

    return (
        f"{answer}\n\n"
        "---\n"
        "**Important:** This is general educational information, not a "
        "diagnosis or treatment recommendation."
    )


def process_image(
    image_path: str,
    question: str | None = None,
) -> str:
    if not image_path or not image_path.strip():
        return "Please attach an image to analyze."

    if question and question.strip():
        safety_result = check_emergency(question)
        if safety_result.is_emergency:
            return safety_result.response or "Seek emergency help immediately."

        answer = describe_image(image_path, user_prompt=question.strip())
    else:
        answer = describe_image(image_path)

    return f"{answer}\n\n---\n{VISION_DISCLAIMER}"