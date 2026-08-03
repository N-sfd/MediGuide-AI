import src.orchestrator as orchestrator_module
from src.orchestrator import process_image, process_message
from src.safety.emergency import SafetyResult


def _no_emergency(_text: str) -> SafetyResult:
    return SafetyResult(is_emergency=False, matched_signals=[])


def test_process_message_prompts_for_empty_input():
    assert "enter a question" in process_message("").lower()
    assert "enter a question" in process_message("   ").lower()


def test_process_message_short_circuits_on_emergency(monkeypatch):
    monkeypatch.setattr(
        orchestrator_module,
        "check_emergency",
        lambda text: SafetyResult(is_emergency=True, matched_signals=["chest pain"], response="Call 911 now."),
    )
    assert process_message("I have crushing chest pain") == "Call 911 now."


def test_process_message_appends_disclaimer_and_calls_model(monkeypatch):
    monkeypatch.setattr(orchestrator_module, "check_emergency", _no_emergency)
    monkeypatch.setattr(
        orchestrator_module,
        "generate_text_response",
        lambda user_message, history=None: f"echo: {user_message}",
    )

    result = process_message("what causes a fever?")
    assert "echo: what causes a fever?" in result
    assert "not a" in result.lower()


def test_process_message_passes_history_through(monkeypatch):
    captured = {}
    monkeypatch.setattr(orchestrator_module, "check_emergency", _no_emergency)

    def fake_generate(user_message, history=None):
        captured["history"] = history
        return "ok"

    monkeypatch.setattr(orchestrator_module, "generate_text_response", fake_generate)
    history = [{"role": "user", "content": "hi"}]
    process_message("follow up", history=history)
    assert captured["history"] == history


def test_process_image_requires_an_image():
    assert "attach an image" in process_image("").lower()


def test_process_image_short_circuits_on_emergency_question(monkeypatch):
    monkeypatch.setattr(
        orchestrator_module,
        "check_emergency",
        lambda text: SafetyResult(is_emergency=True, matched_signals=["overdose"], response="Call 911 now."),
    )
    result = process_image("photo.png", question="I think I overdosed, what does this label say?")
    assert result == "Call 911 now."


def test_process_image_passes_question_as_prompt(monkeypatch):
    captured = {}

    def fake_describe(image_path, user_prompt=None):
        captured["image_path"] = image_path
        captured["user_prompt"] = user_prompt
        return "Extracted text here."

    monkeypatch.setattr(orchestrator_module, "check_emergency", _no_emergency)
    monkeypatch.setattr(orchestrator_module, "describe_image", fake_describe)

    result = process_image("photo.png", question="What does the label say?")
    assert captured == {"image_path": "photo.png", "user_prompt": "What does the label say?"}
    assert "Extracted text here." in result
    assert "not a validated clinical interpretation" in result


def test_process_image_without_question_uses_model_default_prompt(monkeypatch):
    captured = {}

    def fake_describe(image_path):
        captured["called_without_prompt"] = True
        return "Extracted text here."

    monkeypatch.setattr(orchestrator_module, "describe_image", fake_describe)

    result = process_image("photo.png")
    assert captured["called_without_prompt"] is True
    assert "Extracted text here." in result
