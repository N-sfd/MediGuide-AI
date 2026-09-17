"""Structured logging + request-id correlation.

Logs are JSON lines carrying request_id/job_id/document_id/stage/duration_ms/
status/error_code. Never log full document text, lab values, transcripts, or
other personal health content — only identifiers and outcomes.
"""

from __future__ import annotations

import json
import logging
import time
import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from contextvars import ContextVar

_request_id_ctx: ContextVar[str] = ContextVar("request_id", default="")

_RESERVED_LOG_RECORD_ATTRS = set(logging.LogRecord(
    "", 0, "", 0, "", (), None
).__dict__.keys()) | {"message"}


def new_request_id() -> str:
    return uuid.uuid4().hex[:16]


def get_request_id() -> str:
    return _request_id_ctx.get()


def set_request_id(value: str) -> None:
    _request_id_ctx.set(value)


class _JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, object] = {
            "timestamp": self.formatTime(record, "%Y-%m-%dT%H:%M:%S"),
            "level": record.levelname,
            "logger": record.name,
            "event": record.getMessage(),
            "request_id": get_request_id(),
        }
        for key, value in record.__dict__.items():
            if key in _RESERVED_LOG_RECORD_ATTRS:
                continue
            payload[key] = value
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


_configured = False


def configure_logging(level: int = logging.INFO) -> None:
    global _configured
    if _configured:
        return
    root = logging.getLogger()
    root.setLevel(level)
    handler = logging.StreamHandler()
    handler.setFormatter(_JsonFormatter())
    root.handlers = [handler]
    _configured = True


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)


@contextmanager
def log_stage(logger: logging.Logger, stage: str, **fields: object) -> Iterator[None]:
    """Logs a stage's start/duration/outcome without leaking payload content."""
    started = time.monotonic()
    logger.info("stage_started", extra={"stage": stage, **fields})
    try:
        yield
    except Exception as error:
        duration_ms = round((time.monotonic() - started) * 1000, 1)
        logger.warning(
            "stage_failed",
            extra={
                "stage": stage,
                "duration_ms": duration_ms,
                "error_type": type(error).__name__,
                **fields,
            },
        )
        raise
    else:
        duration_ms = round((time.monotonic() - started) * 1000, 1)
        logger.info(
            "stage_completed",
            extra={"stage": stage, "duration_ms": duration_ms, **fields},
        )
