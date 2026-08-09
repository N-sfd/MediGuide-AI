"""Document drop zone and split-screen extraction review."""

from __future__ import annotations

import gradio as gr

from src.ui.logic import DOC_DROP_HTML, render_extraction_fields_html


def create_documents(ui) -> None:
    """Build documents view: drop zone + split preview/extract."""
    with gr.Column(visible=False, elem_id="mg-documents") as documents_view:
        ui.documents_view = documents_view
        gr.Markdown("## Documents", elem_classes=["mg-page-title"])
        gr.Markdown(
            "Review medication labels, lab screenshots, or visit "
            "instructions. Confirm extracted text before it enters "
            "the conversation.",
            elem_classes=["mg-section-lead"],
        )
        gr.Markdown(
            "**Out of scope.** MediGuide does not clinically interpret "
            "X-rays, CT or MRI scans, ultrasounds, wounds, or skin lesions.",
            elem_classes=["mg-note"],
        )

        with gr.Column(visible=True, elem_id="mg-doc-drop") as doc_drop_panel:
            ui.doc_drop_panel = doc_drop_panel
            gr.HTML(DOC_DROP_HTML, padding=False)
            ui.image_input = gr.Image(
                type="filepath",
                label="Document image",
                show_label=False,
                sources=["upload"],
                height=220,
                elem_id="mg-doc-uploader",
            )
            ui.image_question = gr.Textbox(
                label="What should be extracted?",
                placeholder=(
                    "Example: Extract medication name, instructions, "
                    "dates, and warnings."
                ),
                lines=2,
                value=(
                    "Extract medication name, dose, dates, and "
                    "instructions that are clearly visible."
                ),
            )

        with gr.Column(
            visible=False,
            elem_id="mg-doc-split",
        ) as doc_split_panel:
            ui.doc_split_panel = doc_split_panel
            with gr.Row(equal_height=False):
                with gr.Column(
                    scale=1,
                    elem_classes=["mg-panel", "mg-doc-preview"],
                ):
                    gr.Markdown("Image preview", elem_classes=["mg-step"])
                    ui.image_preview = gr.Image(
                        type="filepath",
                        label="Preview",
                        show_label=False,
                        interactive=False,
                        height=360,
                        elem_id="mg-doc-preview-image",
                    )
                    with gr.Row():
                        ui.rotate_image_btn = gr.Button(
                            "Rotate",
                            variant="secondary",
                            size="sm",
                        )
                        ui.replace_image_btn = gr.Button(
                            "Replace image",
                            variant="secondary",
                            size="sm",
                        )
                    gr.HTML(
                        '<p class="mg-doc-zoom-hint">'
                        "Use browser zoom on the preview to inspect "
                        "fine print.</p>",
                        padding=False,
                    )
                with gr.Column(scale=1, elem_classes=["mg-panel"]):
                    ui.extraction_fields = gr.HTML(
                        render_extraction_fields_html(None),
                        padding=False,
                    )
                    ui.extracted_text = gr.Textbox(
                        label="Editable extraction",
                        placeholder="Correct every error before confirming.",
                        lines=10,
                        buttons=["copy"],
                    )
                    ui.image_confirmation = gr.Checkbox(
                        label=(
                            "I corrected all names, numbers, units, and dates"
                        ),
                        value=False,
                    )
                    with gr.Row():
                        ui.analyze_image_button = gr.Button(
                            "Re-extract",
                            variant="secondary",
                        )
                        ui.send_image_button = gr.Button(
                            "Send confirmed information",
                            variant="primary",
                        )

        ui.image_status = gr.Markdown(
            "Drop a health document to begin.",
            elem_classes=["mg-status"],
        )
