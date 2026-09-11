"""Generate the synthetic three-date lab report used by Document Intelligence demos."""

from __future__ import annotations

from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "samples" / "sample-lab-report.pdf"

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


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc = pymupdf.open()
    for page_info in PAGES:
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
            f"Page {PAGES.index(page_info) + 1} of {len(PAGES)} · MediGuide synthetic demo",
            fontsize=9,
            fontname="helv",
        )
    doc.save(OUTPUT)
    doc.close()
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    main()
