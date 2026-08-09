"""Assemble the MediGuide Gradio Blocks shell."""

from __future__ import annotations

from types import SimpleNamespace

import gradio as gr

from src.config import APP_TITLE, MODEL_NAME
from src.ui.composer import create_composer, create_mobile_composer
from src.ui.conversation import create_conversation_workspace
from src.ui.documents import create_documents
from src.ui.events import wire_events
from src.ui.evidence import create_evidence_panel
from src.ui.header import create_header
from src.ui.home import (
    create_composer_notice,
    create_home_hero,
    create_landing_sections,
    create_suggested_cards,
)
from src.ui.logic import (
    SOURCE_TABLE_HEADERS,
    describe_knowledge_base,
    filter_approved_sources,
)
from src.ui.privacy import PRIVACY_PAGE_LEAD, PRIVACY_STATUS_HTML
from src.ui.settings import create_settings_drawer
from src.ui.sidebar import create_sidebar
from src.ui.voice import create_voice


def build_demo() -> tuple[gr.Blocks, SimpleNamespace]:
    """Build the product shell and return (blocks, ui namespace)."""
    ui = SimpleNamespace()

    with gr.Blocks(
        title=APP_TITLE,
        analytics_enabled=False,
        fill_height=True,
    ) as app:
        ui.app = app
        ui.current_view = gr.State("conversations")
        ui.shell_classes = gr.State(["mg-shell-root"])

        with gr.Column(elem_id="mg-shell") as shell_col:
            ui.shell_col = shell_col
            create_header(ui)

            with gr.Column(elem_id="mg-drawer-host"):
                with gr.Column(
                    visible=False,
                    elem_classes=["mg-drawer-panel"],
                ) as privacy_drawer:
                    ui.privacy_drawer = privacy_drawer
                    ui.privacy_drawer_open = gr.State(False)
                    gr.HTML(PRIVACY_STATUS_HTML, padding=False)

                create_settings_drawer(ui)

                with gr.Column(
                    visible=False,
                    elem_classes=["mg-drawer-panel"],
                ) as help_drawer:
                    ui.help_drawer = help_drawer
                    ui.help_drawer_open = gr.State(False)
                    gr.Markdown(
                        "### Help\n\n"
                        "- Ask educational health questions\n"
                        "- Upload documents for visible-text extraction\n"
                        "- Use Visit preparation or Symptom timeline "
                        "before an appointment\n"
                        "- Review every transcript and extraction "
                        "before sending"
                    )

                with gr.Column(
                    visible=False,
                    elem_classes=["mg-drawer-panel"],
                ) as profile_drawer:
                    ui.profile_drawer = profile_drawer
                    ui.profile_drawer_open = gr.State(False)
                    gr.Markdown(
                        "### Profile\n\n"
                        "Local session only. Nothing is stored after "
                        "you clear the session or close the app."
                    )

            with gr.Row(elem_classes=["app-shell"], elem_id="mg-body"):
                with gr.Column(
                    visible=False,
                    elem_id="mg-sidebar-host",
                    scale=0,
                    min_width=252,
                ) as sidebar_host:
                    ui.sidebar_host = sidebar_host
                    create_sidebar(ui)

                with gr.Column(
                    elem_id="mg-main",
                    elem_classes=["main-workspace", "mg-landing-main"],
                    scale=1,
                ):
                    with gr.Column(visible=True) as conversations_view:
                        ui.conversations_view = conversations_view
                        create_home_hero(ui)
                        create_composer(ui)
                        create_composer_notice(ui)
                        create_suggested_cards(ui)
                        create_landing_sections(ui)
                        create_conversation_workspace(ui)
                        create_voice(ui)
                        with gr.Row(
                            visible=False,
                            elem_classes=["mg-chat-actions"],
                        ) as chat_actions:
                            ui.chat_actions = chat_actions
                            ui.clear_btn = gr.Button(
                                "Clear conversation",
                                variant="secondary",
                                size="sm",
                                scale=0,
                            )

                    create_documents(ui)

                    with gr.Column(visible=False) as visit_view:
                        ui.visit_view = visit_view
                        gr.Markdown(
                            "## Visit preparation",
                            elem_classes=["mg-page-title"],
                        )
                        gr.Markdown(
                            "Shape clear questions for your healthcare "
                            "professional.",
                            elem_classes=["mg-section-lead"],
                        )
                        ui.visit_reason = gr.Textbox(
                            label="Reason for visit",
                            lines=2,
                        )
                        ui.visit_goals = gr.Textbox(
                            label="What I hope to learn",
                            lines=2,
                        )
                        ui.visit_questions = gr.Textbox(
                            label="Questions I already have",
                            lines=3,
                        )
                        ui.visit_send = gr.Button(
                            "Prepare questions",
                            variant="primary",
                        )

                    with gr.Column(visible=False) as timeline_view:
                        ui.timeline_view = timeline_view
                        gr.Markdown(
                            "## Symptom timeline",
                            elem_classes=["mg-page-title"],
                        )
                        gr.Markdown(
                            "Organize what you noticed so you can share "
                            "it clearly.",
                            elem_classes=["mg-section-lead"],
                        )
                        ui.timeline_symptoms = gr.Textbox(
                            label="Symptoms",
                            lines=3,
                        )
                        ui.timeline_started = gr.Textbox(
                            label="When it started",
                            lines=1,
                        )
                        ui.timeline_changes = gr.Textbox(
                            label="How it changed",
                            lines=2,
                        )
                        ui.timeline_concerns = gr.Textbox(
                            label="Main concerns",
                            lines=2,
                        )
                        ui.timeline_send = gr.Button(
                            "Organize timeline",
                            variant="primary",
                        )

                    with gr.Column(visible=False) as sources_view:
                        ui.sources_view = sources_view
                        gr.Markdown(
                            "## Sources",
                            elem_classes=["mg-page-title"],
                        )
                        ui.knowledge_summary = gr.Markdown(
                            describe_knowledge_base(),
                        )
                        ui.source_search = gr.Textbox(
                            label="Search sources",
                            placeholder="Filter by title or publisher",
                        )
                        ui.source_table = gr.Dataframe(
                            headers=SOURCE_TABLE_HEADERS,
                            value=filter_approved_sources(""),
                            interactive=False,
                            wrap=True,
                        )
                        ui.refresh_sources_button = gr.Button(
                            "Refresh sources",
                            variant="secondary",
                        )

                    with gr.Column(visible=False) as safety_view:
                        ui.safety_view = safety_view
                        gr.Markdown(
                            "## Safety and limitations",
                            elem_classes=["mg-page-title"],
                        )
                        gr.Markdown(
                            "MediGuide is educational AI. It is **not** "
                            "for emergencies, diagnosis, prescribing, or "
                            "replacing a qualified clinician.\n\n"
                            "- In an emergency, call **911** or your local "
                            "emergency number.\n"
                            "- Confirm medications, numbers, units, and "
                            "dates yourself.\n"
                            "- Answers cite approved local sources when "
                            "evidence is available.\n"
                            "- MediGuide will not invent unsupported "
                            "medical claims when sources are missing."
                        )

                    with gr.Column(visible=False) as privacy_view:
                        ui.privacy_view = privacy_view
                        gr.Markdown(
                            "## Privacy",
                            elem_classes=["mg-page-title"],
                        )
                        gr.Markdown(PRIVACY_PAGE_LEAD)
                        gr.HTML(PRIVACY_STATUS_HTML, padding=False)

                    with gr.Column(visible=False) as about_view:
                        ui.about_view = about_view
                        gr.Markdown(
                            "## About",
                            elem_classes=["mg-page-title"],
                        )
                        gr.Markdown(
                            "MediGuide helps you learn from approved "
                            "health sources, prepare for visits, and "
                            "review documents — privately on this device.\n\n"
                            f"System details are available for operators "
                            f"who maintain this installation "
                            f"(model slot: `{MODEL_NAME}`)."
                        )

                create_evidence_panel(ui)

            create_mobile_composer(ui)

        wire_events(ui)

    return app, ui
