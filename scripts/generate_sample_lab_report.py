"""CLI wrapper for regenerating the synthetic three-date lab report on disk.

The generation logic itself lives in src/sample_fixtures.py, which the
backend also imports so it can self-heal the same file if it's ever
missing from a deployment.
"""

from __future__ import annotations

from pathlib import Path

from src.sample_fixtures import generate_sample_lab_report

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "samples" / "sample-lab-report.pdf"


def main() -> None:
    generate_sample_lab_report(OUTPUT)
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    main()
