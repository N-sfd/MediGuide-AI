"""Timeout + bounded-retry helpers for external/AI calls.

There is no background job queue in this app (see src/database/models.py
ProcessingJob docstring) — processing still runs inside the HTTP request,
so "retry" here means a small in-process bounded retry loop with backoff,
not a durable task queue. Transient failures (connection refused, timeout,
5xx from the provider itself) get a few bounded attempts; anything else
fails fast so a permanently broken input (bad image, unreadable PDF) never
loops forever.
"""

from __future__ import annotations

import time
from collections.abc import Callable, Sequence
from typing import TypeVar

import httpx
from ollama import ResponseError

from src.observability.logging import get_logger

logger = get_logger(__name__)

T = TypeVar("T")

# ollama's Client is httpx-backed, and httpx.TimeoutException / ConnectError
# / NetworkError do NOT subclass Python's built-in TimeoutError or OSError —
# they only share a common base in httpx.TransportError. Catching just the
# builtins would silently never retry a slow or unreachable Ollama call,
# which is the primary failure this helper exists to recover from.
TRANSIENT_EXCEPTIONS: tuple[type[BaseException], ...] = (
    ConnectionError,
    TimeoutError,
    OSError,
    httpx.TransportError,
)

# ollama.ResponseError wraps a non-2xx HTTP response from the Ollama server
# itself (as opposed to a transport-level connect/timeout failure) — it is
# not a subclass of anything in TRANSIENT_EXCEPTIONS. A 502/503/504 there
# means "the service is up but not ready yet" (proxy restarting, model still
# loading) and deserves the same bounded retry; a 4xx (bad request, model
# not found) is a configuration problem retrying will never fix.
TRANSIENT_OLLAMA_STATUS_CODES = frozenset({502, 503, 504})

DEFAULT_BACKOFF_SCHEDULE_SECONDS: tuple[float, ...] = (2.0, 5.0, 10.0)


class ProcessingError(Exception):
    """Base class for classified extraction failures."""

    def __init__(self, message: str, *, technical_detail: str = ""):
        super().__init__(message)
        self.message = message
        self.technical_detail = technical_detail or message


class TransientProcessingError(ProcessingError):
    """A failure that is likely to succeed if retried (network/timeout)."""


class PermanentProcessingError(ProcessingError):
    """A failure that will not be fixed by retrying (bad input, bad output)."""


def _is_transient(
    error: BaseException,
    transient_exceptions: tuple[type[BaseException], ...],
) -> bool:
    if isinstance(error, transient_exceptions):
        return True
    if isinstance(error, ResponseError):
        return error.status_code in TRANSIENT_OLLAMA_STATUS_CODES
    return False


def call_with_retry(
    fn: Callable[[], T],
    *,
    attempts: int = 3,
    backoff_schedule: Sequence[float] = DEFAULT_BACKOFF_SCHEDULE_SECONDS,
    transient_exceptions: tuple[type[BaseException], ...] = TRANSIENT_EXCEPTIONS,
    on_retry: Callable[[int, int, float], None] | None = None,
    provider: str = "ollama",
    job_id: str | None = None,
) -> T:
    """Runs ``fn`` up to ``attempts`` times, waiting ``backoff_schedule[i]``
    seconds between attempt ``i+1`` and ``i+2``.

    Only transient failures (see ``_is_transient``) are retried; any other
    exception propagates immediately on the first attempt. ``on_retry(attempt,
    attempts, delay)`` — if given — is called right before each backoff
    sleep, so a caller can surface live "waiting for the AI service" progress
    (e.g. into a polled job-status row) instead of the retry loop being
    invisible until it finally gives up or succeeds. Raises the last
    transient exception wrapped as ``TransientProcessingError`` once attempts
    are exhausted, so callers can distinguish "gave up after retrying" from
    "failed once, permanently."
    """
    if attempts < 1:
        raise ValueError("attempts must be >= 1")

    last_error: BaseException | None = None

    for attempt in range(1, attempts + 1):
        started = time.monotonic()
        try:
            result = fn()
        except Exception as error:  # noqa: BLE001 — classified below
            duration_ms = round((time.monotonic() - started) * 1000, 1)
            if not _is_transient(error, transient_exceptions):
                logger.info(
                    "ollama_call",
                    extra={
                        "attempt": attempt,
                        "attempts": attempts,
                        "provider": provider,
                        "duration_ms": duration_ms,
                        "outcome": "permanent_failure",
                        "job_id": job_id,
                    },
                )
                raise
            last_error = error
            logger.info(
                "ollama_call",
                extra={
                    "attempt": attempt,
                    "attempts": attempts,
                    "provider": provider,
                    "duration_ms": duration_ms,
                    "outcome": "transient_failure",
                    "job_id": job_id,
                },
            )
            if attempt < attempts:
                delay = backoff_schedule[min(attempt - 1, len(backoff_schedule) - 1)]
                if on_retry is not None:
                    on_retry(attempt, attempts, delay)
                time.sleep(delay)
                continue
            raise TransientProcessingError(
                "The AI service did not respond in time after "
                f"{attempts} attempts.",
                technical_detail=f"{type(error).__name__}: {error}",
            ) from error
        else:
            duration_ms = round((time.monotonic() - started) * 1000, 1)
            logger.info(
                "ollama_call",
                extra={
                    "attempt": attempt,
                    "attempts": attempts,
                    "provider": provider,
                    "duration_ms": duration_ms,
                    "outcome": "success",
                    "job_id": job_id,
                },
            )
            return result

    # Unreachable, but keeps type-checkers happy.
    assert last_error is not None
    raise TransientProcessingError(str(last_error)) from last_error
