from __future__ import annotations

import pymupdf


def _make_report_pdf(text: str) -> bytes:
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_text((72, 72), text, fontsize=9)
    data = doc.tobytes()
    doc.close()
    return data


def _create_study(client, *, modality="mri", body_region="Right knee", study_date="2026-09-02"):
    response = client.post(
        "/api/imaging/studies",
        json={"modality": modality, "body_region": body_region, "study_date": study_date},
    )
    assert response.status_code == 200
    return response.json()


def _attach_report(client, study_id: str, text: str, filename: str = "report.pdf"):
    pdf_bytes = _make_report_pdf(text)
    return client.post(
        f"/api/imaging/studies/{study_id}/report",
        files={"file": (filename, pdf_bytes, "application/pdf")},
    )


REPORT_TEXT = (
    "EXAM: MRI Right Knee\n"
    "FINDINGS: No acute fracture. Small joint effusion.\n"
    "IMPRESSION: Small joint effusion.\n"
)


def test_create_study_and_list_modalities(api_client):
    study = _create_study(api_client)
    assert study["modality"] == "mri"
    assert study["verification_status"] == "unverified"

    response = api_client.get("/api/imaging/modalities")
    assert response.status_code == 200
    modalities = {row["modality"]: row for row in response.json()["modalities"]}
    assert set(modalities) == {"xray", "ct", "mri", "ultrasound", "pet_ct"}
    assert modalities["mri"]["study_count"] == 1
    assert modalities["mri"]["latest_study_date"] == "2026-09-02"
    assert modalities["xray"]["study_count"] == 0


def test_unknown_modality_rejected(api_client):
    response = api_client.post("/api/imaging/studies", json={"modality": "not-a-modality"})
    assert response.status_code == 422


def test_upload_report_extracts_sections_from_native_text(api_client):
    study = _create_study(api_client)
    response = _attach_report(api_client, study["study_id"], REPORT_TEXT)
    assert response.status_code == 200
    sections = response.json()["sections"]
    assert sections["exam"] == "MRI Right Knee"
    assert sections["findings"] == "No acute fracture. Small joint effusion."
    assert sections["impression"] == "Small joint effusion."

    listed = api_client.get(f"/api/imaging/studies/{study['study_id']}/report/sections").json()
    statuses = {row["section_type"]: row["verification_status"] for row in listed["sections"]}
    assert statuses["findings"] == "unverified"


def test_dcm_upload_returns_safe_not_supported_error(api_client):
    study = _create_study(api_client)
    response = api_client.post(
        f"/api/imaging/studies/{study['study_id']}/report",
        files={"file": ("scan.dcm", b"not-really-dicom", "application/octet-stream")},
    )
    assert response.status_code == 415
    body = response.json()
    assert body["error"]["code"] == "DICOM_NOT_YET_SUPPORTED"
    assert body["error"]["retryable"] is False


def test_confirm_requires_review_flag(api_client):
    study = _create_study(api_client)
    _attach_report(api_client, study["study_id"], REPORT_TEXT)
    response = api_client.post(
        f"/api/imaging/studies/{study['study_id']}/report/confirm",
        json={"reviewed": False, "sections": []},
    )
    assert response.status_code == 400


def test_confirm_flips_verification_status_and_allows_edits(api_client):
    study = _create_study(api_client)
    _attach_report(api_client, study["study_id"], REPORT_TEXT)

    response = api_client.post(
        f"/api/imaging/studies/{study['study_id']}/report/confirm",
        json={
            "reviewed": True,
            "sections": [{"section_type": "findings", "text": "Corrected: no effusion."}],
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["verification_status"] == "verified"
    findings = next(s for s in body["sections"] if s["section_type"] == "findings")
    assert findings["section_text"] == "Corrected: no effusion."
    # original_text preserves the extracted wording even after a human edit.
    assert findings["original_text"] == "No acute fracture. Small joint effusion."

    study_after = api_client.get(f"/api/imaging/studies/{study['study_id']}").json()
    assert study_after["verification_status"] == "verified"


def test_confirm_is_incremental_and_never_auto_confirms_unreviewed_sections(api_client):
    study = _create_study(api_client)
    _attach_report(api_client, study["study_id"], REPORT_TEXT)

    # Confirming only "findings" must leave exam/impression untouched and
    # move the study to "partially_verified" rather than jumping to
    # "verified" for sections nobody has reviewed yet.
    response = api_client.post(
        f"/api/imaging/studies/{study['study_id']}/report/confirm",
        json={"reviewed": True, "sections": [], "confirm_types": ["findings"]},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["verification_status"] == "partially_verified"
    statuses = {s["section_type"]: s["verification_status"] for s in body["sections"]}
    assert statuses["findings"] == "confirmed"
    assert statuses["exam"] == "unverified"
    assert statuses["impression"] == "unverified"

    study_after = api_client.get(f"/api/imaging/studies/{study['study_id']}").json()
    assert study_after["verification_status"] == "partially_verified"

    # Confirming the remaining sections completes verification.
    response = api_client.post(
        f"/api/imaging/studies/{study['study_id']}/report/confirm",
        json={"reviewed": True, "sections": [], "confirm_types": ["exam", "impression"]},
    )
    assert response.status_code == 200
    assert response.json()["verification_status"] == "verified"


def test_compare_requires_both_reports_confirmed(api_client):
    study_a = _create_study(api_client, study_date="2025-05-14")
    upload_a = _attach_report(api_client, study_a["study_id"], REPORT_TEXT)
    study_b = _create_study(api_client, study_date="2026-09-02")
    upload_b = _attach_report(api_client, study_b["study_id"], REPORT_TEXT)

    response = api_client.post(
        "/api/imaging/compare",
        json={
            "document_id_a": upload_a.json()["document_id"],
            "document_id_b": upload_b.json()["document_id"],
        },
    )
    assert response.status_code == 409


def test_compare_confirmed_reports_buckets_sentences(api_client):
    study_a = _create_study(api_client, study_date="2025-05-14")
    upload_a = _attach_report(
        api_client, study_a["study_id"],
        "FINDINGS: No acute fracture. Mild joint effusion.\nIMPRESSION: No acute fracture.\n",
    )
    api_client.post(
        f"/api/imaging/studies/{study_a['study_id']}/report/confirm",
        json={"reviewed": True, "sections": []},
    )

    study_b = _create_study(api_client, study_date="2026-09-02")
    upload_b = _attach_report(
        api_client, study_b["study_id"],
        "FINDINGS: No acute fracture. New ACL tear noted.\nIMPRESSION: New ACL tear.\n",
    )
    api_client.post(
        f"/api/imaging/studies/{study_b['study_id']}/report/confirm",
        json={"reviewed": True, "sections": []},
    )

    response = api_client.post(
        "/api/imaging/compare",
        json={
            "document_id_a": upload_a.json()["document_id"],
            "document_id_b": upload_b.json()["document_id"],
        },
    )
    assert response.status_code == 200
    comparisons = {row["section_type"]: row for row in response.json()["comparisons"]}
    findings = comparisons["findings"]
    assert findings["present_in_both"] == ["No acute fracture."]
    assert findings["newly_mentioned"] == ["New ACL tear noted."]
    assert findings["no_longer_mentioned"] == ["Mild joint effusion."]
    # Every bucketed statement must be traceable back to its source document.
    assert findings["earlier"]["document_id"] == upload_a.json()["document_id"]
    assert findings["later"]["document_id"] == upload_b.json()["document_id"]


def test_terminology_explain_never_fabricates_without_evidence(api_client, monkeypatch):
    import src.imaging as imaging_module

    monkeypatch.setattr(imaging_module, "retrieve_approved_evidence", lambda *a, **k: [])
    response = api_client.post(
        "/api/imaging/terminology/explain", json={"term": "a made up nonsense term"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["sources"] == []
    assert "could not find enough approved" in body["answer_markdown"].lower()


def test_delete_study_keeps_underlying_document(api_client, db_session):
    study = _create_study(api_client)
    upload = _attach_report(api_client, study["study_id"], REPORT_TEXT)
    document_id = upload.json()["document_id"]

    response = api_client.delete(f"/api/imaging/studies/{study['study_id']}")
    assert response.status_code == 200

    from src.database.models import Document, ImagingStudy

    with db_session.session_scope() as session:
        assert session.get(ImagingStudy, study["study_id"]) is None
        assert session.get(Document, document_id) is not None


def test_report_page_preview_served(api_client):
    study = _create_study(api_client)
    _attach_report(api_client, study["study_id"], REPORT_TEXT)
    response = api_client.get(f"/api/imaging/studies/{study['study_id']}/report/pages/1/preview")
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"


def test_health_isolates_imaging_from_core(api_client, monkeypatch):
    """A broken imaging probe must not flip /api/health's overall status —
    matches the existing document_processing isolation design."""
    import api as api_module

    monkeypatch.setattr(
        api_module, "probe_imaging_documents", lambda: (False, "simulated outage")
    )
    response = api_client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["statuses"]["imaging_documents"]["status"] == "unavailable"
    assert body["status"] == "ok"


def test_imaging_outage_does_not_break_documents_or_labs(api_client, monkeypatch):
    """Simulates the imaging DB probe failing outright (as a broken imaging
    subsystem would) and confirms Documents' and Labs' own endpoints are
    completely unaffected — they share the database but not a failure path."""
    import src.imaging as imaging_module

    def _broken(*args, **kwargs):
        raise RuntimeError("simulated imaging outage")

    monkeypatch.setattr(imaging_module, "modality_summary", _broken)

    imaging_response = api_client.get("/api/imaging/modalities")
    assert imaging_response.status_code == 500

    documents_response = api_client.get("/api/documents/v2/sessions")
    assert documents_response.status_code == 200

    labs_response = api_client.get("/api/labs/tests")
    assert labs_response.status_code == 200


def test_ollama_outage_does_not_affect_imaging_document_health(api_client, monkeypatch):
    """The educational-explanation model being down must not report imaging
    document storage/viewing as unavailable — they don't depend on Ollama."""
    import api as api_module

    monkeypatch.setattr(api_module, "_probe_ollama", lambda: (False, "simulated Ollama outage", set()))
    response = api_client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["statuses"]["ollama"]["status"] == "unavailable"
    assert body["statuses"]["imaging_documents"]["status"] == "ready"
    assert body["statuses"]["imaging_viewer"]["status"] == "ready"
