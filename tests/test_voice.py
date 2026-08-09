import subprocess
from types import SimpleNamespace

import pytest

from src import tts
from src.tts import TextToSpeechError, synthesize_speech
from src.voice_registry import VoiceConfig


def _fake_voice(tmp_path) -> VoiceConfig:
    model_path = tmp_path / "voice.onnx"
    config_path = tmp_path / "voice.onnx.json"
    model_path.write_bytes(b"fake")
    config_path.write_text("{}")
    return VoiceConfig(
        voice_id="en_US-lessac-medium",
        display_name="English — Lessac",
        language_code="en",
        model_path=model_path,
        config_path=config_path,
    )


def test_synthesize_speech_rejects_empty_text():
    with pytest.raises(ValueError):
        synthesize_speech("   ")


def test_synthesize_speech_requires_piper_executable(monkeypatch):
    monkeypatch.setattr(tts.shutil, "which", lambda _name: None)
    monkeypatch.setattr(tts.Path, "exists", lambda _self: False)
    with pytest.raises(TextToSpeechError, match="piper"):
        synthesize_speech("hello")


def test_synthesize_speech_requires_installed_voice(monkeypatch, tmp_path):
    monkeypatch.setattr(tts.shutil, "which", lambda _name: "/usr/bin/piper")
    monkeypatch.setattr(tts, "build_voice_config", lambda _lang: None)
    with pytest.raises(TextToSpeechError, match="voice model"):
        synthesize_speech("hello", output_path=tmp_path / "reply.wav")


def test_synthesize_speech_invokes_piper_and_returns_output_path(
    monkeypatch, tmp_path
):
    captured = {}

    def fake_run(command, input, text, check, capture_output):
        captured["command"] = command
        captured["input"] = input
        return SimpleNamespace(returncode=0)

    monkeypatch.setattr(tts.shutil, "which", lambda _name: "/usr/bin/piper")
    monkeypatch.setattr(
        tts, "build_voice_config", lambda _lang: _fake_voice(tmp_path)
    )
    monkeypatch.setattr(tts.subprocess, "run", fake_run)

    output_path = tmp_path / "reply.wav"
    result = synthesize_speech(
        "You should feel better soon.",
        output_path=output_path,
    )

    assert result == str(output_path)
    assert captured["input"] == "You should feel better soon."
    assert "--length_scale" in captured["command"]
    assert output_path.parent.exists()


def test_synthesize_speech_wraps_piper_failure(monkeypatch, tmp_path):
    def fake_run(*args, **kwargs):
        raise subprocess.CalledProcessError(1, "piper", stderr="voice not found")

    monkeypatch.setattr(tts.shutil, "which", lambda _name: "/usr/bin/piper")
    monkeypatch.setattr(
        tts, "build_voice_config", lambda _lang: _fake_voice(tmp_path)
    )
    monkeypatch.setattr(tts.subprocess, "run", fake_run)

    with pytest.raises(TextToSpeechError, match="voice not found"):
        synthesize_speech("hello", output_path=tmp_path / "reply.wav")
