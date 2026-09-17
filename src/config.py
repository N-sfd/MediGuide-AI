import os
import shutil
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

APP_TITLE = "MediGuide AI"
MODEL_NAME = os.getenv("OLLAMA_MODEL", "gemma3:4b")
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
MAX_HISTORY_MESSAGES = int(os.getenv("MAX_HISTORY_MESSAGES", "12"))
TEMPERATURE = float(os.getenv("MODEL_TEMPERATURE", "0.2"))

WHISPER_MODEL_SIZE = os.getenv("WHISPER_MODEL_SIZE", "base")
WHISPER_DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
WHISPER_COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
MAX_AUDIO_MB = int(os.getenv("MAX_AUDIO_MB", "25"))
VISION_MODEL_NAME = os.getenv("OLLAMA_VISION_MODEL","gemma3:4b",)
MAX_IMAGE_MB = int(os.getenv("MAX_IMAGE_MB","10",))
MAX_IMAGE_WIDTH = int(os.getenv("MAX_IMAGE_WIDTH","2400",))
MAX_IMAGE_HEIGHT = int(os.getenv("MAX_IMAGE_HEIGHT","2400",))

KNOWLEDGE_DIR = Path(
    os.getenv(
        "KNOWLEDGE_DIR",
        str(BASE_DIR / "data" / "knowledge" / "approved"),
    )
)

VECTOR_STORE_DIR = Path(
    os.getenv(
        "VECTOR_STORE_DIR",
        str(BASE_DIR / "data" / "vector_store"),
    )
)

CHROMA_COLLECTION_NAME = os.getenv(
    "CHROMA_COLLECTION_NAME",
    "mediguide_trusted_medical_knowledge",
)

EMBEDDING_MODEL_NAME = os.getenv(
    "OLLAMA_EMBEDDING_MODEL",
    "embeddinggemma",
)

RAG_TOP_K = int(
    os.getenv(
        "RAG_TOP_K",
        "6",
    )
)

RAG_MAX_DISTANCE = float(
    os.getenv(
        "RAG_MAX_DISTANCE",
        "1.2",
    )
)

RAG_MAX_OUTPUT_TOKENS = int(
    os.getenv(
        "RAG_MAX_OUTPUT_TOKENS",
        "500",
    )
)

RAG_MAX_PASSAGE_WORDS = int(
    os.getenv(
        "RAG_MAX_PASSAGE_WORDS",
        "180",
    )
)

CHUNK_SIZE_WORDS = int(
    os.getenv(
        "CHUNK_SIZE_WORDS",
        "350",
    )
)

CHUNK_OVERLAP_WORDS = int(
    os.getenv(
        "CHUNK_OVERLAP_WORDS",
        "60",
    )
)

PIPER_EXECUTABLE = Path(
    os.getenv(
        "PIPER_EXECUTABLE",
        shutil.which("piper")
        or str(BASE_DIR / "tools" / "piper" / "piper.exe"),
    )
)

PIPER_VOICE_DIR = Path(
    os.getenv(
        "PIPER_VOICE_DIR",
        str(BASE_DIR / "voices"),
    )
)

SPEECH_OUTPUT_DIR = Path(
    os.getenv(
        "SPEECH_OUTPUT_DIR",
        str(BASE_DIR / "outputs" / "speech"),
    )
)

DEFAULT_RESPONSE_LANGUAGE = os.getenv(
    "DEFAULT_RESPONSE_LANGUAGE",
    "en",
)

TRANSLATION_MODEL_NAME = os.getenv(
    "OLLAMA_TRANSLATION_MODEL",
    "gemma3:4b",
)

MAX_TTS_CHARACTERS = int(
    os.getenv(
        "MAX_TTS_CHARACTERS",
        "3000",
    )
)

TTS_TIMEOUT_SECONDS = int(
    os.getenv(
        "TTS_TIMEOUT_SECONDS",
        "90",
    )
)

# Every direct Ollama call must bound how long it can hang — a deployed
# server often points OLLAMA_HOST at a localhost address with nothing
# listening, so without a timeout these calls hang until the client gives up.
OLLAMA_TIMEOUT_SECONDS = float(
    os.getenv(
        "OLLAMA_TIMEOUT_SECONDS",
        "20",
    )
)

# Bounded retry for transient (connection/timeout) Ollama failures during
# document/medication extraction. Permanent failures are never retried.
PROCESSING_RETRY_ATTEMPTS = int(
    os.getenv(
        "PROCESSING_RETRY_ATTEMPTS",
        "3",
    )
)

PROCESSING_RETRY_BACKOFF_SECONDS = float(
    os.getenv(
        "PROCESSING_RETRY_BACKOFF_SECONDS",
        "1.0",
    )
)

DELETE_SPEECH_AFTER_MINUTES = int(
    os.getenv(
        "DELETE_SPEECH_AFTER_MINUTES",
        "30",
    )
)

# Relational store for document → page → field → lab observation provenance.
# Default SQLite keeps local demos zero-config; switch to Postgres in production.
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"sqlite:///{(BASE_DIR / 'data' / 'mediguide.db').as_posix()}",
)