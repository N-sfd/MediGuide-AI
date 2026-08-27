"""Medical agent orchestration skeleton (Milestone 5).

Frontend callers should eventually go through this service instead of
knowing whether RAG, vision, speech, or document pipelines were used.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal


Intent = Literal[
    "education",
    "document",
    "lab_timeline",
    "visit_preparation",
    "medication",
]


@dataclass
class SafetyDecision:
    allowed: bool
    response: dict[str, Any] | None = None
    reason: str = ""


@dataclass
class OrchestratorRequest:
    message: str = ""
    intent_hint: Intent | None = None
    conversation_id: str | None = None
    document_id: str | None = None
    metadata: dict[str, Any] | None = None


class MedicalAgentOrchestrator:
    """Routes multimodal requests after privacy and safety gates."""

    async def privacy_check(self, request: OrchestratorRequest) -> dict[str, Any]:
        return {"ok": True, "mode": "local_session"}

    async def safety_gateway_evaluate(
        self, request: OrchestratorRequest
    ) -> SafetyDecision:
        from src.safety import check_for_emergency

        if not request.message.strip():
            return SafetyDecision(allowed=True)
        emergency = check_for_emergency(request.message)
        if emergency.is_emergency:
            return SafetyDecision(
                allowed=False,
                response={
                    "status": "emergency",
                    "answer": emergency.message
                    or "Call emergency services immediately.",
                },
                reason="emergency_routing",
            )
        return SafetyDecision(allowed=True)

    async def intent_router_classify(self, request: OrchestratorRequest) -> Intent:
        if request.intent_hint:
            return request.intent_hint
        text = request.message.lower()
        if any(token in text for token in ("lab", "hemoglobin", "a1c", "timeline")):
            return "lab_timeline"
        if any(token in text for token in ("visit", "appointment", "prepare")):
            return "visit_preparation"
        if any(token in text for token in ("medication", "prescription", "label")):
            return "medication"
        if request.document_id or "document" in text or "pdf" in text:
            return "document"
        return "education"

    async def process(self, request: OrchestratorRequest) -> dict[str, Any]:
        await self.privacy_check(request)
        safety = await self.safety_gateway_evaluate(request)
        if not safety.allowed:
            return safety.response or {"status": "blocked"}

        intent = await self.intent_router_classify(request)
        return {
            "status": "routed",
            "intent": intent,
            "message": (
                "Orchestrator routing is active. Concrete agent execution "
                "is implemented in subsystem routers during Milestones 2–5."
            ),
            "request": {
                "conversation_id": request.conversation_id,
                "document_id": request.document_id,
            },
        }
