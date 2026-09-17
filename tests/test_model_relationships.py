"""Regression test for a structural mapper bug: an earlier edit accidentally
appended LabObservation.field onto the end of ImagingReportSection instead
of LabObservation, which broke SQLAlchemy's mapper configuration for the
whole app (not just imaging) the moment anything triggered a full
configure_mappers() cascade. Model classes are large and easy to
mis-splice with text-based edits, so this test pins the exact shape that
broke, plus a general "every model configures" check."""

from __future__ import annotations

from sqlalchemy.orm import configure_mappers

from src.database import models


def test_configure_mappers_succeeds():
    """The definitive check: if any relationship/back_populates pairing is
    broken, this raises sqlalchemy.exc.InvalidRequestError."""
    configure_mappers()


def test_lab_observation_has_its_field_relationship():
    assert hasattr(models.LabObservation, "field")
    relationship = models.LabObservation.field.property
    assert relationship.back_populates == "lab_observation"
    assert relationship.mapper.class_ is models.ExtractedField


def test_extracted_field_has_its_lab_observation_relationship():
    assert hasattr(models.ExtractedField, "lab_observation")
    relationship = models.ExtractedField.lab_observation.property
    assert relationship.back_populates == "field"
    assert relationship.mapper.class_ is models.LabObservation


def test_imaging_report_section_does_not_carry_the_lab_field_relationship():
    """The exact bug: ImagingReportSection must never own a `field`
    relationship — that belongs solely to LabObservation."""
    assert not hasattr(models.ImagingReportSection, "field")


def test_all_mapped_models_are_configured():
    mapped_classes = [
        models.Document,
        models.DocumentPage,
        models.ExtractedField,
        models.ProcessingJob,
        models.LabObservation,
        models.ImagingStudy,
        models.ImagingSeries,
        models.ImagingReportSection,
    ]
    configure_mappers()
    for model in mapped_classes:
        mapper = model.__mapper__
        # Touching every relationship's target forces SQLAlchemy to resolve
        # it; a broken back_populates pairing raises here, not silently.
        for relationship in mapper.relationships:
            assert relationship.mapper is not None
