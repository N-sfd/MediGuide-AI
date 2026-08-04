from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from threading import Lock
from typing import Any, Callable

from faster_whisper import WhisperModel

from src.config import (
    MAX_AUDIO_MB,
    WHISPER_COMPUTE_TYPE,
    WHISPER_DEVICE,
    WHISPER_MODEL_SIZE,
)


SUPPORTED_AUDIO_EXTENSIONS = {
    ".aac",
    ".flac",
    ".m4a",
    ".mp3",
    ".mp4",
    ".ogg",
    ".opus",
    ".wav",
    ".webm",
}


@dataclass(frozen=True)
class TranscriptionResult:
    success: bool
    text: str = ""
    language: str | None = None
    language_probability: float | None = None
    error: str | None = None


_MODEL: WhisperModel | None = None
_MODEL_LOCK = Lock()


def get_whisper_model() -> WhisperModel:
    """
    Lazily load Whisper only when voice transcription is first requested.

    This keeps application startup fast and prevents loading multiple copies.
    """
    global _MODEL

    if _MODEL is None:
        with _MODEL_LOCK:
            if _MODEL is None:
                _MODEL = WhisperModel(
                    WHISPER_MODEL_SIZE,
                    device=WHISPER_DEVICE,
                    compute_type=WHISPER_COMPUTE_TYPE,
                )

    return _MODEL


def validate_audio_file(audio_path: str | None) -> Path:
    """Validate existence, type, and configured file-size limit."""
    if not audio_path:
        raise ValueError(
            "Record audio or upload a supported audio file before transcribing."
        )

    path = Path(audio_path)

    if not path.exists() or not path.is_file():
        raise ValueError("The selected audio file could not be found.")

    if path.suffix.lower() not in SUPPORTED_AUDIO_EXTENSIONS:
        supported = ", ".join(sorted(SUPPORTED_AUDIO_EXTENSIONS))
        raise ValueError(
            f"Unsupported audio format `{path.suffix or 'unknown'}`. "
            f"Supported formats: {supported}."
        )

    size_mb = path.stat().st_size / (1024 * 1024)

    if size_mb > MAX_AUDIO_MB:
        raise ValueError(
            f"The audio file is {size_mb:.1f} MB. "
            f"The current limit is {MAX_AUDIO_MB} MB."
        )

    if path.stat().st_size == 0:
        raise ValueError("The selected audio file is empty.")

    return path


def _read_information(
    information: Any,
) -> tuple[str | None, float | None]:
    """Read optional language metadata returned by faster-whisper."""
    language = getattr(information, "language", None)
    probability = getattr(information, "language_probability", None)

    if probability is not None:
        try:
            probability = float(probability)
        except (TypeError, ValueError):
            probability = None

    return language, probability


def transcribe_audio(
    audio_path: str | None,
    model_loader: Callable[[], Any] = get_whisper_model,
) -> TranscriptionResult:
    """
    Transcribe a local audio file with faster-whisper.

    A model loader can be injected so tests do not download or load a real model.
    """
    try:
        path = validate_audio_file(audio_path)
        model = model_loader()

        segments, information = model.transcribe(
            str(path),
            beam_size=5,
            vad_filter=True,
            condition_on_previous_text=False,
        )

        transcript_parts: list[str] = []

        for segment in segments:
            text = getattr(segment, "text", "")
            if isinstance(text, str) and text.strip():
                transcript_parts.append(text.strip())

        transcript = " ".join(transcript_parts).strip()
        language, probability = _read_information(information)

        if not transcript:
            return TranscriptionResult(
                success=False,
                language=language,
                language_probability=probability,
                error=(
                    "No clear speech was detected. Try recording again in a "
                    "quieter place and speak closer to the microphone."
                ),
            )

        return TranscriptionResult(
            success=True,
            text=transcript,
            language=language,
            language_probability=probability,
        )

    except ValueError as error:
        return TranscriptionResult(success=False, error=str(error))

    except MemoryError:
        return TranscriptionResult(
            success=False,
            error=(
                "The speech model ran out of memory. Close other applications "
                "or set WHISPER_MODEL_SIZE=tiny in your environment."
            ),
        )

    except Exception as error:
        return TranscriptionResult(
            success=False,
            error=(
                "Local speech transcription failed. Confirm that the audio is "
                "playable and that faster-whisper installed correctly. "
                f"Technical detail: {type(error).__name__}: {error}"
            ),
        )
