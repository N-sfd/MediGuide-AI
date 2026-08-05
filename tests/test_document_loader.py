import json
from pathlib import Path

import pytest

from src.document_loader import (
    load_source_document,
)


def test_txt_document_loads(
    tmp_path: Path,
) -> None:
    document = tmp_path / "sample.txt"
    metadata = tmp_path / "sample.json"

    document.write_text(
        "Blood pressure is measured using two values.",
        encoding="utf-8",
    )

    metadata.write_text(
        json.dumps(
            {
                "source_id": "test-001",
                "title": "Blood Pressure Basics",
                "publisher": "Test Health Agency",
                "source_url": "https://example.org",
                "publication_date": "2026-01-01",
                "review_date": "2026-08-04",
                "document_type": "patient_education",
                "approved": True,
            }
        ),
        encoding="utf-8",
    )

    result = load_source_document(document)

    assert result.source_id == "test-001"
    assert "Blood pressure" in result.text


def test_unapproved_source_is_rejected(
    tmp_path: Path,
) -> None:
    document = tmp_path / "sample.txt"
    metadata = tmp_path / "sample.json"

    document.write_text(
        "Example",
        encoding="utf-8",
    )

    metadata.write_text(
        json.dumps(
            {
                "source_id": "test-002",
                "title": "Unapproved",
                "publisher": "Unknown",
                "approved": False,
            }
        ),
        encoding="utf-8",
    )

    with pytest.raises(ValueError):
        load_source_document(document)
