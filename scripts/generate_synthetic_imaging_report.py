"""Generates a small synthetic radiology-report PDF for tests/demos.

CLI usage:
    python scripts/generate_synthetic_imaging_report.py --output path.pdf \
        --exam "MRI Right Knee" --findings "..." --impression "..."
"""

from __future__ import annotations

import argparse
from pathlib import Path

import pymupdf


def build_report_pdf(
    output_path: Path,
    *,
    exam: str,
    clinical_history: str = "",
    technique: str = "",
    findings: str = "",
    impression: str = "",
    invalid: bool = False,
    no_recognized_headers: bool = False,
) -> None:
    if invalid:
        output_path.write_bytes(b"not a real pdf")
        return

    doc = pymupdf.open()
    page = doc.new_page()

    if no_recognized_headers:
        text = "Patient presented for evaluation. Everything appeared unremarkable to the technician on duty."
    else:
        lines = [f"EXAM: {exam}"]
        if clinical_history:
            lines.append(f"CLINICAL HISTORY: {clinical_history}")
        if technique:
            lines.append(f"TECHNIQUE: {technique}")
        if findings:
            lines.append(f"FINDINGS: {findings}")
        if impression:
            lines.append(f"IMPRESSION: {impression}")
        text = "\n".join(lines)

    page.insert_text((72, 72), text, fontsize=10)
    doc.save(str(output_path))
    doc.close()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    parser.add_argument("--exam", default="MRI Right Knee")
    parser.add_argument("--clinical-history", default="")
    parser.add_argument("--technique", default="")
    parser.add_argument("--findings", default="")
    parser.add_argument("--impression", default="")
    parser.add_argument("--invalid", action="store_true")
    parser.add_argument("--no-recognized-headers", action="store_true")
    args = parser.parse_args()

    build_report_pdf(
        Path(args.output),
        exam=args.exam,
        clinical_history=args.clinical_history,
        technique=args.technique,
        findings=args.findings,
        impression=args.impression,
        invalid=args.invalid,
        no_recognized_headers=args.no_recognized_headers,
    )
    print(f"Wrote {args.output}")


if __name__ == "__main__":
    main()
