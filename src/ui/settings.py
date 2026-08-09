"""Settings drawer: response, voice, privacy, and accessibility prefs."""

from __future__ import annotations

import gradio as gr

_DEFAULT_SETTINGS = {
    "language": "English",
    "answer_detail": "Standard",
    "reading_level": "Standard",
    "show_english": True,
    "voice_output": False,
    "voice": "Default",
    "speech_speed": 1.0,
    "autoplay": False,
    "local_mode": True,
    "text_size": "Medium",
    "reduced_motion": False,
    "high_contrast": False,
    "keyboard_nav": False,
}


def create_settings_drawer(ui) -> None:
    """Build the settings drawer panel and related state."""
    ui.settings_state = gr.State(dict(_DEFAULT_SETTINGS))
    ui.settings_drawer_open = gr.State(False)

    with gr.Column(
        visible=False,
        elem_classes=["mg-drawer-panel"],
        elem_id="mg-settings-drawer",
    ) as settings_drawer:
        ui.settings_drawer = settings_drawer

        gr.Markdown("### Response")
        ui.settings_language = gr.Dropdown(
            choices=["English"],
            value="English",
            label="Language",
        )
        ui.settings_answer_detail = gr.Dropdown(
            choices=["Concise", "Standard", "Detailed"],
            value="Standard",
            label="Answer detail",
        )
        ui.settings_reading_level = gr.Dropdown(
            choices=["Plain", "Standard"],
            value="Standard",
            label="Reading level",
        )
        ui.settings_show_english = gr.Checkbox(
            label="Always show English",
            value=True,
        )

        gr.Markdown("### Voice")
        ui.settings_voice_output = gr.Checkbox(
            label="Voice output",
            value=False,
        )
        ui.settings_voice_select = gr.Dropdown(
            choices=["Default"],
            value="Default",
            label="Voice",
        )
        ui.settings_speech_speed = gr.Slider(
            minimum=0.8,
            maximum=1.2,
            step=0.05,
            value=1.0,
            label="Speech speed",
        )
        ui.settings_autoplay = gr.Checkbox(
            label="Autoplay: Off",
            value=False,
        )

        gr.Markdown("### Privacy")
        ui.settings_local_mode = gr.Checkbox(
            label="Private Local Mode",
            value=True,
            interactive=False,
        )
        ui.clear_session_btn = gr.Button(
            "Clear session",
            variant="secondary",
        )
        ui.cleanup_temp_btn = gr.Button(
            "Clean temporary files",
            variant="secondary",
        )

        gr.Markdown("### Accessibility")
        ui.settings_text_size = gr.Dropdown(
            choices=["Small", "Medium", "Large"],
            value="Medium",
            label="Text size",
        )
        ui.settings_reduced_motion = gr.Checkbox(
            label="Reduced motion",
            value=False,
        )
        ui.settings_high_contrast = gr.Checkbox(
            label="High contrast",
            value=False,
        )
        ui.settings_keyboard_nav = gr.Checkbox(
            label="Keyboard navigation highlights",
            value=False,
        )
