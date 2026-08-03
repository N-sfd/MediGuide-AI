import re

_PATTERNS = {
    "email": re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b"),
    "phone": re.compile(r"\b(?:\+?\d{1,2}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b"),
    "ssn": re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),
    "mrn": re.compile(r"\bMRN[:\s]*\d{4,}\b", re.IGNORECASE),
    "dob": re.compile(r"\b\d{1,2}/\d{1,2}/\d{2,4}\b"),
}


def redact(text: str) -> str:
    redacted = text
    for label, pattern in _PATTERNS.items():
        redacted = pattern.sub(f"[REDACTED_{label.upper()}]", redacted)
    return redacted


def redact_for_logging(*fields: str) -> tuple[str, ...]:
    return tuple(redact(field) for field in fields)
