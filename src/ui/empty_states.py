"""Empty-state HTML cards for MediGuide workspace panels."""

_ICON_CHAT = """
<svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6A2.5 2.5 0 0 1 16.5 15H10l-4 4v-4.2A2.5 2.5 0 0 1 5 12.5v-6Z"
        stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>
</svg>
""".strip()

_ICON_SOURCES = """
<svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <path d="M7 4h8l4 4v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z"
        stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>
  <path d="M15 4v4h4M9 12h6M9 16h6"
        stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
</svg>
""".strip()

_ICON_VOICE = """
<svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z"
        stroke="currentColor" stroke-width="1.7"/>
  <path d="M6.5 11a5.5 5.5 0 0 0 11 0M12 16.5V20"
        stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
</svg>
""".strip()

_ICON_HISTORY = """
<svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <path d="M12 5v7l4 2" stroke="currentColor" stroke-width="1.7"
        stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 8.5"
        stroke="currentColor" stroke-width="1.7" stroke-linecap="round"
        stroke-linejoin="round"/>
</svg>
""".strip()


def _empty_card(title: str, body: str, icon: str) -> str:
    return f"""
<div class="mg-empty-state">
  <div class="mg-empty-state-icon">{icon}</div>
  <h3>{title}</h3>
  <p>{body}</p>
</div>
""".strip()


EMPTY_NO_CONVERSATION = _empty_card(
    "No conversation",
    "Start with a question, voice recording, or document.",
    _ICON_CHAT,
)

EMPTY_NO_SOURCES = _empty_card(
    "No sources",
    "No approved sources have been added yet.",
    _ICON_SOURCES,
)

EMPTY_NO_VOICE = _empty_card(
    "No voice installed",
    "A local voice is not installed for this language. "
    "Continue with the written response.",
    _ICON_VOICE,
)

EMPTY_NO_HISTORY = _empty_card(
    "No history",
    "Your recent conversations will appear here during this session.",
    _ICON_HISTORY,
)
