from src.safety import check_for_emergency


def test_emergency_terms_are_detected():
    result = check_for_emergency(
        "I have crushing chest pain and can't breathe"
    )
    assert result.is_emergency
    assert "severe chest symptoms" in result.matched_signals
    assert result.message is not None


def test_benign_message_is_not_flagged():
    result = check_for_emergency(
        "What's a healthy amount of sleep for an adult?"
    )
    assert not result.is_emergency
    assert result.matched_signals == ()
    assert result.message is None
