"""Progressive safety HTML cards for MediGuide answers."""

from __future__ import annotations

import re

GLOBAL_NOTICE_HTML = (
    '<div class="mg-global-notice" role="note">'
    "Educational AI • Not for emergencies or diagnosis"
    "</div>"
)

_DIAGNOSIS_RE = re.compile(
    r"\b(?:diagnos(?:e|is|ing)|do\s+i\s+have|what\s+disease)\b",
    re.IGNORECASE,
)


def emergency_card_html() -> str:
    """High-priority red card when an emergency is detected."""
    return """
<div class="mg-safety-card mg-emergency-card" role="alert">
  <h3 class="mg-safety-title">This may be a medical emergency</h3>
  <p class="mg-safety-body">
    Call 911 or your local emergency number now.
    Do not wait for MediGuide to evaluate the situation.
  </p>
  <a href="tel:911" class="mg-emergency-cta">Call 911</a>
</div>
""".strip()


def diagnosis_card_html() -> str:
    """Calm boundary when the user asks MediGuide to diagnose."""
    return """
<div class="mg-safety-card mg-diagnosis-card" role="status">
  <h3 class="mg-safety-title">MediGuide cannot diagnose a condition</h3>
  <p class="mg-safety-body">It can help you:</p>
  <ul class="mg-safety-list">
    <li>Organize the symptoms you noticed</li>
    <li>Understand general health information</li>
    <li>Prepare questions for a healthcare professional</li>
  </ul>
</div>
""".strip()


def low_evidence_card_html() -> str:
    """Shown when retrieval finds no trusted sources for the question."""
    return """
<div class="mg-safety-card mg-low-evidence-card" role="status">
  <h3 class="mg-safety-title">Not enough trusted information found</h3>
  <p class="mg-safety-body">
    MediGuide will not answer this question using unsupported model knowledge.
  </p>
</div>
""".strip()


def classify_answer_kind(question: str, answer: str) -> str:
    """Return emergency | diagnosis | low_evidence | normal from Q/A text."""
    answer_text = answer or ""
    question_text = question or ""

    if re.search(r"medical emergency|Call 911", answer_text, re.IGNORECASE):
        return "emergency"
    if _DIAGNOSIS_RE.search(question_text):
        return "diagnosis"
    if re.search(
        r"could not find sufficiently relevant|unsupported model knowledge|Not enough trusted",
        answer_text,
        re.IGNORECASE,
    ):
        return "low_evidence"
    return "normal"
