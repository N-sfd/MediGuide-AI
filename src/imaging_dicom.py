"""DICOM ingestion — interfaces only, not implemented.

No DICOM library (pydicom/pynetdicom) is installed in this project yet.
Rather than fake support with a partial/incorrect parser, this module
defines the shape a future implementation must fill in, so the database
schema (ImagingSeries, see src/database/models.py) and API surface don't
need to change again when that work happens.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path


@dataclass(frozen=True)
class DicomSeriesMetadata:
    series_number: int | None
    description: str
    image_count: int | None
    modality: str


@dataclass(frozen=True)
class DicomMetadata:
    modality: str
    study_date: str | None
    study_description: str
    body_region: str
    institution: str
    series: list[DicomSeriesMetadata] = field(default_factory=list)


def parse_dicom_metadata(path: Path) -> DicomMetadata:
    """Would extract non-diagnostic metadata (modality, study date, series,
    body region, image count, institution) from a .dcm file or DICOM
    directory. Not implemented — see module docstring."""
    raise NotImplementedError(
        "DICOM ingestion is not implemented yet — see src/imaging_dicom.py. "
        "Upload the report as PDF/image for now."
    )


def is_dicom_file(path: Path) -> bool:
    return path.suffix.lower() == ".dcm"
