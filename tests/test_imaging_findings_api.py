from __future__ import annotations

import pymupdf


def _make_report_pdf(text: str) -> bytes:
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_text((72, 72), text, fontsize=9)
    data = doc.tobytes()
    doc.close()
    return data


def _create_study(client, *, modality="mri", body_region="Right Shoulder", study_date="2026-09-18"):
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


def test_upload_extracts_unverified_findings(api_client):
    study = _create_study(api_client)
    text = (
        "EXAM: MRI Right Shoulder\n"
        "CLINICAL INFO: Fall 1 month ago.\n"
        "FINDINGS: Defect at Supraspinatus.\n"
        "IMPRESSION:\n"
        "- Near complete tear of Supraspinatus muscle tendon region.\n"
        "- Distended subdeltoid bursa - suggestive of bursitis.\n"
        "- AC joint degenerative changes with capsular hypertrophy.\n"
    )
    response = _attach_report(api_client, study["study_id"], text)
    assert response.status_code == 200

    findings = api_client.get(f"/api/imaging/studies/{study['study_id']}/findings").json()
    assert len(findings["findings"]) >= 2
    assert all(row["verification_status"] == "unverified" for row in findings["findings"])
    assert "does not independently diagnose" in findings["boundary"].lower()
    assert any("retraction" in g["label"] for g in findings["gaps"])


def test_confirm_finding_preserves_original_text(api_client):
    study = _create_study(api_client)
    _attach_report(
        api_client,
        study["study_id"],
        "IMPRESSION: Near complete tear of Supraspinatus.\n",
    )
    listed = api_client.get(f"/api/imaging/studies/{study['study_id']}/findings").json()["findings"]
    assert listed
    finding_id = listed[0]["finding_id"]
    original = listed[0]["original_text"]

    confirmed = api_client.post(
        f"/api/imaging/studies/{study['study_id']}/findings/confirm",
        json={
            "reviewed": True,
            "findings": [
                {
                    "finding_id": finding_id,
                    "confirmed_text": "Near-complete tear of the residual thinned-out Supraspinatus tendon.",
                    "verification_status": "confirmed",
                }
            ],
        },
    )
    assert confirmed.status_code == 200
    row = confirmed.json()["findings"][0]
    assert row["original_text"] == original
    assert "thinned-out" in row["confirmed_text"]
    assert row["verification_status"] == "confirmed"


def test_explain_requires_confirmed_finding(api_client):
    study = _create_study(api_client)
    _attach_report(api_client, study["study_id"], "IMPRESSION: Small joint effusion.\n")
    finding_id = api_client.get(f"/api/imaging/studies/{study['study_id']}/findings").json()["findings"][0]["finding_id"]
    blocked = api_client.post("/api/imaging/findings/explain", json={"finding_id": finding_id})
    assert blocked.status_code == 409


def test_reject_finding(api_client):
    study = _create_study(api_client)
    _attach_report(api_client, study["study_id"], "IMPRESSION: Small joint effusion.\n")
    finding_id = api_client.get(f"/api/imaging/studies/{study['study_id']}/findings").json()["findings"][0]["finding_id"]
    response = api_client.post(
        f"/api/imaging/studies/{study['study_id']}/findings/confirm",
        json={"reviewed": True, "findings": [{"finding_id": finding_id, "verification_status": "rejected"}]},
    )
    assert response.status_code == 200
    assert response.json()["findings"][0]["verification_status"] == "rejected"
