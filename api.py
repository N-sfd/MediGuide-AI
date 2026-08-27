"""FastAPI adapter for the MediGuide local AI services."""

from __future__ import annotations

import asyncio
import importlib.util
import json
import os
import shutil
import tempfile
import uuid
from collections.abc import Iterator
from pathlib import Path

import requests
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field

from src.config import (
    CHROMA_COLLECTION_NAME,
    EMBEDDING_MODEL_NAME,
    KNOWLEDGE_DIR,
    MAX_AUDIO_MB,
    MAX_IMAGE_MB,
    MAX_TTS_CHARACTERS,
    MODEL_NAME,
    OLLAMA_HOST,
    PIPER_EXECUTABLE,
    SPEECH_OUTPUT_DIR,
    VECTOR_STORE_DIR,
    VISION_MODEL_NAME,
    WHISPER_MODEL_SIZE,
    TRANSLATION_MODEL_NAME,
)
from src.document_intelligence import router as document_intelligence_router
from src.document_loader import load_metadata
from src.image_analyzer import analyze_medical_document_image
from src.medication_workspace import router as medication_workspace_router
from src.api.labs import router as labs_router
from src.rag_chatbot import stream_rag_events
from src.transcriber import transcribe_audio
from src.tts import TextToSpeechError, synthesize_speech
from src.database.session import init_db, probe_database
from src.agents import MedicalAgentOrchestrator, OrchestratorRequest

OLLAMA_PROBE_TIMEOUT = float(os.getenv("OLLAMA_PROBE_TIMEOUT", "2.5"))
UPLOAD_CHUNK_BYTES = 1024 * 1024

AUDIO_SUFFIXES = {".webm", ".wav", ".mp3", ".m4a", ".ogg", ".oga", ".flac", ".mp4"}
IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".webp"}

ANSWER_DETAIL_CHOICES = {"Concise", "Standard", "Detailed"}
READING_LEVEL_CHOICES = {"Plain", "Standard"}


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    history: list[dict[str, str]] = Field(default_factory=list)
    answer_detail: str = "Standard"
    reading_level: str = "Standard"

    def normalized_detail(self) -> str:
        return self.answer_detail if self.answer_detail in ANSWER_DETAIL_CHOICES else "Standard"

    def normalized_level(self) -> str:
        return self.reading_level if self.reading_level in READING_LEVEL_CHOICES else "Standard"


class TranslateRequest(BaseModel):
    text: str = Field(min_length=1, max_length=12000)
    language: str = Field(min_length=2, max_length=32)


class SpeakRequest(BaseModel):
    text: str = Field(min_length=1, max_length=MAX_TTS_CHARACTERS)
    language: str = "en"
    speed: float = Field(default=1.0, ge=0.5, le=2.0)


app = FastAPI(title="MediGuide AI API", version="1.1.0")

# Local Next.js + Cloudflare Workers/Pages frontend origins.
_DEFAULT_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://medi.naziaasif1412.workers.dev",
    "https://frontend.naziaasif1412.workers.dev",
]
_env_origins = [
    origin.strip()
    for origin in os.getenv("FRONTEND_ORIGINS", "").split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_env_origins or _DEFAULT_ORIGINS,
    allow_origin_regex=r"https://.*\.(workers\.dev|pages\.dev)",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# These routers already declare their own prefixes — no extra prefix
# here, or every route (including served page/preview files) breaks.
app.include_router(document_intelligence_router)
app.include_router(medication_workspace_router)
app.include_router(labs_router)


@app.on_event("startup")
def _startup() -> None:
    try:
        init_db()
    except Exception:
        # API remains usable for chat/RAG even if the relational store is offline.
        pass



# --------------------------------------------------------------------------
# Uploads
# --------------------------------------------------------------------------


async def _store_upload(
    file: UploadFile,
    *,
    max_mb: int,
    allowed_suffixes: set[str],
    fallback_name: str,
) -> Path:
    """Streams an upload to a temp file, rejecting oversized or unknown types.

    Reading in chunks keeps a large upload from being held in memory in
    full, and lets the request be refused as soon as the cap is passed.
    """
    suffix = Path(file.filename or fallback_name).suffix.lower()

    if suffix not in allowed_suffixes:
        raise HTTPException(
            status_code=415,
            detail=(
                f"Unsupported file type '{suffix or 'unknown'}'. "
                f"Accepted: {', '.join(sorted(allowed_suffixes))}."
            ),
        )

    max_bytes = max_mb * 1024 * 1024
    temp_path = Path(tempfile.gettempdir()) / f"mediguide-{uuid.uuid4().hex}{suffix}"
    written = 0

    try:
        with temp_path.open("wb") as target:
            while chunk := await file.read(UPLOAD_CHUNK_BYTES):
                written += len(chunk)

                if written > max_bytes:
                    raise HTTPException(
                        status_code=413,
                        detail=f"File is larger than the {max_mb} MB limit.",
                    )

                target.write(chunk)
    except Exception:
        temp_path.unlink(missing_ok=True)
        raise

    if not written:
        temp_path.unlink(missing_ok=True)
        raise HTTPException(status_code=422, detail="The uploaded file was empty.")

    return temp_path


# --------------------------------------------------------------------------
# Health
# --------------------------------------------------------------------------


def _health_status(available: bool, detail: str = "") -> dict[str, str]:
    return {"status": "ready" if available else "unavailable", "detail": detail}


def _probe_ollama() -> tuple[bool, str, set[str]]:
    """Asks Ollama which models it actually has, rather than trusting config."""
    endpoint = f"{OLLAMA_HOST.rstrip('/')}/api/tags"

    try:
        response = requests.get(endpoint, timeout=OLLAMA_PROBE_TIMEOUT)
        response.raise_for_status()
        installed = {
            str(model.get("name", ""))
            for model in response.json().get("models", [])
        }
        return True, f"Connected · {len(installed)} models installed", installed
    except Exception as error:
        return False, f"Cannot reach {OLLAMA_HOST} ({type(error).__name__})", set()


def _model_status(model: str, installed: set[str], reachable: bool) -> dict[str, str]:
    if not model:
        return _health_status(False, "No model configured")

    if not reachable:
        return _health_status(False, f"{model} · Ollama unreachable")

    wanted = model if ":" in model else f"{model}:latest"

    if wanted in installed or model in installed:
        return _health_status(True, model)

    return _health_status(False, f"{model} · not pulled (ollama pull {model})")


def _probe_vector_store() -> dict[str, str]:
    if not VECTOR_STORE_DIR.exists():
        return _health_status(False, "No vector store — run ingest_knowledge.py")

    try:
        from src.vector_store import get_chroma_collection

        count = get_chroma_collection().count()
    except Exception as error:
        return _health_status(False, f"Unreadable ({type(error).__name__})")

    if not count:
        return _health_status(
            False, f"'{CHROMA_COLLECTION_NAME}' is empty — run ingest_knowledge.py"
        )

    return _health_status(True, f"{count} approved passages indexed")


@app.get("/api/health")
def health() -> dict[str, object]:
    reachable, ollama_detail, installed = _probe_ollama()
    piper_ready = bool(shutil.which(str(PIPER_EXECUTABLE)) or PIPER_EXECUTABLE.exists())
    whisper_ready = importlib.util.find_spec("faster_whisper") is not None
    db_ok, db_detail = probe_database()

    statuses = {
        "fastapi": _health_status(True, "API is responding"),
        "ollama": _health_status(reachable, ollama_detail),
        "text_model": _model_status(MODEL_NAME, installed, reachable),
        "vision_model": _model_status(VISION_MODEL_NAME, installed, reachable),
        "embedding_model": _model_status(EMBEDDING_MODEL_NAME, installed, reachable),
        "vector_store": _probe_vector_store(),
        "database": _health_status(db_ok, db_detail),
        "whisper": _health_status(
            whisper_ready,
            f"{WHISPER_MODEL_SIZE} model" if whisper_ready else "faster-whisper not installed",
        ),
        "piper": _health_status(
            piper_ready,
            "Speech executable" if piper_ready else "Install Piper for spoken responses",
        ),
        "translation_model": _model_status(TRANSLATION_MODEL_NAME, installed, reachable),
    }
    ready = sum(item["status"] == "ready" for item in statuses.values())

    # Answers still work without speech, translation, or Postgres, so they do not
    # make the service unhealthy on their own.
    essential = ("fastapi", "ollama", "text_model", "embedding_model", "vector_store")
    degraded = any(statuses[key]["status"] != "ready" for key in essential)

    knowledge_count = 0
    try:
        from src.vector_store import get_chroma_collection

        knowledge_count = get_chroma_collection().count()
    except Exception:
        knowledge_count = 0

    approved_sources = 0
    if KNOWLEDGE_DIR.exists():
        approved_sources = len(list(KNOWLEDGE_DIR.glob("*.json")))

    return {
        "status": "degraded" if degraded else ("ok" if ready == len(statuses) else "partial"),
        "service": "mediguide-api",
        "ready": ready,
        "total": len(statuses),
        "statuses": statuses,
        "knowledge": {
            "active_chunks": knowledge_count,
            "approved_sources": approved_sources,
        },
    }


@app.get("/api/system/status")
def system_status() -> dict[str, object]:
    """Portfolio-friendly system page payload without secrets or paths."""
    payload = health()
    statuses = payload["statuses"]
    assert isinstance(statuses, dict)
    return {
        "service": "MediGuide System",
        "overall": payload["status"],
        "components": [
            {"name": "API", "key": "fastapi", **statuses["fastapi"]},
            {"name": "Ollama", "key": "ollama", **statuses["ollama"]},
            {"name": "Text model", "key": "text_model", **statuses["text_model"]},
            {"name": "Vision model", "key": "vision_model", **statuses["vision_model"]},
            {"name": "Whisper", "key": "whisper", **statuses["whisper"]},
            {"name": "Embedding model", "key": "embedding_model", **statuses["embedding_model"]},
            {"name": "ChromaDB", "key": "vector_store", **statuses["vector_store"]},
            {"name": "Database", "key": "database", **statuses["database"]},
            {"name": "Piper", "key": "piper", **statuses["piper"]},
        ],
        "knowledge": payload.get("knowledge", {}),
    }


class OrchestrateRequest(BaseModel):
    message: str = Field(default="", max_length=4000)
    intent_hint: str | None = None
    conversation_id: str | None = None
    document_id: str | None = None


@app.post("/api/orchestrate")
async def orchestrate(request: OrchestrateRequest) -> dict[str, object]:
    orchestrator = MedicalAgentOrchestrator()
    hint = request.intent_hint if request.intent_hint in {
        "education",
        "document",
        "lab_timeline",
        "visit_preparation",
        "medication",
    } else None
    result = await orchestrator.process(
        OrchestratorRequest(
            message=request.message,
            intent_hint=hint,  # type: ignore[arg-type]
            conversation_id=request.conversation_id,
            document_id=request.document_id,
        )
    )
    return result



# --------------------------------------------------------------------------
# Knowledge base
# --------------------------------------------------------------------------


@app.get("/api/knowledge")
def knowledge() -> dict[str, object]:
    """Lists the approved sources the assistant is allowed to draw on."""
    entries: list[dict[str, str]] = []

    for metadata_path in sorted(KNOWLEDGE_DIR.glob("*.json")):
        try:
            metadata = load_metadata(metadata_path)
        except Exception:
            continue

        if not metadata.get("approved") or metadata.get("status", "active") != "active":
            continue

        entries.append(
            {
                "id": str(metadata.get("source_id", metadata_path.stem)),
                "title": str(metadata.get("title", metadata_path.stem)),
                "publisher": str(metadata.get("publisher", "")),
                "url": str(metadata.get("source_url", "")),
                "published": str(metadata.get("publication_date", "")),
                "reviewed": str(metadata.get("review_date", "")),
                "type": str(metadata.get("document_type", "patient_education")),
            }
        )

    return {"count": len(entries), "sources": entries}


# --------------------------------------------------------------------------
# Chat
# --------------------------------------------------------------------------


@app.post("/api/chat")
def chat(request: ChatRequest) -> dict[str, object]:
    answer = "MediGuide could not produce an answer."
    sources: list[dict[str, object]] = []
    status = "error"

    try:
        for event in stream_rag_events(
            request.message,
            request.history,
            answer_detail=request.normalized_detail(),
            reading_level=request.normalized_level(),
        ):
            if event["type"] == "done":
                answer, sources, status = (
                    event["answer"],
                    event["sources"],
                    event["status"],
                )
    except Exception as error:
        raise HTTPException(
            status_code=502,
            detail=f"The local AI service failed: {type(error).__name__}: {error}",
        ) from error

    return {"answer": answer, "sources": sources, "status": status}


def _sse(event: dict[str, object]) -> str:
    return f"data: {json.dumps(event)}\n\n"


def _chat_events(request: ChatRequest) -> Iterator[str]:
    try:
        for event in stream_rag_events(
            request.message,
            request.history,
            answer_detail=request.normalized_detail(),
            reading_level=request.normalized_level(),
        ):
            yield _sse(event)
    except Exception as error:
        yield _sse(
            {
                "type": "done",
                "answer": (
                    "MediGuide could not complete this answer.\n\n"
                    f"Technical detail: {type(error).__name__}: {error}"
                ),
                "sources": [],
                "status": "error",
            }
        )

    yield "data: [DONE]\n\n"


@app.post("/api/chat/stream")
def chat_stream(request: ChatRequest) -> StreamingResponse:
    """Server-sent events carrying the answer as the model writes it.

    Only the final ``done`` event has passed citation and safety
    validation; everything before it is a draft shown so the wait is
    visible rather than blank.
    """
    return StreamingResponse(
        _chat_events(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# --------------------------------------------------------------------------
# Voice, documents, translation, speech
# --------------------------------------------------------------------------


@app.post("/api/transcribe")
async def transcribe(file: UploadFile = File(...)) -> dict[str, object]:
    temp_path = await _store_upload(
        file,
        max_mb=MAX_AUDIO_MB,
        allowed_suffixes=AUDIO_SUFFIXES,
        fallback_name="audio.webm",
    )
    try:
        result = await asyncio.to_thread(transcribe_audio, str(temp_path))

        if not result.success:
            raise HTTPException(status_code=422, detail=result.error)

        return {
            "text": result.text,
            "language": result.language,
            "language_probability": result.language_probability,
        }
    finally:
        temp_path.unlink(missing_ok=True)


@app.post("/api/documents/analyze")
async def analyze_document(
    file: UploadFile = File(...),
    question: str = Form("Extract and organize only the clearly visible information."),
) -> dict[str, object]:
    temp_path = await _store_upload(
        file,
        max_mb=MAX_IMAGE_MB,
        allowed_suffixes=IMAGE_SUFFIXES,
        fallback_name="document.png",
    )
    try:
        result = await asyncio.to_thread(
            analyze_medical_document_image, str(temp_path), question
        )

        if not result.success:
            raise HTTPException(status_code=422, detail=result.error)

        return {"data": result.structured_data, "raw_text": result.raw_text}
    finally:
        temp_path.unlink(missing_ok=True)


@app.post("/api/translate")
def translate(request: TranslateRequest) -> dict[str, str]:
    from ollama import Client

    try:
        response = Client(host=OLLAMA_HOST).chat(
            model=TRANSLATION_MODEL_NAME,
            messages=[
                {
                    "role": "system",
                    "content": "Translate accurately. Preserve headings, citations, and safety language. Return only the translation.",
                },
                {
                    "role": "user",
                    "content": f"Translate into {request.language}:\n\n{request.text}",
                },
            ],
            options={"temperature": 0.1},
        )
        return {"text": response.message.content.strip(), "language": request.language}
    except Exception as error:
        raise HTTPException(status_code=502, detail=f"Translation failed: {error}") from error


@app.post("/api/speak")
def speak(request: SpeakRequest) -> FileResponse:
    try:
        output_path = synthesize_speech(
            request.text,
            language_code=request.language,
            length_scale=1.0 / request.speed,
        )
    except (TextToSpeechError, ValueError) as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    return FileResponse(output_path, media_type="audio/wav", filename="mediguide-answer.wav")
