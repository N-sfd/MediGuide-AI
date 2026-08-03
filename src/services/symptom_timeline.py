import json
from pathlib import Path

from src.config import CONFIG
from src.models.text_model import TextModel, get_text_model
from src.safety.medical_guardrails import build_system_prompt
from src.schemas import SymptomEntry

EXTRACTION_INSTRUCTIONS = (
    "Extract a single structured symptom entry from the user's free-text description. "
    "Respond ONLY with JSON matching this shape: "
    '{"description": str, "severity": str|null, "onset": str|null}. '
    "'severity' should be a short phrase like 'mild', 'moderate', or 'severe' if stated or "
    "clearly implied, otherwise null. 'onset' should describe when it started if mentioned, "
    "otherwise null."
)


class SymptomTimelineService:
    def __init__(self, text_model: TextModel | None = None, storage_path: Path | None = None):
        self.text_model = text_model or get_text_model()
        self.storage_path = storage_path or (CONFIG.output_dir / "symptom_timeline.json")

    def _load(self) -> list[dict]:
        if not self.storage_path.exists():
            return []
        return json.loads(self.storage_path.read_text(encoding="utf-8"))

    def _save(self, entries: list[dict]) -> None:
        self.storage_path.parent.mkdir(parents=True, exist_ok=True)
        self.storage_path.write_text(json.dumps(entries, indent=2, default=str), encoding="utf-8")

    def add_entry(self, description: str) -> SymptomEntry:
        messages = [{"role": "user", "content": description}]
        raw_reply = self.text_model.generate(messages, system=build_system_prompt(EXTRACTION_INSTRUCTIONS))

        try:
            parsed = json.loads(raw_reply)
        except (json.JSONDecodeError, TypeError):
            parsed = {"description": description, "severity": None, "onset": None}

        entry = SymptomEntry(
            description=parsed.get("description", description),
            severity=parsed.get("severity"),
            onset=parsed.get("onset"),
        )

        entries = self._load()
        entries.append(entry.model_dump(mode="json"))
        self._save(entries)
        return entry

    def get_timeline(self) -> list[SymptomEntry]:
        return [SymptomEntry(**entry) for entry in self._load()]
