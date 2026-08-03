import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

ROOT_DIR = Path(__file__).resolve().parent.parent


@dataclass(frozen=True)
class Config:
    text_backend: str
    vision_backend: str

    ollama_host: str
    ollama_text_model: str
    ollama_vision_model: str

    anthropic_api_key: str | None
    claude_text_model: str
    claude_vision_model: str

    whisper_model: str
    piper_model_path: str | None

    embedding_model: str
    knowledge_dir: Path
    vector_store_dir: Path
    output_dir: Path

    server_name: str
    server_port: int


def load_config() -> Config:
    return Config(
        text_backend=os.getenv("MEDIGUIDE_TEXT_BACKEND", "ollama"),
        vision_backend=os.getenv("MEDIGUIDE_VISION_BACKEND", "ollama"),
        ollama_host=os.getenv("OLLAMA_HOST", "http://localhost:11434"),
        ollama_text_model=os.getenv("MEDIGUIDE_OLLAMA_TEXT_MODEL", "llama3.1"),
        ollama_vision_model=os.getenv("MEDIGUIDE_OLLAMA_VISION_MODEL", "llava"),
        anthropic_api_key=os.getenv("ANTHROPIC_API_KEY") or None,
        claude_text_model=os.getenv("MEDIGUIDE_CLAUDE_TEXT_MODEL", "claude-opus-5"),
        claude_vision_model=os.getenv("MEDIGUIDE_CLAUDE_VISION_MODEL", "claude-opus-5"),
        whisper_model=os.getenv("MEDIGUIDE_WHISPER_MODEL", "base"),
        piper_model_path=os.getenv("MEDIGUIDE_PIPER_MODEL_PATH") or None,
        embedding_model=os.getenv("MEDIGUIDE_EMBEDDING_MODEL", "all-MiniLM-L6-v2"),
        knowledge_dir=ROOT_DIR / os.getenv("MEDIGUIDE_KNOWLEDGE_DIR", "data/knowledge"),
        vector_store_dir=ROOT_DIR / os.getenv("MEDIGUIDE_VECTOR_STORE_DIR", "data/vector_store"),
        output_dir=ROOT_DIR / os.getenv("MEDIGUIDE_OUTPUT_DIR", "outputs"),
        server_name=os.getenv("MEDIGUIDE_SERVER_NAME", "127.0.0.1"),
        server_port=int(os.getenv("MEDIGUIDE_SERVER_PORT", "7860")),
    )


CONFIG = load_config()
