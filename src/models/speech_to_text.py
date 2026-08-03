from pathlib import Path

from faster_whisper import WhisperModel


class SpeechTranscriber:
    def __init__(
        self,
        model_size: str = "base",
        device: str = "cpu",
        compute_type: str = "int8",
    ) -> None:
        self.model = WhisperModel(
            model_size,
            device=device,
            compute_type=compute_type,
        )

    def transcribe(self, audio_path: str) -> str:
        path = Path(audio_path)

        if not path.exists():
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        segments, _ = self.model.transcribe(
            str(path),
            beam_size=5,
            vad_filter=True,
        )

        transcript = " ".join(
            segment.text.strip()
            for segment in segments
            if segment.text.strip()
        )

        return transcript.strip()