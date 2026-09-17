"""Timeout + bounded-retry helpers for external/AI calls.

There is no background job queue in this app (see src/database/models.py
ProcessingJob docstring) — processing still runs inside the HTTP request,
so "retry" here means a small in-process bounded retry loop with backoff,
not a durable task queue. Transient failures (connection refused, timeout)
get a few bounded attempts; anything else fails fast so a permanently
broken input (bad image, unreadable PDF) never loops forever.
"""

from __future__ import annotations

import time
from collections.abc import Callable
from typing import TypeVar

import httpx

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


def call_with_retry(
    fn: Callable[[], T],
    *,
    attempts: int = 3,
    backoff_base: float = 1.0,
    transient_exceptions: tuple[type[BaseException], ...] = TRANSIENT_EXCEPTIONS,
) -> T:
    """Runs ``fn`` up to ``attempts`` times with exponential backoff.

    Only exceptions in ``transient_exceptions`` are retried; any other
    exception propagates immediately on the first attempt. Returns the
    last transient exception wrapped as ``TransientProcessingError`` once
    attempts are exhausted, so callers can distinguish "gave up after
    retrying" from "failed once, permanently."
    """
    if attempts < 1:
        raise ValueError("attempts must be >= 1")

    last_error: BaseException | None = None

    for attempt in range(1, attempts + 1):
        try:
            return fn()
        except transient_exceptions as error:
            last_error = error
            if attempt < attempts:
                time.sleep(backoff_base * (2 ** (attempt - 1)))
                continue
            raise TransientProcessingError(
                "The AI service did not respond in time after "
                f"{attempts} attempts.",
                technical_detail=f"{type(error).__name__}: {error}",
            ) from error

    # Unreachable, but keeps type-checkers happy.
    assert last_error is not None
    raise TransientProcessingError(str(last_error)) from last_error
