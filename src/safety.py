import re
from dataclasses import dataclass


@dataclass(frozen=True)
class SafetyResult:
    is_emergency: bool
    matched_signals: tuple[str, ...]
    message: str | None = None


EMERGENCY_PATTERNS: dict[str, str] = {
    "severe chest symptoms": (
        r"\b(crushing chest pain|severe chest pain|pressure in (?:my|the) chest)\b"
    ),
    "breathing emergency": (
        r"\b(cannot breathe|can't breathe|severe trouble breathing|stopped breathing)\b"
    ),
    "possible stroke": (
        r"\b(face drooping|one[- ]sided weakness|slurred speech|sudden paralysis)\b"
    ),
    "uncontrolled bleeding": (
        r"\b(bleeding won't stop|uncontrolled bleeding|severe bleeding)\b"
    ),
    "unconsciousness": (
        r"\b(unconscious|not waking up|won't wake up|unresponsive)\b"
    ),
    "possible overdose or poisoning": (
        r"\b(overdose|took too many pills|swallowed too much medicine|poisoned)\b"
    ),
    "severe allergic reaction": (
        r"\b(throat is closing|tongue swelling|severe allergic reaction|anaphylaxis)\b"
    ),
}


def check_for_emergency(text: str) -> SafetyResult:
    """Perform a deterministic first-pass emergency phrase check."""
    normalized = " ".join(text.lower().split())
    matches = tuple(
        label
        for label, pattern in EMERGENCY_PATTERNS.items()
        if re.search(pattern, normalized)
    )

    if matches:
        return SafetyResult(
            is_emergency=True,
            matched_signals=matches,
            message=(
                "This may be a medical emergency. Call 911 or your local emergency "
                "number now. Do not wait for this chatbot to assess the situation. "
                "Follow the dispatcher’s instructions."
            ),
        )

    return SafetyResult(False, ())
