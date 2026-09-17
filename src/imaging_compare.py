"""Textual, source-grounded comparison of two report sections.

Buckets sentences as present-in-both / newly-mentioned / no-longer-mentioned
using normalized string similarity — never a semantic or clinical judgment.
This module must never characterize a change as "improved", "worsened",
"progression", or similar; every bucketed sentence is a verbatim quote from
one of the two reports.
"""

from __future__ import annotations

import difflib
import re

_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+")

DEFAULT_SIMILARITY_THRESHOLD = 0.85


def _split_sentences(text: str) -> list[str]:
    if not text or not text.strip():
        return []
    pieces = _SENTENCE_SPLIT.split(text.strip())
    return [piece.strip() for piece in pieces if piece.strip()]


def _normalize(sentence: str) -> str:
    return re.sub(r"\s+", " ", sentence.strip().lower()).rstrip(".")


def compare_section_text(
    earlier_text: str,
    later_text: str,
    *,
    similarity_threshold: float = DEFAULT_SIMILARITY_THRESHOLD,
) -> dict[str, list[str]]:
    """Compares one section's text across two reports.

    Returns a dict with three verbatim-sentence lists:
    - ``present_in_both``: sentences the later report shares with the earlier one.
    - ``newly_mentioned``: sentences only the later report has.
    - ``no_longer_mentioned``: sentences only the earlier report had.
    """
    earlier_sentences = _split_sentences(earlier_text)
    later_sentences = _split_sentences(later_text)

    earlier_remaining = list(earlier_sentences)
    present_in_both: list[str] = []
    newly_mentioned: list[str] = []

    for later_sentence in later_sentences:
        normalized_later = _normalize(later_sentence)
        best_match: str | None = None
        best_ratio = 0.0
        for candidate in earlier_remaining:
            ratio = difflib.SequenceMatcher(
                None, normalized_later, _normalize(candidate)
            ).ratio()
            if ratio > best_ratio:
                best_ratio = ratio
                best_match = candidate

        if best_match is not None and best_ratio >= similarity_threshold:
            present_in_both.append(later_sentence)
            earlier_remaining.remove(best_match)
        else:
            newly_mentioned.append(later_sentence)

    return {
        "present_in_both": present_in_both,
        "newly_mentioned": newly_mentioned,
        "no_longer_mentioned": earlier_remaining,
    }
