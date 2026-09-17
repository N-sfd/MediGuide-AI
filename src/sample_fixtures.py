"""The synthetic three-date lab report used by Document Intelligence demos.

Shared by scripts/generate_sample_lab_report.py (a CLI wrapper) and
document_intelligence.py's /sample/lab-report endpoint, which regenerates
this file on demand if it's ever missing from a deployment — a packaging
mistake should degrade to "regenerate it," not "the demo is permanently
broken until the next deploy."
"""

from __future__ import annotations

from pathlib import Path

import pymupdf

PAGES = [
    {
        "title": "Synthetic Longitudinal Lab Report — Visit 1",
        "date": "2026-01-15",
        "lines": [
            "Hemoglobin A1C 6.2 % Ref <5.7",
            "Hemoglobin 13.1 g/dL Ref 12.0-15.5",
            "Glucose 96 mg/dL Ref 70-99",
            "WBC 6.1 10^3/uL Ref 4.0-11.0",
            "Platelets 238 10^3/uL Ref 150-400",
        ],
    },
    {
        "title": "Synthetic Longitudinal Lab Report — Visit 2",
        "date": "2026-04-12",
        "lines": [
            "Hemoglobin A1C 6.5 % Ref <5.7",
            "Hemoglobin 13.0 g/dL Ref 12.0-15.5",
            "Glucose 101 mg/dL Ref 70-99",
            "WBC 6.3 10^3/uL Ref 4.0-11.0",
            "Platelets 241 10^3/uL Ref 150-400",
        ],
    },
    {
        "title": "Synthetic Longitudinal Lab Report — Visit 3",
        "date": "2026-08-12",
        "lines": [
            "Hemoglobin A1C 6.7 % Ref <5.7",
            "Hemoglobin 12.9 g/dL Ref 12.0-15.5",
            "Glucose 99 mg/dL Ref 70-99",
            "WBC 6.4 10^3/uL Ref 4.0-11.0",
            "Platelets 242 10^3/uL Ref 150-400",
        ],
    },
]


def generate_sample_lab_report(output_path: Path) -> None:
    """Writes the deterministic synthetic lab report (native PDF text, no
    OCR needed) to output_path, creating parent directories as needed."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    doc = pymupdf.open()
    try:
        for index, page_info in enumerate(PAGES):
            page = doc.new_page(width=612, height=792)
            y = 72
            page.insert_text((72, y), page_info["title"], fontsize=14, fontname="helv")
            y += 28
            page.insert_text(
                (72, y),
                "Educational sample only — not a real patient report.",
                fontsize=10,
                fontname="helv",
            )
            y += 24
            page.insert_text(
                (72, y),
                f"Collection date: {page_info['date']}",
                fontsize=11,
                fontname="helv",
            )
            y += 28
            page.insert_text((72, y), "Test Name    Value    Unit    Printed Reference", fontsize=10, fontname="helv")
            y += 20
            for line in page_info["lines"]:
                page.insert_text((72, y), line, fontsize=11, fontname="helv")
                y += 22
            page.insert_text(
                (72, 720),
                f"Page {index + 1} of {len(PAGES)} · MediGuide synthetic demo",
                fontsize=9,
                fontname="helv",
            )
        doc.save(output_path)
    finally:
        doc.close()
