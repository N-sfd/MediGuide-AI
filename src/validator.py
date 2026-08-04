import re
from dataclasses import dataclass


@dataclass(frozen=True)
class ValidationResult:
    is_valid: bool
    violations: tuple[str, ...]


PROHIBITED_PATTERNS: dict[str, str] = {
    "definitive diagnosis": (
        r"\b(you definitely have|you certainly have|you have been diagnosed with)\b"
    ),
    "stop medication instruction": (
        r"\b(stop taking|discontinue|quit taking) (?:your |the )?(?:medication|medicine|drug)\b"
    ),
    "dose change instruction": (
        r"\b(double your dose|increase your dose|reduce your dose|take \d+ (?:mg|tablets?|pills?))\b"
    ),
    "false reassurance": (
        r"\b(no need to see (?:a |your )?doctor|completely safe|nothing to worry about)\b"
    ),
}


def validate_response(response: str) -> ValidationResult:
    """Block several high-risk response patterns before display."""
    normalized = " ".join(response.lower().split())
    violations = tuple(
        label
        for label, pattern in PROHIBITED_PATTERNS.items()
        if re.search(pattern, normalized)
    )
    return ValidationResult(not violations, violations)
