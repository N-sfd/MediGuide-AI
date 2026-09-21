from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from src.database.models import Document, ProcessingJob
from src.database.repository import (
    create_uploaded_document,
    get_or_create_job,
    stuck_job_count,
    upsert_confirmed_document,
)
from src.shared.errors import MediGuideError
from src.shared.job_runner import run_extraction_job
from src.shared.resilience import PermanentProcessingError, TransientProcessingError


def test_upload_persists_document_before_any_processing(db_session):
    with db_session.session_scope() as session:
        create_uploaded_document(
            session,
            document_id="doc-1",
            filename="report.pdf",
            content_type="application/pdf",
            storage_path="/tmp/doc-1",
        )

    with db_session.session_scope() as session:
        document = session.get(Document, "doc-1")
        assert document is not None
        assert document.status == "uploaded"
        assert document.filename == "report.pdf"


def test_run_extraction_job_completes_successfully(db_session):
    with db_session.session_scope() as session:
        create_uploaded_document(session, document_id="doc-2", filename="a.pdf")

    def work(set_stage):
        set_stage("reading")
        set_stage("extracting")
        return {"fields": 3}

    result = run_extraction_job(document_id="doc-2", job_type="document_extraction", work=work)
    assert result == {"fields": 3}

    with db_session.session_scope() as session:
        job = get_or_create_job(session, document_id="doc-2", job_type="document_extraction")
        assert job.status == "completed"
        assert job.attempt_count == 1
        document = session.get(Document, "doc-2")
        assert document.status == "review_required"


def test_transient_failure_marks_job_retryable(db_session):
    with db_session.session_scope() as session:
        create_uploaded_document(session, document_id="doc-3", filename="a.pdf")

    def work(set_stage):
        raise TransientProcessingError("Ollama is unreachable", technical_detail="ConnectionError")

    with pytest.raises(MediGuideError) as exc_info:
        run_extraction_job(document_id="doc-3", job_type="document_extraction", work=work)

    assert exc_info.value.retryable is True
    assert exc_info.value.code == "AI_SERVICE_TEMPORARILY_UNAVAILABLE"

    with db_session.session_scope() as session:
        job = get_or_create_job(session, document_id="doc-3", job_type="document_extraction")
        assert job.status == "failed"
        assert job.retryable is True
        # Technical detail is retained on the job row for operators, but the
        # exception surfaced to the API layer only carries the safe message.
        assert job.technical_error == "ConnectionError"
        document = session.get(Document, "doc-3")
        assert document.status == "failed"


def test_permanent_failure_is_not_retryable(db_session):
    with db_session.session_scope() as session:
        create_uploaded_document(session, document_id="doc-4", filename="a.pdf")

    def work(set_stage):
        raise PermanentProcessingError("This file could not be read.")

    with pytest.raises(MediGuideError) as exc_info:
        run_extraction_job(document_id="doc-4", job_type="document_extraction", work=work)

    assert exc_info.value.retryable is False
    assert exc_info.value.code == "DOCUMENT_EXTRACTION_FAILED"


def test_retry_reuses_the_same_job_row_and_increments_attempts(db_session):
    with db_session.session_scope() as session:
        create_uploaded_document(session, document_id="doc-5", filename="a.pdf")

    def failing_work(set_stage):
        raise TransientProcessingError("down")

    for _ in range(2):
        with pytest.raises(MediGuideError):
            run_extraction_job(document_id="doc-5", job_type="document_extraction", work=failing_work)

    def succeeding_work(set_stage):
        return "done"

    run_extraction_job(document_id="doc-5", job_type="document_extraction", work=succeeding_work)

    with db_session.session_scope() as session:
        jobs = session.query(ProcessingJob).filter_by(document_id="doc-5").all()
        # Retries update the same row in place — never a second job row for
        # the same (document_id, job_type).
        assert len(jobs) == 1
        assert jobs[0].attempt_count == 3
        assert jobs[0].status == "completed"


def test_stuck_job_count_flags_long_running_jobs(db_session):
    with db_session.session_scope() as session:
        create_uploaded_document(session, document_id="doc-6", filename="a.pdf")
        job = get_or_create_job(session, document_id="doc-6", job_type="document_extraction")
        job.status = "running"
        job.started_at = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(seconds=600)
        session.flush()

    with db_session.session_scope() as session:
        assert stuck_job_count(session, stale_after_seconds=300) == 1
        assert stuck_job_count(session, stale_after_seconds=3600) == 0


def test_repeated_confirm_does_not_duplicate_observations(db_session):
    """Locks in the pre-existing delete-and-replace idempotency that job
    retries must not break: confirming the same document twice must not
    accumulate duplicate LabObservation rows."""
    fields = [
        {
            "field_id": "p1-abc",
            "label": "Hemoglobin",
            "value": "13.2",
            "unit": "g/dL",
            "reference_range": "12.0-15.5",
            "status": "in_listed_range",
            "confidence": "clearly_visible",
            "page_number": 1,
            "source_text": "Hemoglobin 13.2 g/dL",
            "extraction_method": "native_text",
            "user_edited": False,
        }
    ]
    pages = [{"page_number": 1, "preview_url": "", "text_available": True}]

    with db_session.session_scope() as session:
        upsert_confirmed_document(
            session,
            document_id="doc-7",
            filename="a.pdf",
            page_count=1,
            pages=pages,
            fields=fields,
            report_date="2026-01-15",
        )
        upsert_confirmed_document(
            session,
            document_id="doc-7",
            filename="a.pdf",
            page_count=1,
            pages=pages,
            fields=fields,
            report_date="2026-01-15",
        )

    with db_session.session_scope() as session:
        document = session.get(Document, "doc-7")
        assert len(document.lab_observations) == 1


def test_retry_attempt_progress_persisted_while_waiting_for_service(db_session):
    """A caller's set_stage("waiting_for_service", retry_attempt=..., retry_max=...)
    — normally driven by call_with_retry's on_retry hook — must be visible
    on the job row for a polling client to render "Attempt N of M". Failing
    right after (rather than completing) keeps this observable: a
    successful completion clears the counter (see the "clears" test below),
    so this checks the value the way a poll mid-retry actually would."""
    with db_session.session_scope() as session:
        create_uploaded_document(session, document_id="doc-8", filename="a.pdf")

    def work(set_stage):
        set_stage("reading")
        set_stage("waiting_for_service", retry_attempt=1, retry_max=3)
        raise TransientProcessingError("still down")

    with pytest.raises(MediGuideError):
        run_extraction_job(document_id="doc-8", job_type="document_extraction", work=work)

    with db_session.session_scope() as session:
        job = get_or_create_job(session, document_id="doc-8", job_type="document_extraction")
        assert job.retry_attempt == 1
        assert job.retry_max == 3


def test_retry_progress_clears_once_stage_moves_past_waiting(db_session):
    with db_session.session_scope() as session:
        create_uploaded_document(session, document_id="doc-9", filename="a.pdf")

    def work(set_stage):
        set_stage("waiting_for_service", retry_attempt=1, retry_max=3)
        set_stage("extracting")
        return "done"

    run_extraction_job(document_id="doc-9", job_type="document_extraction", work=work)

    with db_session.session_scope() as session:
        job = get_or_create_job(session, document_id="doc-9", job_type="document_extraction")
        # A fresh, non-waiting stage clears the stale attempt counter so a
        # later poll doesn't show "Attempt 1 of 3" once things are moving
        # (job.stage itself ends as "review_required" — set by
        # complete_job() once work() returns successfully).
        assert job.retry_attempt == 0
        assert job.retry_max == 0


def test_on_stage_hook_mirrors_every_stage_change(db_session):
    """document_intelligence.py bridges this into its own JSON session
    state (the actual source of truth its /status route reads from) — this
    locks in that run_extraction_job calls it for every stage transition,
    including automatic-retry progress, with the same (stage, attempt,
    max) shape."""
    with db_session.session_scope() as session:
        create_uploaded_document(session, document_id="doc-10", filename="a.pdf")

    seen = []

    def work(set_stage):
        set_stage("reading")
        set_stage("waiting_for_service", retry_attempt=2, retry_max=3)
        return "done"

    run_extraction_job(
        document_id="doc-10",
        job_type="document_extraction",
        work=work,
        on_stage=lambda stage, attempt, max_attempts: seen.append((stage, attempt, max_attempts)),
    )

    # The job's initial "validating" stage is set by start_job_attempt()
    # directly (before set_stage/on_stage exist yet) — only transitions
    # made through set_stage are mirrored.
    assert seen == [
        ("reading", 0, 0),
        ("waiting_for_service", 2, 3),
    ]


def test_failure_carries_the_stage_it_failed_at(db_session):
    with db_session.session_scope() as session:
        create_uploaded_document(session, document_id="doc-11", filename="a.pdf")

    def work(set_stage):
        set_stage("reading")
        set_stage("extracting")
        raise TransientProcessingError("down")

    with pytest.raises(MediGuideError) as exc_info:
        run_extraction_job(document_id="doc-11", job_type="document_extraction", work=work)

    assert exc_info.value.stage == "extracting"
