from __future__ import annotations

import httpx
import pytest

from src.shared.resilience import (
    PermanentProcessingError,
    TransientProcessingError,
    call_with_retry,
)


def test_succeeds_on_first_attempt_without_sleeping():
    calls = []

    def fn():
        calls.append(1)
        return "ok"

    result = call_with_retry(fn, attempts=3, backoff_base=0)
    assert result == "ok"
    assert len(calls) == 1


def test_retries_transient_failures_then_succeeds():
    attempts = {"count": 0}

    def fn():
        attempts["count"] += 1
        if attempts["count"] < 3:
            raise ConnectionError("boom")
        return "recovered"

    result = call_with_retry(fn, attempts=3, backoff_base=0)
    assert result == "recovered"
    assert attempts["count"] == 3


def test_gives_up_after_exhausting_attempts_raises_transient_error():
    def fn():
        raise TimeoutError("still down")

    with pytest.raises(TransientProcessingError):
        call_with_retry(fn, attempts=2, backoff_base=0)


def test_retries_httpx_timeout_exceptions():
    """ollama's Client is httpx-backed: httpx.ReadTimeout/ConnectError do
    not subclass the builtin TimeoutError/OSError, so this is the actual
    exception shape a real hung/unreachable Ollama call raises."""
    attempts = {"count": 0}

    def fn():
        attempts["count"] += 1
        if attempts["count"] < 2:
            raise httpx.ReadTimeout("timed out")
        return "recovered"

    result = call_with_retry(fn, attempts=3, backoff_base=0)
    assert result == "recovered"
    assert attempts["count"] == 2


def test_permanent_failure_does_not_retry():
    calls = []

    def fn():
        calls.append(1)
        raise ValueError("bad input, retrying will not help")

    with pytest.raises(ValueError):
        call_with_retry(fn, attempts=5, backoff_base=0)

    # A non-transient exception must fail fast on the first attempt.
    assert len(calls) == 1


def test_processing_error_carries_safe_message_and_technical_detail():
    error = PermanentProcessingError("Safe message", technical_detail="stack trace details")
    assert error.message == "Safe message"
    assert error.technical_detail == "stack trace details"
