from __future__ import annotations

from unittest.mock import patch

import pytest

from src.shared.ollama_health import (
    VISION_MODEL_MISSING_MESSAGE,
    VISION_UNAVAILABLE_MESSAGE,
    require_vision_ready,
)
from src.shared.resilience import PermanentProcessingError


def test_require_vision_ready_fails_fast_when_ollama_unreachable():
    with patch("src.shared.ollama_health.probe_ollama", return_value=(False, "down", set())):
        with pytest.raises(PermanentProcessingError) as exc:
            require_vision_ready()
    assert VISION_UNAVAILABLE_MESSAGE in exc.value.message
    assert "down" in exc.value.technical_detail


def test_require_vision_ready_fails_when_vision_model_missing():
    with patch(
        "src.shared.ollama_health.probe_ollama",
        return_value=(True, "ok", {"embeddinggemma:latest"}),
    ):
        with pytest.raises(PermanentProcessingError) as exc:
            require_vision_ready()
    assert VISION_MODEL_MISSING_MESSAGE in exc.value.message


def test_require_vision_ready_passes_when_model_present():
    with patch(
        "src.shared.ollama_health.probe_ollama",
        return_value=(True, "ok", {"gemma3:4b", "embeddinggemma:latest"}),
    ):
        require_vision_ready()


def test_require_vision_ready_fails_when_ollama_package_missing():
    import builtins

    real_import = builtins.__import__

    def fake_import(name, *args, **kwargs):
        if name == "ollama":
            raise ImportError("No module named ollama")
        return real_import(name, *args, **kwargs)

    with patch("builtins.__import__", side_effect=fake_import):
        with pytest.raises(PermanentProcessingError) as exc:
            require_vision_ready()
    assert VISION_UNAVAILABLE_MESSAGE in exc.value.message
