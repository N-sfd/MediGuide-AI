"""Generate synthetic CT / X-ray / MRI / ultrasound report fixtures."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.sample_imaging_fixtures import generate_sample_imaging_reports

OUTPUT_DIR = ROOT / "data" / "samples" / "imaging"


def main() -> None:
    written = generate_sample_imaging_reports(OUTPUT_DIR)
    for path in written:
        print(f"Wrote {path}")


if __name__ == "__main__":
    main()
