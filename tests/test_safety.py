from src.safety.emergency import check_emergency
from src.safety.medical_guardrails import DISCLAIMER, append_disclaimer, build_system_prompt
from src.safety.privacy import redact


def test_emergency_terms_are_detected():
    result = check_emergency("I have crushing chest pain and can't breathe")
    assert result.is_emergency
    assert "chest pain" in result.matched_signals
    assert result.response is not None


def test_benign_message_is_not_flagged():
    result = check_emergency("What's a healthy amount of sleep for an adult?")
    assert not result.is_emergency
    assert result.matched_signals == []


def test_disclaimer_is_appended_once():
    reply = append_disclaimer("Here is some general information.")
    assert DISCLAIMER in reply
    assert append_disclaimer(reply).count(DISCLAIMER) == 1


def test_system_prompt_includes_extra_instructions():
    prompt = build_system_prompt("Extra context here.")
    assert "Extra context here." in prompt
    assert "not a doctor" in prompt.lower()


def test_privacy_redacts_common_pii():
    text = "Contact me at jane@example.com or 555-123-4567. SSN 123-45-6789."
    redacted = redact(text)
    assert "jane@example.com" not in redacted
    assert "555-123-4567" not in redacted
    assert "123-45-6789" not in redacted
    assert "[REDACTED_EMAIL]" in redacted
