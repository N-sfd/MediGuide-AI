"""Backward-compatible lab observation schema for earlier stubs."""

from pydantic import BaseModel
from typing import Literal


class LabObservation(BaseModel):
    observation_id: str

    test_name: str
    normalized_test_name: str

    value: float | None
    value_text: str

    unit: str

    reference_low: float | None = None
    reference_high: float | None = None
    reference_text: str = ""

    report_date: str

    document_id: str
    document_name: str
    page_number: int

    field_id: str

    extraction_confidence: Literal[
        "clearly_visible",
        "needs_review",
        "could_not_read",
    ]

    user_confirmed: bool = False
    user_edited: bool = False
