from app import send_confirmed_image_text


def test_unconfirmed_extraction_is_not_sent() -> None:
    history, status, confirmed, text = (
        send_confirmed_image_text(
            "Medication: ExampleMed",
            False,
            [],
        )
    )

    assert history == []
    assert "confirmation box" in status
    assert confirmed is False
    assert text == "Medication: ExampleMed"


def test_empty_extraction_is_not_sent() -> None:
    history, status, confirmed, text = (
        send_confirmed_image_text(
            "",
            True,
            [],
        )
    )

    assert history == []
    assert "no extracted information" in (
        status.lower()
    )
