"""Regression coverage for the "Try synthetic data" demo entry point.

Root cause of the production failure this guards against: .dockerignore
excluded data/samples from the Docker build context, so
Dockerfile.render's `COPY data/samples ./data/samples` silently copied
nothing — the file existed in git and locally, but not in the deployed
container. These tests cover both that scenario (self-heal via
regeneration) and the plain happy path.
"""

from __future__ import annotations

import src.document_intelligence as document_intelligence_module


def test_sample_lab_report_endpoint_serves_a_real_pdf(api_client):
    response = api_client.get("/api/documents/v2/sample/lab-report")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.content.startswith(b"%PDF")
    assert len(response.content) > 1000


def test_sample_lab_report_self_heals_when_the_shipped_fixture_is_missing(api_client, tmp_path, monkeypatch):
    """Simulates the actual production bug: the static file isn't where the
    endpoint expects it. The endpoint must regenerate it rather than 404."""
    missing_base_dir = tmp_path / "missing_fixture_repo"
    monkeypatch.setattr(document_intelligence_module, "BASE_DIR", missing_base_dir)

    expected_path = missing_base_dir / "data" / "samples" / "sample-lab-report.pdf"
    assert not expected_path.exists()

    response = api_client.get("/api/documents/v2/sample/lab-report")
    assert response.status_code == 200
    assert response.content.startswith(b"%PDF")
    assert expected_path.exists()


def test_sample_lab_report_returns_a_clean_error_when_generation_itself_fails(api_client, monkeypatch):
    """If regeneration also fails (e.g. disk full), the caller must see a
    typed DEMO_FIXTURE_UNAVAILABLE error, never a bare 500/stack trace —
    and never the wording used for a user's own uploaded document."""
    def _boom(_output_path):
        raise OSError("disk full")

    monkeypatch.setattr(document_intelligence_module, "generate_sample_lab_report", _boom)
    monkeypatch.setattr(
        document_intelligence_module,
        "BASE_DIR",
        document_intelligence_module.BASE_DIR / "definitely-does-not-exist",
    )

    response = api_client.get("/api/documents/v2/sample/lab-report")
    assert response.status_code == 503
    body = response.json()
    assert body["error"]["code"] == "DEMO_FIXTURE_UNAVAILABLE"
    assert body["error"]["retryable"] is True
    assert "disk full" not in response.text


def test_sample_lab_report_native_text_covers_the_expected_measurements(api_client):
    """The canonical demo must be native-text (no OCR/Ollama dependency) and
    contain the three-date longitudinal values the rest of the app's demo
    guidance (e.g. "try 6.7%") assumes exist."""
    import pymupdf

    response = api_client.get("/api/documents/v2/sample/lab-report")
    doc = pymupdf.open(stream=response.content, filetype="pdf")
    try:
        assert doc.page_count == 3
        full_text = "".join(page.get_text() for page in doc)
    finally:
        doc.close()

    for expected in ["Hemoglobin A1C", "6.2", "6.5", "6.7", "2026-01-15", "2026-04-12", "2026-08-12"]:
        assert expected in full_text


def test_demo_data_health_check_never_fails_overall_health(api_client, monkeypatch):
    """Demo Mode being broken must never report the whole app unavailable."""
    import api as api_module

    monkeypatch.setattr(api_module, "BASE_DIR", api_module.BASE_DIR / "definitely-does-not-exist")
    response = api_client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert "demo_data" in body["statuses"]
    assert body["statuses"]["demo_data"]["status"] == "ready"
    assert body["status"] == "ok"
