"""Right-rail evidence panel and mobile bottom-sheet chrome."""

from __future__ import annotations

import gradio as gr

from src.ui.logic import describe_knowledge_base

_EVIDENCE_SHEET_CHROME = """
<div class="mg-evidence-sheet-chrome">
  <button type="button" id="mg-evidence-sheet-toggle" class="mg-evidence-sheet-toggle">
    Sources
  </button>
  <button type="button" id="mg-evidence-sheet-close" class="mg-evidence-sheet-close"
          aria-label="Close evidence">
    Close
  </button>
</div>
"""


def create_evidence_panel(ui) -> None:
    """Build the evidence rail and bottom-sheet toggle chrome."""
    gr.HTML(_EVIDENCE_SHEET_CHROME, padding=False)

    with gr.Column(
        elem_id="mg-evidence",
        elem_classes=["evidence-sidebar"],
        visible=False,
    ) as evidence_panel:
        ui.evidence_panel = evidence_panel

        gr.Markdown(
            "Evidence",
            elem_classes=["mg-evidence-title"],
        )
        with gr.Column(elem_classes=["mg-evidence-card"]):
            gr.HTML(
                '<span class="mg-cite">Trusted evidence</span>',
                padding=False,
            )
            gr.Markdown(
                "Factual statements should include numbered "
                "citations mapped to approved sources."
            )

        gr.Markdown(
            "Sources",
            elem_classes=["mg-evidence-title"],
        )
        ui.evidence_sources = gr.Markdown(
            describe_knowledge_base(),
            elem_classes=["mg-evidence-card"],
        )

        gr.Markdown(
            "Confidence",
            elem_classes=["mg-evidence-title"],
        )
        with gr.Column(elem_classes=["mg-evidence-card"]):
            gr.Markdown(
                "MediGuide answers only when retrieved evidence "
                "is strong enough. Weak coverage leads to a "
                "decline, not a guess."
            )

        gr.Markdown(
            "Safety notes",
            elem_classes=["mg-evidence-title"],
        )
        with gr.Column(elem_classes=["mg-evidence-card"]):
            gr.Markdown(
                "Not a medical device. Not for emergencies. "
                "Verify medication names, numbers, units, and "
                "dates before use."
            )
