from __future__ import annotations

from unittest.mock import patch

import httpx
import pytest
from ollama import ResponseError

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

    result = call_with_retry(fn, attempts=3, backoff_schedule=(0, 0))
    assert result == "ok"
    assert len(calls) == 1


def test_retries_transient_failures_then_succeeds():
    attempts = {"count": 0}

    def fn():
        attempts["count"] += 1
        if attempts["count"] < 3:
            raise ConnectionError("boom")
        return "recovered"

    result = call_with_retry(fn, attempts=3, backoff_schedule=(0, 0))
    assert result == "recovered"
    assert attempts["count"] == 3


def test_gives_up_after_exhausting_attempts_raises_transient_error():
    def fn():
        raise TimeoutError("still down")

    with pytest.raises(TransientProcessingError):
        call_with_retry(fn, attempts=2, backoff_schedule=(0,))


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

    result = call_with_retry(fn, attempts=3, backoff_schedule=(0, 0))
    assert result == "recovered"
    assert attempts["count"] == 2


def test_permanent_failure_does_not_retry():
    calls = []

    def fn():
        calls.append(1)
        raise ValueError("bad input, retrying will not help")

    with pytest.raises(ValueError):
        call_with_retry(fn, attempts=5, backoff_schedule=(0, 0, 0, 0))

    # A non-transient exception must fail fast on the first attempt.
    assert len(calls) == 1


def test_processing_error_carries_safe_message_and_technical_detail():
    error = PermanentProcessingError("Safe message", technical_detail="stack trace details")
    assert error.message == "Safe message"
    assert error.technical_detail == "stack trace details"


def test_ollama_response_error_503_is_transient():
    """A non-2xx HTTP response from the Ollama server itself (proxy
    restarting, model still loading) is a different exception shape than a
    connect/timeout failure, but deserves the same bounded retry."""
    attempts = {"count": 0}

    def fn():
        attempts["count"] += 1
        if attempts["count"] < 2:
            raise ResponseError("service unavailable", 503)
        return "recovered"

    result = call_with_retry(fn, attempts=3, backoff_schedule=(0, 0))
    assert result == "recovered"
    assert attempts["count"] == 2


@pytest.mark.parametrize("status_code", [400, 404])
def test_ollama_response_error_4xx_is_permanent(status_code):
    calls = []

    def fn():
        calls.append(1)
        raise ResponseError("bad request", status_code)

    with pytest.raises(ResponseError):
        call_with_retry(fn, attempts=3, backoff_schedule=(0, 0))

    assert len(calls) == 1


def test_backoff_schedule_used_in_order_not_exponential():
    def fn():
        raise ConnectionError("down")

    with patch("src.shared.resilience.time.sleep") as mock_sleep:
        with pytest.raises(TransientProcessingError):
            call_with_retry(fn, attempts=3, backoff_schedule=(2, 5, 10))

    assert mock_sleep.call_args_list == [((2,),), ((5,),)]


def test_on_retry_called_before_each_sleep_not_on_final_failure():
    calls = []

    def fn():
        raise ConnectionError("down")

    def on_retry(attempt, attempts, delay):
        calls.append((attempt, attempts, delay))

    with pytest.raises(TransientProcessingError):
        call_with_retry(fn, attempts=3, backoff_schedule=(2, 5), on_retry=on_retry)

    # Two retries fired (before attempt 2 and attempt 3), none after the
    # third and final attempt gives up for good.
    assert calls == [(1, 3, 2), (2, 3, 5)]
