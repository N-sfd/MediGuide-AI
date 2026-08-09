"""Stage banners and skeleton placeholders for MediGuide loading UX."""

from __future__ import annotations

STAGE: dict[str, str] = {
    "retrieval": "Searching approved medical sources…",
    "generation": "Preparing a plain-language explanation…",
    "vision": "Reading visible document information…",
    "whisper": "Creating a local transcript…",
    "translation": "Preparing the Spanish version…",
    "tts": "Generating local voice playback…",
}


def skeleton_html(lines: int = 5) -> str:
    """Return shimmer skeleton lines for the answer column."""
    count = max(1, int(lines))
    widths = (92, 78, 86, 64, 72)[:count] + tuple([88] * max(0, count - 5))
    line_divs = "\n".join(
        f'  <div class="skeleton-line" style="width: {width}%;"></div>'
        for width in widths
    )
    return f'<div class="mg-skeleton" aria-hidden="true">\n{line_divs}\n</div>'


def stage_banner_html(stage: str) -> str:
    """Banner for the current loading stage (retrieval, generation, …)."""
    key = (stage or "").strip().lower()
    message = STAGE.get(key, STAGE["generation"])
    label = key.capitalize() if key in STAGE else "Working"
    return (
        f'<div class="mg-stage-banner" data-stage="{key}" role="status" '
        f'aria-live="polite">'
        f'<span class="mg-stage-label">{label}</span>'
        f'<span class="mg-stage-message">{message}</span>'
        f"</div>"
    )
