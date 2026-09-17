"""Splits radiology report text into named sections.

Purely mechanical text splitting — this module never interprets, summarizes,
or diagnoses. A section's text is exactly the report's own wording between
one recognized header and the next. If no recognized headers are found, the
caller gets an empty result rather than a guessed section, since a wrong
guess (e.g. calling the whole report "Findings") is worse than nothing —
every extracted section is reviewed by the user before it is used anywhere.
"""

from __future__ import annotations

import re

SECTION_TYPES = [
    "exam",
    "clinical_history",
    "technique",
    "comparison",
    "findings",
    "impression",
    "recommendations",
]

_SECTION_HEADER_PATTERNS: dict[str, list[str]] = {
    "exam": [r"exam(?:ination)?"],
    "clinical_history": [r"clinical\s+history", r"history"],
    "technique": [r"technique"],
    "comparison": [r"comparison"],
    "findings": [r"findings"],
    "impression": [r"impression", r"conclusion"],
    "recommendations": [r"recommendations?"],
}

_HEADER_ALTERNATION = "|".join(
    f"(?P<{section}>{'|'.join(patterns)})"
    for section, patterns in _SECTION_HEADER_PATTERNS.items()
)
_HEADER_PATTERN = re.compile(
    rf"^[ \t]*(?:{_HEADER_ALTERNATION})[ \t]*:?[ \t]*",
    re.IGNORECASE | re.MULTILINE,
)


def split_report_sections(text: str) -> dict[str, str]:
    """Returns {section_type: verbatim text} for every recognized header
    found in ``text``. Only known radiology-report headers (see
    SECTION_TYPES) are recognized; everything else is left for the human
    reviewer to add manually rather than guessed at."""
    if not text or not text.strip():
        return {}

    matches = list(_HEADER_PATTERN.finditer(text))
    if not matches:
        return {}

    sections: dict[str, str] = {}
    for index, match in enumerate(matches):
        section_type = next(name for name, value in match.groupdict().items() if value)
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        content = text[start:end].strip()
        if not content:
            continue
        # A section type appearing more than once (rare, e.g. an addendum)
        # keeps its first, primary occurrence rather than being overwritten.
        if section_type not in sections:
            sections[section_type] = content

    return sections
