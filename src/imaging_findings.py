"""Structured imaging finding extraction from radiology report sections.

Mechanical splitting and curated concept matching only — never invents
anatomy, laterality, or diagnoses that are not supported by the report text.
"""

from __future__ import annotations

import re
from typing import Any

FINDING_EXTRACTOR_VERSION = "imaging-findings-v1"

# Curated concept matches — only applied when keywords appear in the finding text.
_CONCEPT_RULES: list[tuple[str, str, str, tuple[str, ...]]] = [
    # normalized_concept, anatomy, laterality_hint_or_empty, matchers
    ("supraspinatus tendon tear", "supraspinatus tendon", "", ("supraspinatus", "tear")),
    ("subdeltoid bursitis", "subdeltoid bursa", "", ("subdeltoid",)),
    ("ac joint degenerative changes", "acromioclavicular joint", "", ("ac joint", "acromioclavicular", "capsular hypertrophy")),
    ("glenohumeral joint effusion", "glenohumeral joint", "", ("glenohumeral", "effusion")),
    ("greater tuberosity bone edema", "greater tuberosity", "", ("greater tuberosity", "bone edema")),
    ("subscapularis tenosynovitis", "subscapularis tendon", "", ("subscapularis", "tenosynovitis")),
    ("subcoracoid bursitis", "subcoracoid bursa", "", ("subcoracoid",)),
    ("joint effusion", "joint", "", ("joint effusion",)),
    ("bursitis", "bursa", "", ("bursitis",)),
    ("tenosynovitis", "tendon sheath", "", ("tenosynovitis",)),
    ("bone edema", "bone", "", ("bone edema", "marrow edema")),
]

# Clinically relevant details often needed for surgical planning — listed as
# "not described" only when absent from report text (never as "normal").
_SHOULDER_TEAR_GAP_LABELS = [
    ("tendon retraction measurement", ("retraction",)),
    ("tear dimensions", ("dimension", "size of tear", "tear size", "cm", "millimeter", "mm")),
    ("muscle atrophy", ("atrophy",)),
    ("fatty infiltration", ("fatty infiltration", "fatty atrophy", "goutallier")),
]


def split_finding_lines(text: str) -> list[str]:
    """Split Impression/Findings prose into discrete finding statements."""
    if not text or not text.strip():
        return []
    cleaned = text.replace("\r\n", "\n").strip()
    lines: list[str] = []
    for raw in re.split(r"\n+|(?<=\.)\s+(?=[A-Z•\-\*\d])", cleaned):
        line = re.sub(r"^[\s•\-\*\d.]+", "", raw).strip()
        if len(line) >= 12:
            lines.append(line)
    if not lines and cleaned:
        lines = [cleaned]
    return lines


def match_concept(finding_text: str) -> dict[str, str]:
    """Return normalized_concept / anatomy / laterality without inventing."""
    lower = finding_text.lower()
    laterality = ""
    if re.search(r"\bright\b", lower):
        laterality = "right"
    elif re.search(r"\bleft\b", lower):
        laterality = "left"
    elif re.search(r"\bbilateral\b", lower):
        laterality = "bilateral"

    for concept, anatomy, lat_hint, matchers in _CONCEPT_RULES:
        if all(m in lower for m in matchers) or (len(matchers) == 1 and matchers[0] in lower):
            return {
                "normalized_concept": concept,
                "anatomy": anatomy,
                "laterality": laterality or lat_hint,
            }
    return {"normalized_concept": "", "anatomy": "", "laterality": laterality}


def extract_findings_from_sections(
    sections: dict[str, str],
    *,
    page_by_section: dict[str, int] | None = None,
) -> list[dict[str, Any]]:
    """Build structured finding dicts from section text.

    Prefers Impression; falls back to Findings. Does not invent missing values.
    """
    page_by_section = page_by_section or {}
    primary_type = "impression" if sections.get("impression", "").strip() else "findings"
    text = sections.get(primary_type, "").strip()
    if not text:
        return []

    page = page_by_section.get(primary_type, 1)
    findings: list[dict[str, Any]] = []
    for ordinal, line in enumerate(split_finding_lines(text)):
        concepts = match_concept(line)
        findings.append(
            {
                "section_type": primary_type,
                "ordinal": ordinal,
                "original_text": line,
                "confirmed_text": line,
                "source_text": line,
                "normalized_concept": concepts["normalized_concept"],
                "anatomy": concepts["anatomy"],
                "laterality": concepts["laterality"],
                "page_number": page,
            }
        )
    return findings


def detect_report_gaps(report_blob: str, findings: list[dict[str, Any]]) -> list[dict[str, str]]:
    """Return clinically relevant details NOT identified in the report text.

    Absence is never treated as normal — callers must show the disclaimer.
    """
    blob = (report_blob or "").lower()
    finding_blob = " ".join(
        f"{f.get('original_text', '')} {f.get('confirmed_text', '')} {f.get('normalized_concept', '')}"
        for f in findings
    ).lower()
    combined = f"{blob} {finding_blob}"

    has_tear = "tear" in combined or "supraspinatus" in combined
    if not has_tear:
        return []

    gaps: list[dict[str, str]] = []
    for label, keywords in _SHOULDER_TEAR_GAP_LABELS:
        if not any(k in combined for k in keywords):
            gaps.append(
                {
                    "label": label,
                    "note": (
                        "These details were not identified in the report text. "
                        "This does not mean they are absent."
                    ),
                }
            )
    return gaps


def short_summary_label(finding_text: str, normalized_concept: str = "") -> str:
    if normalized_concept:
        # Title-style short label from concept
        return normalized_concept[0].upper() + normalized_concept[1:]
    clipped = finding_text.split(".")[0].strip()
    return clipped if len(clipped) <= 72 else clipped[:69] + "…"
