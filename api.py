"""FastAPI adapter for the MediGuide local AI services."""

from __future__ import annotations

import os
import re
import shutil
import tempfile
import uuid
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from src.config import (
    EMBEDDING_MODEL_NAME,
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
from src.image_analyzer import analyze_medical_document_image
from src.rag_chatbot import generate_rag_response
from src.transcriber import transcribe_audio
from src.tts import TextToSpeechError, synthesize_speech


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    history: list[dict[str, str]] = Field(default_factory=list)
    answer_detail: str = "Standard"
    reading_level: str = "Standard"


class TranslateRequest(BaseModel):
    text: str = Field(min_length=1, max_length=12000)
    language: str = Field(min_length=2, max_length=32)


class SpeakRequest(BaseModel):
    text: str = Field(min_length=1, max_length=MAX_TTS_CHARACTERS)
    language: str = "en"
    speed: float = Field(default=1.0, ge=0.5, le=2.0)


app = FastAPI(title="MediGuide AI API", version="1.0.0")

# Local Next.js + Cloudflare Workers/Pages frontend origins.
_DEFAULT_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
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


def _sources_from_answer(answer: str) -> list[dict[str, str | int]]:
    sources: list[dict[str, str | int]] = []
    source_section = answer.split("### Sources", 1)[-1]
    source_section = source_section.split("---", 1)[0]
    pattern = re.compile(
        r"\*\*\[(?P<number>\d+)\] (?P<title>.+?)\*\* — "
        r"(?P<publisher>.*?)(?: — Published: (?P<published>.*?))?"
        r"(?: — Knowledge-base review: (?P<reviewed>.*?))?"
        r"(?: — (?P<url>https?://\S+))?$"
    )
    for line in source_section.splitlines():
        match = pattern.search(line.strip())
        if match:
            values = match.groupdict()
            sources.append(
                {
                    "number": int(values["number"]),
                    "title": values["title"].strip(),
                    "publisher": values["publisher"].strip(),
                    "published": (values["published"] or "").strip(),
                    "reviewed": (values["reviewed"] or "").strip(),
                    "url": (values["url"] or "").strip(),
                }
            )
    return sources


def _health_status(available: bool, detail: str = "") -> dict[str, str]:
    return {"status": "ready" if available else "unavailable", "detail": detail}


@app.get("/api/health")
def health() -> dict[str, object]:
    piper_ready = bool(
        shutil.which(str(PIPER_EXECUTABLE)) or PIPER_EXECUTABLE.exists()
    )
    statuses = {
        "fastapi": _health_status(True, "API is responding"),
        "ollama": _health_status(bool(OLLAMA_HOST), "Host configured"),
        "text_model": _health_status(bool(MODEL_NAME), MODEL_NAME),
        "vision_model": _health_status(bool(VISION_MODEL_NAME), VISION_MODEL_NAME),
        "embedding_model": _health_status(bool(EMBEDDING_MODEL_NAME), EMBEDDING_MODEL_NAME),
        "vector_store": _health_status(VECTOR_STORE_DIR.exists(), "Approved knowledge store"),
        "whisper": _health_status(bool(WHISPER_MODEL_SIZE), WHISPER_MODEL_SIZE),
        "piper": _health_status(piper_ready, "Speech executable" if piper_ready else "Install Piper for spoken responses"),
        "translation_model": _health_status(bool(TRANSLATION_MODEL_NAME), TRANSLATION_MODEL_NAME),
    }
    ready = sum(item["status"] == "ready" for item in statuses.values())
    return {
        "status": "ok" if ready == len(statuses) else "degraded",
        "service": "mediguide-api",
        "ready": ready,
        "total": len(statuses),
        "statuses": statuses,
        "speech_output": str(SPEECH_OUTPUT_DIR),
    }


@app.post("/api/chat")
def chat(request: ChatRequest) -> dict[str, object]:
    answer = generate_rag_response(
        request.message,
        request.history,
        answer_detail=request.answer_detail,
        reading_level=request.reading_level,
    )
    return {
        "answer": answer,
        "sources": _sources_from_answer(answer),
    }


@app.post("/api/transcribe")
async def transcribe(file: UploadFile = File(...)) -> dict[str, object]:
    suffix = Path(file.filename or "audio.webm").suffix or ".webm"
    temp_path = Path(tempfile.gettempdir()) / f"mediguide-{uuid.uuid4().hex}{suffix}"
    temp_path.write_bytes(await file.read())
    try:
        result = transcribe_audio(str(temp_path))
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
    suffix = Path(file.filename or "document.png").suffix or ".png"
    temp_path = Path(tempfile.gettempdir()) / f"mediguide-{uuid.uuid4().hex}{suffix}"
    temp_path.write_bytes(await file.read())
    try:
        result = analyze_medical_document_image(str(temp_path), question)
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