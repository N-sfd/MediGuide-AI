"""Voice capture, review, and confirmation UI."""

from __future__ import annotations

import gradio as gr

from src.ui.logic import (
    VOICE_IDLE_HTML,
    VOICE_RECORDING_HTML,
    highlight_transcript_html,
    render_important_details_html,
)


def create_voice(ui) -> None:
    """Build the voice idle / recording / review panels."""
    with gr.Column(visible=False, elem_id="mg-voice") as voice_panel:
        ui.voice_panel = voice_panel
        ui.voice_phase = gr.State("idle")

        with gr.Column(visible=True, elem_id="mg-voice-idle") as voice_idle:
            ui.voice_idle = voice_idle
            gr.HTML(VOICE_IDLE_HTML, padding=False)
            ui.start_voice_btn = gr.Button(
                "Tap to start speaking",
                variant="primary",
                elem_id="mg-voice-start",
            )

        with gr.Column(
            visible=False,
            elem_id="mg-voice-recording",
        ) as voice_recording:
            ui.voice_recording = voice_recording
            ui.voice_stage_html = gr.HTML(
                VOICE_RECORDING_HTML,
                padding=False,
            )
            ui.audio_input = gr.Audio(
                sources=["microphone"],
                type="filepath",
                label="Recording",
                show_label=False,
                elem_id="mg-voice-audio",
                waveform_options={
                    "show_recording_waveform": True,
                    "waveform_color": "#176B5B",
                    "waveform_progress_color": "#2F9E88",
                },
            )
            with gr.Row(elem_id="mg-voice-controls"):
                ui.pause_voice_btn = gr.Button("Pause", variant="secondary")
                ui.finish_voice_btn = gr.Button("Finish", variant="primary")
                ui.cancel_voice_btn = gr.Button("Cancel", variant="secondary")

        with gr.Column(
            visible=False,
            elem_id="mg-voice-review",
        ) as voice_review:
            ui.voice_review = voice_review
            gr.HTML(
                "<h3 class='mg-voice-review-title'>Review your transcript</h3>",
                padding=False,
            )
            ui.transcript_highlight = gr.HTML(
                highlight_transcript_html(""),
                padding=False,
            )
            ui.transcript = gr.Textbox(
                label="Editable transcript",
                placeholder=(
                    "Correct any medical names, numbers, "
                    "units, or dates before sending."
                ),
                lines=5,
                buttons=["copy"],
                elem_id="mg-voice-transcript",
            )
            ui.voice_details = gr.HTML(
                render_important_details_html(""),
                padding=False,
            )
            ui.voice_confirmation = gr.Checkbox(
                label="I reviewed medical names and numbers",
                value=False,
            )
            with gr.Row():
                ui.rerecord_voice_btn = gr.Button(
                    "Record again",
                    variant="secondary",
                )
                ui.send_transcript_button = gr.Button(
                    "Send confirmed question",
                    variant="primary",
                )

        ui.voice_status = gr.Markdown(
            "Ready to record. Audio stays on this device.",
            elem_classes=["mg-status"],
        )
