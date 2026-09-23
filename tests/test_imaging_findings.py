from __future__ import annotations

from src.imaging_findings import (
    detect_report_gaps,
    extract_findings_from_sections,
    match_concept,
    split_finding_lines,
)


def test_split_impression_bullets():
    text = (
        "- Near complete tear of the residual thinned out Supraspinatus muscle tendon region.\n"
        "- Distended subdeltoid bursa - suggestive of bursitis.\n"
        "- AC joint degenerative changes with capsular hypertrophy.\n"
    )
    lines = split_finding_lines(text)
    assert len(lines) == 3
    assert "Supraspinatus" in lines[0]


def test_extract_prefers_impression():
    findings = extract_findings_from_sections(
        {
            "findings": "A defect is seen at the Supraspinatus.",
            "impression": "- Near complete tear of Supraspinatus.\n- Distended subdeltoid bursa - bursitis.",
        }
    )
    assert len(findings) == 2
    assert findings[0]["section_type"] == "impression"
    assert findings[0]["normalized_concept"] == "supraspinatus tendon tear"
    assert findings[1]["normalized_concept"] == "subdeltoid bursitis"


def test_does_not_invent_laterality():
    concept = match_concept("Near complete tear of Supraspinatus muscle tendon region.")
    assert concept["laterality"] == ""
    assert concept["normalized_concept"] == "supraspinatus tendon tear"


def test_gaps_not_described_without_claiming_normal():
    gaps = detect_report_gaps(
        "IMPRESSION: Near complete tear of Supraspinatus.",
        [{"original_text": "Near complete tear of Supraspinatus", "confirmed_text": "", "normalized_concept": "supraspinatus tendon tear"}],
    )
    labels = {g["label"] for g in gaps}
    assert "tendon retraction measurement" in labels
    assert "muscle atrophy" in labels
    assert all("does not mean they are absent" in g["note"] for g in gaps)


def test_gaps_omitted_when_retraction_described():
    gaps = detect_report_gaps(
        "IMPRESSION: Full-thickness tear with 2 cm retraction and Goutallier grade 2 fatty infiltration.",
        [{"original_text": "Full-thickness tear with 2 cm retraction", "confirmed_text": "", "normalized_concept": "supraspinatus tendon tear"}],
    )
    labels = {g["label"] for g in gaps}
    assert "tendon retraction measurement" not in labels
    assert "fatty infiltration" not in labels
