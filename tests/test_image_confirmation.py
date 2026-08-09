from src.ui.logic import send_confirmed_image_text


def _run(extracted_text, confirmed, history=None, sessions=None):
    generator = send_confirmed_image_text(
        extracted_text,
        confirmed,
        history,
        sessions,
    )
    return next(generator)


def test_unconfirmed_extraction_is_not_sent():
    (
        history,
        status,
        confirmed,
        text,
        answer,
        evidence,
        history_update,
        sessions,
        active_id,
    ) = _run("Medication: ExampleMed", False)

    assert history == []
    assert "confirmation box" in status["value"]
    assert confirmed is False
    assert text == "Medication: ExampleMed"


def test_empty_extraction_is_not_sent():
    (
        history,
        status,
        confirmed,
        text,
        answer,
        evidence,
        history_update,
        sessions,
        active_id,
    ) = _run("", True)

    assert history == []
    assert "no extracted information" in status["value"].lower()
