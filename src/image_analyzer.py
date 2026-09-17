from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from ollama import Client, ResponseError

from src.config import (
    OLLAMA_HOST,
    OLLAMA_TIMEOUT_SECONDS,
    VISION_MODEL_NAME,
)
from src.image_safety import check_image_request
from src.image_validator import validate_image_file
from src.prompts import MEDICAL_VISION_PROMPT


@dataclass(frozen=True)
class ImageAnalysisResult:
    success: bool
    raw_text: str = ""
    structured_data: dict[str, Any] | None = None
    error: str | None = None


JSON_SCHEMA_INSTRUCTION = """
Return valid JSON only using this structure:

{
  "document_type": "",
  "visible_text": [
    {
      "field": "",
      "value": "",
      "confidence": "clearly_visible"
    }
  ],
  "uncertain_text": [
    {
      "field": "",
      "value": "",
      "confidence": "uncertain"
    }
  ],
  "unreadable_areas": [],
  "general_explanation": "",
  "questions_for_professional": [],
  "limitations": []
}

Allowed confidence values:
- clearly_visible
- partially_visible
- uncertain
- not_visible
"""


def analyze_medical_document_image(
    image_path: str | None,
    user_question: str,
) -> ImageAnalysisResult:
    validation = validate_image_file(image_path)

    if not validation.valid or not validation.path:
        return ImageAnalysisResult(
            success=False,
            error=validation.error,
        )

    scope = check_image_request(user_question)

    if not scope.allowed:
        return ImageAnalysisResult(
            success=False,
            error=scope.reason,
        )

    question = (
        user_question.strip()
        if user_question and user_question.strip()
        else "Extract and organize only the clearly visible information."
    )

    prompt = (
        f"{MEDICAL_VISION_PROMPT}\n\n"
        f"{JSON_SCHEMA_INSTRUCTION}\n\n"
        f"User request: {question}"
    )

    client = Client(host=OLLAMA_HOST, timeout=OLLAMA_TIMEOUT_SECONDS)

    try:
        response = client.chat(
            model=VISION_MODEL_NAME,
            messages=[
                {
                    "role": "user",
                    "content": prompt,
                    "images": [str(validation.path)],
                }
            ],
            options={
                "temperature": 0.1,
            },
        )

        raw_text = response.message.content.strip()

        if not raw_text:
            return ImageAnalysisResult(
                success=False,
                error="The vision model returned an empty response.",
            )

        structured_data = parse_json_response(raw_text)

        if structured_data is None:
            return ImageAnalysisResult(
                success=False,
                raw_text=raw_text,
                error=(
                    "The model did not return valid structured JSON. "
                    "Try the analysis again."
                ),
            )

        return ImageAnalysisResult(
            success=True,
            raw_text=raw_text,
            structured_data=structured_data,
        )

    except ResponseError as error:
        if error.status_code == 404:
            return ImageAnalysisResult(
                success=False,
                error=(
                    f"The vision model `{VISION_MODEL_NAME}` is not "
                    f"installed. Run `ollama pull {VISION_MODEL_NAME}`."
                ),
            )

        return ImageAnalysisResult(
            success=False,
            error=f"Ollama returned an error: {error.error}",
        )

    except (ConnectionError, OSError):
        return ImageAnalysisResult(
            success=False,
            error=(
                "MediGuide could not connect to Ollama. "
                "Confirm that Ollama is running."
            ),
        )

    except Exception as error:
        return ImageAnalysisResult(
            success=False,
            error=(
                "Image analysis failed. "
                f"Technical detail: {type(error).__name__}: {error}"
            ),
        )


def parse_json_response(
    raw_text: str,
) -> dict[str, Any] | None:
    cleaned = raw_text.strip()

    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]

    if cleaned.startswith("```"):
        cleaned = cleaned[3:]

    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]

    cleaned = cleaned.strip()

    try:
        parsed = json.loads(cleaned)

        if not isinstance(parsed, dict):
            return None

        return parsed

    except json.JSONDecodeError:
        return None


def format_extraction_for_review(
    data: dict[str, Any],
) -> str:
    lines: list[str] = []

    document_type = data.get(
        "document_type",
        "Unknown document",
    )

    lines.append(
        f"Document type: {document_type}"
    )
    lines.append("")
    lines.append("Visible information:")

    visible_items = data.get(
        "visible_text",
        [],
    )

    if not visible_items:
        lines.append("- No clearly visible fields found.")

    for item in visible_items:
        field = item.get("field", "Unknown field")
        value = item.get("value", "")
        confidence = item.get(
            "confidence",
            "uncertain",
        )

        lines.append(
            f"- {field}: {value} [{confidence}]"
        )

    uncertain_items = data.get(
        "uncertain_text",
        [],
    )

    if uncertain_items:
        lines.append("")
        lines.append("Uncertain information:")

        for item in uncertain_items:
            field = item.get("field", "Unknown field")
            value = item.get("value", "")
            confidence = item.get(
                "confidence",
                "uncertain",
            )

            lines.append(
                f"- {field}: {value} [{confidence}]"
            )

    unreadable = data.get(
        "unreadable_areas",
        [],
    )

    if unreadable:
        lines.append("")
        lines.append("Unreadable areas:")

        for item in unreadable:
            lines.append(f"- {item}")

    explanation = data.get(
        "general_explanation",
        "",
    )

    if explanation:
        lines.append("")
        lines.append("General explanation:")
        lines.append(explanation)

    limitations = data.get(
        "limitations",
        [],
    )

    if limitations:
        lines.append("")
        lines.append("Limitations:")

        for limitation in limitations:
            lines.append(f"- {limitation}")

    return "\n".join(lines)