import os

from dotenv import load_dotenv

load_dotenv()

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