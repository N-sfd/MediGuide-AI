from src.image_analyzer import (
    format_extraction_for_review,
    parse_json_response,
)


def test_valid_json_is_parsed() -> None:
    raw = """
    {
      "document_type": "lab report",
      "visible_text": [],
      "uncertain_text": [],
      "unreadable_areas": [],
      "general_explanation": "",
      "questions_for_professional": [],
      "limitations": []
    }
    """

    result = parse_json_response(raw)

    assert result is not None
    assert result["document_type"] == "lab report"


def test_markdown_json_is_parsed() -> None:
    raw = """```json
{
  "document_type": "medication label",
  "visible_text": [],
  "uncertain_text": [],
  "unreadable_areas": [],
  "general_explanation": "",
  "questions_for_professional": [],
  "limitations": []
}
```"""

    result = parse_json_response(raw)

    assert result is not None


def test_invalid_json_returns_none() -> None:
    result = parse_json_response(
        "This is not JSON."
    )

    assert result is None


def test_review_format_contains_fields() -> None:
    data = {
        "document_type": "medication label",
        "visible_text": [
            {
                "field": "Medication",
                "value": "ExampleMed",
                "confidence": "clearly_visible",
            }
        ],
        "uncertain_text": [],
        "unreadable_areas": [],
        "general_explanation": "Example explanation.",
        "limitations": [
            "The expiration date is not visible."
        ],
    }

    output = format_extraction_for_review(
        data
    )

    assert "Medication: ExampleMed" in output
    assert "medication label" in output
    assert "expiration date" in output
