"""Desktop and mobile message composers."""

from __future__ import annotations

import gradio as gr


def create_composer(ui) -> None:
    """Build the desktop composer into the current Blocks context."""
    with gr.Column(
        elem_id="mg-composer",
        elem_classes=["ai-composer"],
    ) as composer_panel:
        ui.composer_panel = composer_panel
        ui.message_box = gr.Textbox(
            placeholder=(
                "Ask about a health term, document, or upcoming visit…"
            ),
            show_label=False,
            lines=3,
            max_lines=8,
            autofocus=True,
            container=False,
            elem_id="mg-composer-input",
        )
        # Separate columns keep Gradio from collapsing action buttons.
        with gr.Row(elem_id="mg-composer-actions"):
            with gr.Column(
                scale=0,
                min_width=150,
                elem_classes=["mg-composer-btn-wrap"],
            ):
                ui.add_document_btn = gr.Button(
                    "＋ Add document",
                    elem_classes=["mg-composer-secondary"],
                    size="sm",
                )
            with gr.Column(
                scale=0,
                min_width=110,
                elem_classes=["mg-composer-btn-wrap"],
            ):
                ui.speak_btn = gr.Button(
                    "🎤 Speak",
                    elem_classes=["mg-composer-secondary"],
                    size="sm",
                )
            with gr.Column(scale=1, elem_id="mg-composer-grow"):
                gr.HTML("", padding=False)
            with gr.Column(
                scale=0,
                min_width=120,
                elem_classes=["mg-composer-btn-wrap", "mg-composer-send-wrap"],
            ):
                ui.send_btn = gr.Button(
                    "Send →",
                    variant="primary",
                    size="sm",
                    elem_id="mg-send",
                )


def create_mobile_composer(ui) -> None:
    """Build the fixed mobile composer row."""
    with gr.Row(elem_id="mg-mobile-composer") as mobile_composer:
        ui.mobile_composer = mobile_composer
        ui.mobile_message = gr.Textbox(
            placeholder="Ask MediGuide…",
            show_label=False,
            lines=1,
            max_lines=4,
            container=False,
            scale=4,
        )
        ui.mobile_add_btn = gr.Button(
            "+",
            elem_classes=["mg-composer-secondary"],
            scale=0,
            min_width=44,
        )
        ui.mobile_speak_btn = gr.Button(
            "Mic",
            elem_classes=["mg-composer-secondary"],
            scale=0,
            min_width=44,
        )
        ui.mobile_send_btn = gr.Button(
            "Send",
            variant="primary",
            scale=0,
            min_width=64,
            elem_id="mg-mobile-send",
        )
