from src.models import vision_model
from src.models.vision_model import describe_image


def test_describe_image_sends_system_prompt_and_image(monkeypatch):
    captured = {}

    def fake_chat(model, messages, options=None):
        captured["model"] = model
        captured["messages"] = messages
        captured["options"] = options
        return {"message": {"content": "Extracted: Ibuprofen 200mg tablets."}}

    monkeypatch.setattr(vision_model.ollama, "chat", fake_chat)

    result = describe_image("label.png")

    assert result == "Extracted: Ibuprofen 200mg tablets."
    assert captured["messages"][0] == {"role": "system", "content": vision_model.VISION_SYSTEM_PROMPT}
    assert captured["messages"][1]["images"] == ["label.png"]
    assert captured["model"] == "llava"


def test_describe_image_uses_custom_prompt_and_model(monkeypatch):
    captured = {}

    def fake_chat(model, messages, options=None):
        captured["model"] = model
        captured["messages"] = messages
        return {"message": {"content": "ok"}}

    monkeypatch.setattr(vision_model.ollama, "chat", fake_chat)

    describe_image("report.png", user_prompt="What is the flagged value?", model="qwen2.5vl")

    assert captured["model"] == "qwen2.5vl"
    assert captured["messages"][1]["content"] == "What is the flagged value?"
