import json
from pathlib import Path

from src.models.text_model import TextModel, get_text_model
from src.models.vision_model import VisionModel, get_vision_model
from src.safety.medical_guardrails import DISCLAIMER, build_system_prompt
from src.schemas import ReportSummary

IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".webp"}

TRANSCRIBE_PROMPT = (
    "Transcribe all visible text from this medical report or lab result image exactly as "
    "written, including labels, values, units, and reference ranges."
)

SUMMARY_INSTRUCTIONS = (
    "You will be given the raw text of a lab report or medical document. Summarize it in "
    "plain language for the patient. Identify values that fall outside the stated reference "
    "range as 'flagged_values', but do not diagnose what they mean — just note that they are "
    "outside range and worth discussing with a clinician. Respond ONLY with JSON matching this "
    'shape: {"summary": str, "key_findings": [str], "flagged_values": [str]}'
)


class ReportReaderService:
    def __init__(self, text_model: TextModel | None = None, vision_model: VisionModel | None = None):
        self.text_model = text_model or get_text_model()
        self.vision_model = vision_model or get_vision_model()

    def _extract_text(self, path: Path) -> str:
        if path.suffix.lower() in IMAGE_SUFFIXES:
            return self.vision_model.describe(path, TRANSCRIBE_PROMPT)
        if path.suffix.lower() == ".pdf":
            from pypdf import PdfReader

            reader = PdfReader(str(path))
            return "\n".join(page.extract_text() or "" for page in reader.pages)
        return path.read_text(encoding="utf-8", errors="ignore")

    def summarize(self, file_path: str | Path) -> ReportSummary:
        path = Path(file_path)
        raw_text = self._extract_text(path)

        messages = [{"role": "user", "content": f"Document text:\n\n{raw_text}"}]
        system_prompt = build_system_prompt(SUMMARY_INSTRUCTIONS)
        raw_reply = self.text_model.generate(messages, system=system_prompt)

        try:
            parsed = json.loads(raw_reply)
        except (json.JSONDecodeError, TypeError):
            parsed = {"summary": raw_reply, "key_findings": [], "flagged_values": []}

        return ReportSummary(
            summary=parsed.get("summary", raw_reply),
            key_findings=parsed.get("key_findings", []),
            flagged_values=parsed.get("flagged_values", []),
            disclaimer=DISCLAIMER,
        )
