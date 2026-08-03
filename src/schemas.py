from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class Role(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"


class ChatMessage(BaseModel):
    role: Role
    content: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class Citation(BaseModel):
    source: str
    snippet: str
    score: float


class RetrievedChunk(BaseModel):
    text: str
    source: str
    score: float


class SafetyCheckResult(BaseModel):
    is_emergency: bool
    matched_terms: list[str] = Field(default_factory=list)
    message: str | None = None


class ConversationResponse(BaseModel):
    reply: str
    citations: list[Citation] = Field(default_factory=list)
    is_emergency: bool = False


class SymptomEntry(BaseModel):
    description: str
    severity: str | None = None
    onset: str | None = None
    recorded_at: datetime = Field(default_factory=datetime.utcnow)


class ReportSummary(BaseModel):
    summary: str
    key_findings: list[str] = Field(default_factory=list)
    flagged_values: list[str] = Field(default_factory=list)
    disclaimer: str


class AppointmentSummary(BaseModel):
    summary: str
    action_items: list[str] = Field(default_factory=list)
    follow_up: str | None = None
