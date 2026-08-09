"""MediGuide AI — local educational health assistant."""

from src.ui.js import APP_JS
from src.ui.logic import HERO_FILE_URL, HERO_IMAGE
from src.ui.shell import build_demo
from src.ui.styles import load_css
from src.ui.theme import THEME

app, ui = build_demo()

CUSTOM_CSS = load_css(HERO_FILE_URL)


if __name__ == "__main__":
    allowed = [str(HERO_IMAGE.parent)] if HERO_IMAGE.exists() else None
    app.launch(
        theme=THEME,
        css=CUSTOM_CSS,
        js=APP_JS,
        allowed_paths=allowed,
    )
