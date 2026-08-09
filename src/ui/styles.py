"""Load MediGuide Gradio CSS from styles.css."""

from pathlib import Path

_STYLES_PATH = Path(__file__).resolve().parent / "styles.css"


def load_css(hero_file_url: str = "") -> str:
    css = _STYLES_PATH.read_text(encoding="utf-8")
    hero = hero_file_url or ""
    return css.replace("__HERO_URL__", hero)
