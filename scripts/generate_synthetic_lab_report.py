"""Generates a small, single-reading synthetic lab-report PDF for tests.

Deliberately distinct from scripts/generate_sample_lab_report.py (the fixed
three-date Hemoglobin A1C report backing the "Try synthetic report" demo and
production /sample/lab-report endpoint): specs that need *a* lab result to
search/verify, but don't want to also deposit another 3 dates onto that same
tracked A1C trend line (shared across the whole e2e run's DB — see the file
comment on frontend/e2e/timeline-pagination.spec.ts), generate their own
one-off reading here instead of re-uploading the shared fixture.

CLI usage:
    python scripts/generate_synthetic_lab_report.py --output path.pdf \
        --test-name Creatinine --value 1.1 --unit mg/dL --reference-range 0.6-1.2
"""

from __future__ import annotations

import argparse
from pathlib import Path

import pymupdf


def build_lab_report_pdf(
    output_path: Path,
    *,
    test_name: str = "Creatinine",
    value: str = "1.1",
    unit: str = "mg/dL",
    reference_range: str = "0.6-1.2",
    collection_date: str = "2026-03-01",
) -> None:
    doc = pymupdf.open()
    page = doc.new_page(width=612, height=792)
    y = 72
    page.insert_text((72, y), "Synthetic Lab Report", fontsize=14, fontname="helv")
    y += 24
    page.insert_text(
        (72, y),
        "Educational sample only — not a real patient report.",
        fontsize=10,
        fontname="helv",
    )
    y += 24
    page.insert_text((72, y), f"Collection date: {collection_date}", fontsize=11, fontname="helv")
    y += 28
    # Matches document_intelligence.py's "Label Value Unit Ref Range" native-text
    # extraction pattern (e.g. "Hemoglobin 13.2 g/dL Ref 12.0-15.5").
    page.insert_text((72, y), f"{test_name} {value} {unit} Ref {reference_range}", fontsize=11, fontname="helv")
    doc.save(str(output_path))
    doc.close()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    parser.add_argument("--test-name", default="Creatinine")
    parser.add_argument("--value", default="1.1")
    parser.add_argument("--unit", default="mg/dL")
    parser.add_argument("--reference-range", default="0.6-1.2")
    parser.add_argument("--collection-date", default="2026-03-01")
    args = parser.parse_args()

    build_lab_report_pdf(
        Path(args.output),
        test_name=args.test_name,
        value=args.value,
        unit=args.unit,
        reference_range=args.reference_range,
        collection_date=args.collection_date,
    )
    print(f"Wrote {args.output}")


if __name__ == "__main__":
    main()
