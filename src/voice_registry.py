from dataclasses import dataclass
from pathlib import Path

from src.config import PIPER_VOICE_DIR


@dataclass(frozen=True)
class VoiceConfig:
    voice_id: str
    display_name: str
    language_code: str
    model_path: Path
    config_path: Path


VOICE_DEFINITIONS = {
    "en": {
        "voice_id": "en_US-lessac-medium",
        "display_name": "English — Lessac",
    },
    "es": {
        "voice_id": "es_ES-davefx-medium",
        "display_name": "Spanish — Davefx",
    },
    "fr": {
        "voice_id": "fr_FR-siwis-medium",
        "display_name": "French — Siwis",
    },
    "de": {
        "voice_id": "de_DE-thorsten-medium",
        "display_name": "German — Thorsten",
    },
    "ar": {
        "voice_id": "ar_JO-kareem-medium",
        "display_name": "Arabic — Kareem",
    },
}


def build_voice_config(
    language_code: str,
) -> VoiceConfig | None:
    definition = VOICE_DEFINITIONS.get(language_code)

    if not definition:
        return None

    voice_id = definition["voice_id"]
    voice_directory = PIPER_VOICE_DIR / voice_id

    model_path = voice_directory / f"{voice_id}.onnx"
    config_path = voice_directory / f"{voice_id}.onnx.json"

    if not model_path.exists() or not config_path.exists():
        return None

    return VoiceConfig(
        voice_id=voice_id,
        display_name=definition["display_name"],
        language_code=language_code,
        model_path=model_path,
        config_path=config_path,
    )


def get_available_voices() -> dict[str, VoiceConfig]:
    available: dict[str, VoiceConfig] = {}

    for language_code in VOICE_DEFINITIONS:
        voice = build_voice_config(language_code)

        if voice:
            available[language_code] = voice

    return available
