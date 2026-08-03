import json

from src.models.text_model import TextModel, get_text_model
from src.safety.medical_guardrails import build_system_prompt
from src.schemas import AppointmentSummary

SUMMARY_INSTRUCTIONS = (
    "You will be given notes or a transcript from a medical appointment. Summarize what was "
    "discussed in plain language, list concrete action items the patient should follow up on, "
    "and note the next follow-up appointment or timeframe if one was mentioned. Respond ONLY "
    "with JSON matching this shape: "
    '{"summary": str, "action_items": [str], "follow_up": str|null}'
)


class AppointmentSummaryService:
    def __init__(self, text_model: TextModel | None = None):
        self.text_model = text_model or get_text_model()

    def summarize(self, notes: str) -> AppointmentSummary:
        messages = [{"role": "user", "content": notes}]
        raw_reply = self.text_model.generate(messages, system=build_system_prompt(SUMMARY_INSTRUCTIONS))

        try:
            parsed = json.loads(raw_reply)
        except (json.JSONDecodeError, TypeError):
            parsed = {"summary": raw_reply, "action_items": [], "follow_up": None}

        return AppointmentSummary(
            summary=parsed.get("summary", raw_reply),
            action_items=parsed.get("action_items", []),
            follow_up=parsed.get("follow_up"),
        )
