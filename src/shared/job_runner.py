"""Runs a document-processing attempt while tracking it as a ProcessingJob row.

Job tracking is best-effort: if the relational store is unreachable, the
underlying extraction still runs exactly as it did before this sprint
(document_intelligence.py's JSON-file session state is the source of truth
for the review UI) — losing the job row only means losing retry/attempt
visibility, not the ability to process a document.
"""

from __future__ import annotations

import time
from collections.abc import Callable
from typing import TypeVar

from src.database.models import ProcessingJob
from src.database.repository import (
    complete_job,
    fail_job,
    get_or_create_job,
    set_document_status,
    start_job_attempt,
    update_job_stage,
)
from src.database.session import session_scope
from src.observability.logging import get_logger
from src.shared.errors import MediGuideError
from src.shared.resilience import PermanentProcessingError, TransientProcessingError

logger = get_logger(__name__)

T = TypeVar("T")

PROCESSOR_VERSION = "doc-intel-v2.1"


def _safe(action: str, fn: Callable[[], None]) -> None:
    try:
        fn()
    except Exception as error:  # noqa: BLE001 — job tracking must never break extraction
        logger.warning(
            "job_tracking_unavailable",
            extra={"action": action, "error_type": type(error).__name__},
        )


def run_extraction_job(
    *,
    document_id: str,
    job_type: str,
    work: Callable[[Callable[[str], None]], T],
) -> T:
    """Runs ``work(set_stage)`` while recording a ProcessingJob row.

    ``work`` receives a ``set_stage(stage)`` callback to report progress and
    should raise ``TransientProcessingError`` / ``PermanentProcessingError``
    (see src/shared/resilience.py) so the job row records an accurate
    error_code/retryable flag; any other exception is recorded as a generic
    permanent failure.
    """
    job_id: str | None = None
    attempt = 0

    def _start() -> None:
        nonlocal job_id, attempt
        with session_scope() as session:
            job = get_or_create_job(session, document_id=document_id, job_type=job_type)
            start_job_attempt(session, job, processor_version=PROCESSOR_VERSION)
            job_id = job.id
            attempt = job.attempt_count
            set_document_status(session, document_id, "processing")

    _safe("start_job", _start)
    logger.info(
        "job_started",
        extra={"job_id": job_id, "document_id": document_id, "job_type": job_type, "attempt": attempt},
    )

    def set_stage(stage: str) -> None:
        def _update() -> None:
            with session_scope() as session:
                job = session.get(ProcessingJob, job_id) if job_id else None
                if job is not None:
                    update_job_stage(session, job, stage)

        _safe("update_stage", _update)
        logger.info(
            "job_stage",
            extra={"job_id": job_id, "document_id": document_id, "stage": stage, "attempt": attempt},
        )

    started = time.monotonic()

    try:
        result = work(set_stage)
    except (TransientProcessingError, PermanentProcessingError) as error:
        # Captured into plain locals before defining the closure below:
        # `except ... as error` deletes `error` once this block exits, so a
        # nested function must not close over it directly.
        retryable = isinstance(error, TransientProcessingError)
        code = "DOCUMENT_EXTRACTION_TIMEOUT" if retryable else "DOCUMENT_EXTRACTION_FAILED"
        safe_message = error.message
        technical_detail = error.technical_detail

        def _fail() -> None:
            with session_scope() as session:
                job = session.get(ProcessingJob, job_id) if job_id else None
                if job is not None:
                    fail_job(
                        session,
                        job,
                        error_code=code,
                        safe_message=safe_message,
                        technical_detail=technical_detail,
                        retryable=retryable,
                    )
                set_document_status(session, document_id, "failed")

        _safe("fail_job", _fail)
        logger.warning(
            "job_failed",
            extra={
                "job_id": job_id,
                "document_id": document_id,
                "error_code": code,
                "retryable": retryable,
                "attempt": attempt,
            },
        )
        raise MediGuideError(
            code,
            safe_message,
            status_code=503 if retryable else 422,
            retryable=retryable,
            technical_detail=technical_detail,
        ) from error
    except Exception as error:
        # Same reasoning as above: capture before defining the closure.
        technical_detail = f"{type(error).__name__}: {error}"

        def _fail_unexpected() -> None:
            with session_scope() as session:
                job = session.get(ProcessingJob, job_id) if job_id else None
                if job is not None:
                    fail_job(
                        session,
                        job,
                        error_code="DOCUMENT_EXTRACTION_FAILED",
                        safe_message="We couldn't finish reading this document.",
                        technical_detail=technical_detail,
                        retryable=False,
                    )
                set_document_status(session, document_id, "failed")

        _safe("fail_job", _fail_unexpected)
        logger.warning(
            "job_failed",
            extra={
                "job_id": job_id,
                "document_id": document_id,
                "error_code": "DOCUMENT_EXTRACTION_FAILED",
                "retryable": False,
                "attempt": attempt,
            },
        )
        raise MediGuideError(
            "DOCUMENT_EXTRACTION_FAILED",
            "We couldn't finish reading this document.",
            status_code=422,
            retryable=False,
            technical_detail=technical_detail,
        ) from error
    else:
        def _complete() -> None:
            with session_scope() as session:
                job = session.get(ProcessingJob, job_id) if job_id else None
                if job is not None:
                    complete_job(session, job)
                set_document_status(session, document_id, "review_required")

        _safe("complete_job", _complete)
        duration_ms = round((time.monotonic() - started) * 1000, 1)
        logger.info(
            "job_completed",
            extra={"job_id": job_id, "document_id": document_id, "duration_ms": duration_ms, "attempt": attempt},
        )
        return result
