"""Left navigation sidebar and mobile backdrop."""

from __future__ import annotations

import gradio as gr


def create_sidebar(ui) -> None:
    """Build the sidebar nav into the current Blocks context."""
    with gr.Column(elem_id="mg-sidebar", elem_classes=["sidebar"]):
        gr.Markdown("MEDIGUIDE", elem_classes=["mg-nav-label"])
        ui.new_chat_btn = gr.Button(
            "+ New conversation",
            variant="primary",
            elem_id="mg-new-chat",
        )

        gr.Markdown("WORKSPACE", elem_classes=["mg-nav-label"])
        ui.nav_conversations = gr.Button(
            "Ask MediGuide",
            elem_classes=["mg-nav-item", "mg-nav-active"],
        )
        ui.nav_documents = gr.Button(
            "Documents",
            elem_classes=["mg-nav-item"],
        )
        ui.nav_visit = gr.Button(
            "Visit preparation",
            elem_classes=["mg-nav-item"],
        )
        ui.nav_timeline = gr.Button(
            "Symptom timeline",
            elem_classes=["mg-nav-item"],
        )

        gr.Markdown("KNOWLEDGE", elem_classes=["mg-nav-label"])
        ui.nav_sources = gr.Button(
            "Sources",
            elem_classes=["mg-nav-item"],
        )

        gr.Markdown("SYSTEM", elem_classes=["mg-nav-label"])
        ui.nav_privacy = gr.Button(
            "Privacy",
            elem_classes=["mg-nav-item"],
        )
        ui.nav_safety = gr.Button(
            "Safety and limitations",
            elem_classes=["mg-nav-item"],
        )
        ui.nav_settings_btn = gr.Button(
            "Settings",
            elem_classes=["mg-nav-item"],
        )
        ui.nav_about = gr.Button(
            "About",
            elem_classes=["mg-nav-item"],
        )

    gr.HTML(
        '<div id="mg-sidebar-backdrop" class="mg-sidebar-backdrop"></div>',
        padding=False,
    )
