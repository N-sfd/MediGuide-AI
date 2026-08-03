import shutil
import subprocess
from pathlib import Path

from src.config import CONFIG


class TextToSpeechError(RuntimeError):
    pass


def synthesize_speech(
    text: str,
    model_path: str | None = None,
    output_path: str | Path = "outputs/response.wav",
) -> str:
    """Synthesize speech locally with Piper (https://github.com/rhasspy/piper).

    Requires the `piper` executable on PATH (`pip install piper-tts`) and a
    downloaded voice model — an `<voice>.onnx` file alongside its
    `<voice>.onnx.json` config. Piper runs fully offline, which matters here
    since responses can contain sensitive health information.
    """
    if not text or not text.strip():
        raise ValueError("Cannot synthesize speech for empty text.")

    if shutil.which("piper") is None:
        raise TextToSpeechError(
            "The 'piper' executable was not found on PATH. Install it with "
            "`pip install piper-tts` and download a voice model."
        )

    resolved_model_path = model_path or CONFIG.piper_model_path
    if not resolved_model_path:
        raise TextToSpeechError(
            "No Piper voice model configured. Set MEDIGUIDE_PIPER_MODEL_PATH in "
            ".env (or pass model_path explicitly) to the path of a .onnx voice file."
        )

    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)

    command = [
        "piper",
        "--model",
        resolved_model_path,
        "--output_file",
        str(output),
    ]

    try:
        subprocess.run(command, input=text, text=True, check=True, capture_output=True)
    except subprocess.CalledProcessError as exc:
        raise TextToSpeechError(f"Piper failed to synthesize speech: {exc.stderr}") from exc

    return str(output)
