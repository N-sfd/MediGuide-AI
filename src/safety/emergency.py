import re
from dataclasses import dataclass


@dataclass
class SafetyResult:
    is_emergency: bool
    matched_signals: list[str]
    response: str | None = None


EMERGENCY_PATTERNS = {
    "chest pain": r"\b(chest pain|pressure in my chest|crushing chest pain)\b",
    "breathing emergency": r"\b(can't breathe|cannot breathe|severe trouble breathing)\b",
    "stroke warning": r"\b(face drooping|one-sided weakness|slurred speech)\b",
    "severe bleeding": r"\b(bleeding won't stop|severe bleeding|uncontrolled bleeding)\b",
    "unconsciousness": r"\b(unconscious|not waking up|passed out and won't wake)\b",
    "overdose": r"\b(overdose|took too many pills|poisoned)\b",
}


def check_emergency(text: str) -> SafetyResult:
    normalized = text.lower()
    matched: list[str] = []

    for label, pattern in EMERGENCY_PATTERNS.items():
        if re.search(pattern, normalized):
            matched.append(label)

    if matched:
        return SafetyResult(
            is_emergency=True,
            matched_signals=matched,
            response=(
                "This may be an emergency. Call 911 or your local emergency "
                "number now. Do not wait for this chatbot to assess the situation. "
                "If it is safe to do so, stay with the person and follow the "
                "dispatcher’s instructions."
            ),
        )

    return SafetyResult(
        is_emergency=False,
        matched_signals=[],
    )