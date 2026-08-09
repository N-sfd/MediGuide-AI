"""Conversation workspace: history, answer document, and evidence."""

from __future__ import annotations

import gradio as gr

from src.ui.logic import (
    ANSWER_PLACEHOLDER,
    EMPTY_NO_HISTORY,
    EVIDENCE_PLACEHOLDER,
)


def create_conversation_workspace(ui) -> None:
    """Build the chat workspace columns into the current Blocks context."""
    with gr.Column(
        visible=False,
        elem_classes=["mg-chat-shell"],
    ) as chat_workspace:
        ui.chat_workspace = chat_workspace

        with gr.Row(elem_id="mg-workspace"):
            with gr.Column(elem_id="mg-history"):
                gr.Markdown(
                    "Conversation history",
                    elem_classes=["mg-history-label"],
                )
                ui.history_empty = gr.HTML(
                    EMPTY_NO_HISTORY,
                    padding=False,
                )
                ui.history_radio = gr.Radio(
                    choices=[],
                    value=None,
                    label="History",
                    show_label=False,
                    interactive=True,
                )

            with gr.Column(elem_id="mg-answer-col", elem_classes=["answer-card"]):
                ui.answer_document = gr.HTML(
                    ANSWER_PLACEHOLDER,
                    elem_id="mg-answer-doc",
                )

                with gr.Row(
                    visible=False,
                    elem_id="mg-voice-output-row",
                ) as voice_output_row:
                    ui.voice_output_row = voice_output_row
                    ui.listen_btn = gr.Button(
                        "🔊 Listen",
                        size="sm",
                        elem_id="mg-listen-btn",
                    )
                    ui.voice_player = gr.Audio(
                        label=None,
                        show_label=False,
                        visible=False,
                        interactive=False,
                        elem_id="mg-voice-player",
                        autoplay=False,
                    )
                    ui.voice_player_status = gr.Markdown(
                        "Select Listen to hear the answer read aloud.",
                        elem_classes=["mg-status"],
                    )

            with gr.Column(
                elem_id="mg-workspace-evidence",
                visible=False,
            ) as workspace_evidence_col:
                ui.workspace_evidence_col = workspace_evidence_col
                ui.workspace_evidence = gr.HTML(
                    EVIDENCE_PLACEHOLDER,
                )

        ui.chat_history = gr.State([])
        ui.sessions_state = gr.State([])
        ui.active_session = gr.State(None)
