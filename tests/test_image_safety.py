from src.image_safety import check_image_request


def test_document_extraction_is_allowed() -> None:
    result = check_image_request(
        "Extract the visible medication name."
    )

    assert result.allowed is True


def test_xray_diagnosis_is_blocked() -> None:
    result = check_image_request(
        "Look at this X-ray and diagnose the fracture."
    )

    assert result.allowed is False


def test_skin_cancer_request_is_blocked() -> None:
    result = check_image_request(
        "Is this skin lesion cancer?"
    )

    assert result.allowed is False


def test_normal_abnormal_request_is_blocked() -> None:
    result = check_image_request(
        "Is this medical image normal?"
    )

    assert result.allowed is False
