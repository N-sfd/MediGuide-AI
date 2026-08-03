import dataclasses
import subprocess
from types import SimpleNamespace

import pytest

from src.models import text_to_speech
from src.models.speech_to_text import SpeechTranscriber
from src.models.text_to_speech import TextToSpeechError, synthesize_speech


class _FakeSegment:
    def __init__(self, text: str):
        self.text = text


class _FakeWhisperModel:
    def __init__(self, *args, **kwargs):
        pass

    def transcribe(self, audio_path, **kwargs):
        return [_FakeSegment(" I have a headache "), _FakeSegment("since yesterday.")], SimpleNamespace()


def test_speech_transcriber_joins_segments(monkeypatch, tmp_path):
    monkeypatch.setattr("src.models.speech_to_text.WhisperModel", _FakeWhisperModel)
    audio_path = tmp_path / "sample.wav"
    audio_path.write_bytes(b"fake audio")

    transcriber = SpeechTranscriber(model_size="tiny")
    transcript = transcriber.transcribe(str(audio_path))
    assert transcript == "I have a headache since yesterday."


def test_speech_transcriber_missing_file_raises(monkeypatch):
    monkeypatch.setattr("src.models.speech_to_text.WhisperModel", _FakeWhisperModel)
    transcriber = SpeechTranscriber(model_size="tiny")
    with pytest.raises(FileNotFoundError):
        transcriber.transcribe("does_not_exist.wav")


def test_synthesize_speech_rejects_empty_text():
    with pytest.raises(ValueError):
        synthesize_speech("   ")


def test_synthesize_speech_requires_piper_on_path(monkeypatch):
    monkeypatch.setattr(text_to_speech.shutil, "which", lambda _name: None)
    with pytest.raises(TextToSpeechError, match="piper"):
        synthesize_speech("hello", model_path="voice.onnx")


def test_synthesize_speech_requires_model_path(monkeypatch):
    monkeypatch.setattr(text_to_speech.shutil, "which", lambda _name: "/usr/bin/piper")
    no_model_config = dataclasses.replace(text_to_speech.CONFIG, piper_model_path=None)
    monkeypatch.setattr(text_to_speech, "CONFIG", no_model_config)
    with pytest.raises(TextToSpeechError, match="voice model"):
        synthesize_speech("hello")


def test_synthesize_speech_invokes_piper_and_returns_output_path(monkeypatch, tmp_path):
    captured = {}

    def fake_run(command, input, text, check, capture_output):
        captured["command"] = command
        captured["input"] = input
        return SimpleNamespace(returncode=0)

    monkeypatch.setattr(text_to_speech.shutil, "which", lambda _name: "/usr/bin/piper")
    monkeypatch.setattr(text_to_speech.subprocess, "run", fake_run)

    output_path = tmp_path / "reply.wav"
    result = synthesize_speech("You should feel better soon.", model_path="voice.onnx", output_path=output_path)

    assert result == str(output_path)
    assert captured["input"] == "You should feel better soon."
    assert captured["command"] == ["piper", "--model", "voice.onnx", "--output_file", str(output_path)]
    assert output_path.parent.exists()


def test_synthesize_speech_wraps_piper_failure(monkeypatch, tmp_path):
    def fake_run(*args, **kwargs):
        raise subprocess.CalledProcessError(1, "piper", stderr="voice not found")

    monkeypatch.setattr(text_to_speech.shutil, "which", lambda _name: "/usr/bin/piper")
    monkeypatch.setattr(text_to_speech.subprocess, "run", fake_run)

    with pytest.raises(TextToSpeechError, match="voice not found"):
        synthesize_speech("hello", model_path="voice.onnx", output_path=tmp_path / "reply.wav")
