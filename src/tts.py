import shutil
import subprocess
import uuid
from pathlib import Path

from src.config import PIPER_EXECUTABLE, SPEECH_OUTPUT_DIR
from src.voice_registry import build_voice_config


class TextToSpeechError(RuntimeError):
    pass


def synthesize_speech(
    text: str,
    *,
    language_code: str = "en",
    length_scale: float = 1.0,
    output_path: str | Path | None = None,
) -> str:
    """Synthesize speech locally with Piper (https://github.com/rhasspy/piper).

    Piper runs fully offline, which matters here since responses can
    contain sensitive health information.
    """
    clean_text = (text or "").strip()

    if not clean_text:
        raise ValueError("Cannot synthesize speech for empty text.")

    executable = str(PIPER_EXECUTABLE)

    if not (shutil.which(executable) or Path(executable).exists()):
        raise TextToSpeechError(
            "The 'piper' executable was not found. Install it with "
            "`pip install piper-tts` and download a voice model."
        )

    voice = build_voice_config(language_code)

    if not voice:
        raise TextToSpeechError(
            f"No installed voice model for language '{language_code}'. "
            "Add its .onnx and .onnx.json files under the voices/ directory."
        )

    output = (
        Path(output_path)
        if output_path
        else SPEECH_OUTPUT_DIR / f"{uuid.uuid4().hex}.wav"
    )
    output.parent.mkdir(parents=True, exist_ok=True)

    command = [
        executable,
        "--model",
        str(voice.model_path),
        "--length_scale",
        str(length_scale),
        "--output_file",
        str(output),
    ]

    try:
        subprocess.run(
            command,
            input=clean_text,
            text=True,
            check=True,
            capture_output=True,
        )
    except subprocess.CalledProcessError as exc:
        raise TextToSpeechError(
            f"Piper failed to synthesize speech: {exc.stderr}"
        ) from exc

    return str(output)
