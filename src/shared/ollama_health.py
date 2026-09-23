"""Short preflight checks before expensive Ollama vision/chat calls.

Deployed backends often point ``OLLAMA_HOST`` at localhost with nothing
listening (see ``render.yaml``). Without a probe, vision OCR burns three
long client timeouts and surfaces a misleading "did not respond in time"
error. A 2–3s tags probe fails permanently and immediately instead.
"""

from __future__ import annotations

import os

import requests

from src.config import OLLAMA_HOST, VISION_MODEL_NAME
from src.shared.resilience import PermanentProcessingError

OLLAMA_PROBE_TIMEOUT = float(os.getenv("OLLAMA_PROBE_TIMEOUT", "2.5"))

VISION_UNAVAILABLE_MESSAGE = (
    "Document reading needs the local vision service, which is not available "
    "on this deployment. Upload a digital PDF with selectable text, or run "
    "MediGuide locally with Ollama and the vision model pulled."
)

VISION_MODEL_MISSING_MESSAGE = (
    "The vision model is not installed on the AI service. "
    f"Pull it with: ollama pull {VISION_MODEL_NAME}"
)


def probe_ollama(timeout: float = OLLAMA_PROBE_TIMEOUT) -> tuple[bool, str, set[str]]:
    """Returns (reachable, detail, installed model names)."""
    endpoint = f"{OLLAMA_HOST.rstrip('/')}/api/tags"
    try:
        response = requests.get(endpoint, timeout=timeout)
        response.raise_for_status()
        installed = {
            str(model.get("name", ""))
            for model in response.json().get("models", [])
        }
        return True, f"Connected · {len(installed)} models installed", installed
    except Exception as error:
        return False, f"Cannot reach {OLLAMA_HOST} ({type(error).__name__})", set()


def _model_installed(model: str, installed: set[str]) -> bool:
    if not model:
        return False
    wanted = model if ":" in model else f"{model}:latest"
    return wanted in installed or model in installed


def require_vision_ready() -> None:
    """Raises PermanentProcessingError if vision OCR cannot run."""
    try:
        import ollama  # noqa: F401
    except ImportError as error:
        raise PermanentProcessingError(
            VISION_UNAVAILABLE_MESSAGE,
            technical_detail=f"{type(error).__name__}: {error}",
        ) from error

    reachable, detail, installed = probe_ollama()
    if not reachable:
        raise PermanentProcessingError(
            VISION_UNAVAILABLE_MESSAGE,
            technical_detail=detail,
        )

    if not _model_installed(VISION_MODEL_NAME, installed):
        raise PermanentProcessingError(
            VISION_MODEL_MISSING_MESSAGE,
            technical_detail=detail,
        )
