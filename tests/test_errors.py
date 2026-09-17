from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from src.shared.errors import MediGuideError, install_error_handlers


def _build_app() -> FastAPI:
    app = FastAPI()
    install_error_handlers(app)

    @app.get("/mediguide-error")
    def _raise_mediguide_error():
        raise MediGuideError(
            "DOCUMENT_EXTRACTION_FAILED",
            "We couldn't finish reading this document.",
            status_code=422,
            retryable=False,
            technical_detail="secret stack trace",
        )

    @app.get("/legacy-http-error")
    def _raise_http_exception():
        raise HTTPException(status_code=404, detail="Document session not found.")

    @app.get("/unhandled-error")
    def _raise_unhandled():
        raise RuntimeError("something broke internally with a secret path /etc/passwd")

    @app.get("/validation-error")
    def _raise_validation(count: int):
        return {"count": count}

    return app


client = TestClient(_build_app(), raise_server_exceptions=False)


def test_mediguide_error_uses_standard_envelope():
    response = client.get("/mediguide-error")
    assert response.status_code == 422
    body = response.json()
    assert body["error"]["code"] == "DOCUMENT_EXTRACTION_FAILED"
    assert body["error"]["message"] == "We couldn't finish reading this document."
    assert body["error"]["retryable"] is False
    assert "request_id" in body["error"]
    assert "secret stack trace" not in response.text


def test_legacy_http_exception_gets_wrapped_in_envelope():
    response = client.get("/legacy-http-error")
    assert response.status_code == 404
    body = response.json()
    assert body["error"]["code"] == "NOT_FOUND"
    assert body["error"]["message"] == "Document session not found."


def test_unhandled_exception_returns_safe_generic_message():
    response = client.get("/unhandled-error")
    assert response.status_code == 500
    body = response.json()
    assert body["error"]["code"] == "INTERNAL_ERROR"
    assert "/etc/passwd" not in response.text
    assert body["error"]["retryable"] is True


def test_validation_error_is_422_not_generic_500():
    response = client.get("/validation-error")  # missing required `count` query param
    assert response.status_code == 422
    body = response.json()
    assert body["error"]["code"] == "VALIDATION_ERROR"
