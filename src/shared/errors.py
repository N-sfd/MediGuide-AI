"""Standardized API error envelope.

Every error response takes the shape:

    {"error": {"code": "...", "message": "...", "retryable": bool, "request_id": "..."}}

``message`` is always safe to show a user. Technical detail (stack traces,
provider exception text) is logged server-side via ``technical_detail`` and
never serialized to the client.
"""

from __future__ import annotations

from fastapi import HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from src.observability.logging import get_logger, get_request_id

logger = get_logger(__name__)


class MediGuideError(Exception):
    """Raise this instead of HTTPException when a safe code/message/retryable
    flag matters to the caller (e.g. document processing failures)."""

    def __init__(
        self,
        code: str,
        message: str,
        *,
        status_code: int = 500,
        retryable: bool = False,
        technical_detail: str = "",
    ):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.retryable = retryable
        self.technical_detail = technical_detail or message


# Fallback codes for plain HTTPException(detail=...) call sites that predate
# this contract — keeps every one of them working without being touched.
_STATUS_CODE_FALLBACK = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    405: "METHOD_NOT_ALLOWED",
    409: "CONFLICT",
    413: "PAYLOAD_TOO_LARGE",
    415: "UNSUPPORTED_MEDIA_TYPE",
    422: "VALIDATION_ERROR",
    429: "TOO_MANY_REQUESTS",
    503: "SERVICE_UNAVAILABLE",
}

# Statuses that are worth a client-side retry even for legacy HTTPExceptions.
_RETRYABLE_STATUS_CODES = {408, 429, 500, 502, 503, 504}


def _envelope(*, code: str, message: str, retryable: bool) -> dict[str, object]:
    return {
        "error": {
            "code": code,
            "message": message,
            "retryable": retryable,
            "request_id": get_request_id(),
        }
    }


def install_error_handlers(app) -> None:
    """Registers the three exception handlers that give every response the
    same error shape, without requiring changes to existing raise sites."""

    @app.exception_handler(MediGuideError)
    async def _mediguide_error_handler(request: Request, exc: MediGuideError) -> JSONResponse:
        logger.warning(
            "request_failed",
            extra={
                "error_code": exc.code,
                "status": exc.status_code,
                "path": request.url.path,
                "technical_detail": exc.technical_detail,
            },
        )
        return JSONResponse(
            status_code=exc.status_code,
            content=_envelope(code=exc.code, message=exc.message, retryable=exc.retryable),
        )

    @app.exception_handler(HTTPException)
    async def _http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
        detail = exc.detail
        # Some legacy call sites already pass a dict detail; pass it through
        # untouched if it already looks like our envelope.
        if isinstance(detail, dict) and "error" in detail:
            return JSONResponse(status_code=exc.status_code, content=detail)

        message = detail if isinstance(detail, str) else "Request failed."
        code = _STATUS_CODE_FALLBACK.get(exc.status_code, "REQUEST_FAILED")
        logger.info(
            "request_failed",
            extra={"error_code": code, "status": exc.status_code, "path": request.url.path},
        )
        return JSONResponse(
            status_code=exc.status_code,
            content=_envelope(
                code=code,
                message=message,
                retryable=exc.status_code in _RETRYABLE_STATUS_CODES,
            ),
        )

    @app.exception_handler(RequestValidationError)
    async def _validation_error_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        # Field-level errors describe the client's own request shape, not
        # internal state, so they are safe to return as the message.
        first = exc.errors()[0] if exc.errors() else {}
        location = ".".join(str(part) for part in first.get("loc", []) if part != "body")
        detail = first.get("msg", "Invalid request.")
        message = f"{location}: {detail}" if location else detail
        return JSONResponse(
            status_code=422,
            content=_envelope(code="VALIDATION_ERROR", message=message, retryable=False),
        )

    @app.exception_handler(Exception)
    async def _unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.error(
            "unhandled_exception",
            extra={
                "error_code": "INTERNAL_ERROR",
                "path": request.url.path,
                "technical_detail": f"{type(exc).__name__}: {exc}",
            },
            exc_info=exc,
        )
        response = JSONResponse(
            status_code=500,
            content=_envelope(
                code="INTERNAL_ERROR",
                message="Something went wrong on our end. Please try again.",
                retryable=True,
            ),
        )
        # A handler registered for the bare `Exception` class runs inside
        # Starlette's ServerErrorMiddleware, which sits *outside* every
        # user-added middleware — including CORSMiddleware — so a truly
        # unexpected error would otherwise ship without CORS headers and the
        # browser would surface it to the frontend as an opaque "Failed to
        # fetch" instead of this actual, legible error. The response body
        # here carries no per-caller data, so echoing back the request's own
        # Origin is safe regardless of the app's allow-list.
        origin = request.headers.get("origin")
        if origin:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Vary"] = "Origin"
        return response
