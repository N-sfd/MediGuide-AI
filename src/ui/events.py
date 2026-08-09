"""Wire Gradio event handlers for the MediGuide product shell."""

from __future__ import annotations

import tempfile
from pathlib import Path
from types import SimpleNamespace

import gradio as gr

from src.ui.home import QUICK_PROMPTS
from src.ui.logic import (
    ANSWER_PLACEHOLDER,
    EVIDENCE_PLACEHOLDER,
    _busy,
    _ready,
    build_timeline_question,
    build_visit_question,
    cancel_voice_recording,
    chat_response,
    clear_image_inputs,
    create_image_extraction,
    filter_approved_sources,
    finish_voice_recording,
    load_session,
    maybe_autoplay_answer,
    navigate,
    on_document_uploaded,
    pause_voice_recording,
    refresh_knowledge_summaries,
    refresh_transcript_review,
    rotate_document_image,
    send_confirmed_image_text,
    send_confirmed_transcript,
    show_chat_mode,
    show_home_mode,
    show_voice_mode,
    start_voice_recording,
    synthesize_answer_speech,
    voice_idle_view,
)


def _toggle_drawer(target: str, privacy_open, help_open, profile_open, settings_open):
    privacy_open = bool(privacy_open)
    help_open = bool(help_open)
    profile_open = bool(profile_open)
    settings_open = bool(settings_open)
    if target == "privacy":
        privacy_open = not privacy_open
        help_open = profile_open = settings_open = False
    elif target == "help":
        help_open = not help_open
        privacy_open = profile_open = settings_open = False
    elif target == "profile":
        profile_open = not profile_open
        privacy_open = help_open = settings_open = False
    elif target == "settings":
        settings_open = not settings_open
        privacy_open = help_open = profile_open = False
    return (
        privacy_open,
        help_open,
        profile_open,
        settings_open,
        gr.update(visible=privacy_open),
        gr.update(visible=help_open),
        gr.update(visible=profile_open),
        gr.update(visible=settings_open),
    )


def _close_drawers():
    return (
        False,
        False,
        False,
        False,
        gr.update(visible=False),
        gr.update(visible=False),
        gr.update(visible=False),
        gr.update(visible=False),
    )


def _apply_a11y(text_size, reduced_motion, high_contrast):
    classes = ["mg-shell-root"]
    size = (text_size or "Medium").lower()
    if size == "small":
        classes.append("mg-text-small")
    elif size == "large":
        classes.append("mg-text-large")
    if reduced_motion:
        classes.append("mg-reduced-motion")
    if high_contrast:
        classes.append("mg-high-contrast")
    return gr.update(elem_classes=classes)


def _cleanup_temp_files():
    removed = 0
    temp = Path(tempfile.gettempdir())
    for path in temp.glob("mediguide_*"):
        try:
            if path.is_file():
                path.unlink()
                removed += 1
        except OSError:
            continue
    return gr.update(
        value=f"Removed {removed} temporary file(s).",
        visible=True,
    )


def wire_events(ui: SimpleNamespace) -> None:
    """Attach all click/change/submit handlers to shell components."""

    view_outputs = [
        ui.conversations_view,
        ui.documents_view,
        ui.visit_view,
        ui.timeline_view,
        ui.sources_view,
        ui.safety_view,
        ui.privacy_view,
        ui.about_view,
    ]
    nav_buttons = [
        ui.nav_conversations,
        ui.nav_documents,
        ui.nav_visit,
        ui.nav_timeline,
        ui.nav_sources,
        ui.nav_privacy,
        ui.nav_safety,
        ui.nav_about,
    ]
    navigate_outputs = [
        ui.current_view,
        *view_outputs,
        *nav_buttons,
        ui.evidence_panel,
        ui.sidebar_host,
    ]

    def go(view: str):
        def _handler():
            return navigate(view)

        return _handler

    drawer_state_outputs = [
        ui.privacy_drawer_open,
        ui.help_drawer_open,
        ui.profile_drawer_open,
        ui.settings_drawer_open,
        ui.privacy_drawer,
        ui.help_drawer,
        ui.profile_drawer,
        ui.settings_drawer,
    ]

    home_mode_outputs = [
        ui.home_hero,
        ui.quick_cards,
        ui.chat_workspace,
        ui.voice_panel,
        ui.composer_panel,
        ui.chat_actions,
        ui.evidence_panel,
        ui.sidebar_host,
        ui.landing_sections,
        ui.composer_notice,
        ui.workspace_evidence_col,
    ]

    chat_result_outputs = [
        ui.chat_history,
        ui.message_box,
        ui.answer_document,
        ui.workspace_evidence,
        ui.history_radio,
        ui.sessions_state,
        ui.active_session,
    ]

    for btn, view in (
        (ui.nav_conversations, "conversations"),
        (ui.nav_documents, "documents"),
        (ui.nav_visit, "visit"),
        (ui.nav_timeline, "timeline"),
        (ui.nav_sources, "sources"),
        (ui.nav_privacy, "privacy"),
        (ui.nav_safety, "safety"),
        (ui.nav_about, "about"),
    ):
        btn.click(go(view), outputs=navigate_outputs).then(
            fn=_close_drawers,
            outputs=drawer_state_outputs,
        )

    ui.nav_settings_btn.click(
        fn=lambda p, h, pr, s: _toggle_drawer("settings", p, h, pr, s),
        inputs=[
            ui.privacy_drawer_open,
            ui.help_drawer_open,
            ui.profile_drawer_open,
            ui.settings_drawer_open,
        ],
        outputs=drawer_state_outputs,
    )
    ui.header_settings_btn.click(
        fn=lambda p, h, pr, s: _toggle_drawer("settings", p, h, pr, s),
        inputs=[
            ui.privacy_drawer_open,
            ui.help_drawer_open,
            ui.profile_drawer_open,
            ui.settings_drawer_open,
        ],
        outputs=drawer_state_outputs,
    )
    ui.privacy_btn.click(
        fn=lambda p, h, pr, s: _toggle_drawer("privacy", p, h, pr, s),
        inputs=[
            ui.privacy_drawer_open,
            ui.help_drawer_open,
            ui.profile_drawer_open,
            ui.settings_drawer_open,
        ],
        outputs=drawer_state_outputs,
    )
    ui.help_btn.click(
        fn=lambda p, h, pr, s: _toggle_drawer("help", p, h, pr, s),
        inputs=[
            ui.privacy_drawer_open,
            ui.help_drawer_open,
            ui.profile_drawer_open,
            ui.settings_drawer_open,
        ],
        outputs=drawer_state_outputs,
    )
    ui.profile_btn.click(
        fn=lambda p, h, pr, s: _toggle_drawer("profile", p, h, pr, s),
        inputs=[
            ui.privacy_drawer_open,
            ui.help_drawer_open,
            ui.profile_drawer_open,
            ui.settings_drawer_open,
        ],
        outputs=drawer_state_outputs,
    )

    def start_new_question():
        return (
            *navigate("conversations"),
            [],
            "",
            *show_home_mode(),
            ANSWER_PLACEHOLDER,
            EVIDENCE_PLACEHOLDER,
            gr.update(choices=[], value=None),
            [],
            None,
        )

    ui.new_chat_btn.click(
        fn=start_new_question,
        outputs=[
            *navigate_outputs,
            ui.chat_history,
            ui.message_box,
            *home_mode_outputs,
            ui.answer_document,
            ui.workspace_evidence,
            ui.history_radio,
            ui.sessions_state,
            ui.active_session,
        ],
    ).then(fn=_close_drawers, outputs=drawer_state_outputs)

    ui.clear_session_btn.click(
        fn=start_new_question,
        outputs=[
            *navigate_outputs,
            ui.chat_history,
            ui.message_box,
            *home_mode_outputs,
            ui.answer_document,
            ui.workspace_evidence,
            ui.history_radio,
            ui.sessions_state,
            ui.active_session,
        ],
    )
    ui.cleanup_temp_btn.click(
        fn=_cleanup_temp_files,
        outputs=ui.image_status,
    )

    for control in (
        ui.settings_text_size,
        ui.settings_reduced_motion,
        ui.settings_high_contrast,
    ):
        control.change(
            fn=_apply_a11y,
            inputs=[
                ui.settings_text_size,
                ui.settings_reduced_motion,
                ui.settings_high_contrast,
            ],
            outputs=ui.shell_col,
        )

    ui.settings_language.change(
        fn=lambda value: value,
        inputs=ui.settings_language,
        outputs=ui.language_select,
    )
    ui.language_select.change(
        fn=lambda value: value,
        inputs=ui.language_select,
        outputs=ui.settings_language,
    )

    ui.settings_voice_output.change(
        fn=lambda enabled: gr.update(visible=bool(enabled)),
        inputs=ui.settings_voice_output,
        outputs=ui.voice_output_row,
    )
    ui.settings_autoplay.change(
        fn=lambda enabled: gr.update(
            label=f"Autoplay: {'On' if enabled else 'Off'}",
        ),
        inputs=ui.settings_autoplay,
        outputs=ui.settings_autoplay,
    )
    ui.listen_btn.click(
        fn=lambda session, sessions, speed: synthesize_answer_speech(
            session, sessions, speed, autoplay=True,
        ),
        inputs=[
            ui.active_session,
            ui.sessions_state,
            ui.settings_speech_speed,
        ],
        outputs=[ui.voice_player, ui.voice_player_status],
    )

    def submit_message(message, history, sessions, answer_detail, reading_level):
        yield from chat_response(
            message,
            history,
            sessions,
            answer_detail=answer_detail,
            reading_level=reading_level,
        )

    answer_style_inputs = [
        ui.settings_answer_detail,
        ui.settings_reading_level,
    ]
    autoplay_inputs = [
        ui.active_session,
        ui.sessions_state,
        ui.settings_voice_output,
        ui.settings_autoplay,
        ui.settings_speech_speed,
    ]
    autoplay_outputs = [ui.voice_player, ui.voice_player_status]

    ui.send_btn.click(
        fn=_busy("Sending…"),
        inputs=None,
        outputs=ui.send_btn,
    ).then(
        fn=lambda: show_chat_mode(""),
        outputs=home_mode_outputs,
    ).then(
        fn=submit_message,
        inputs=[
            ui.message_box,
            ui.chat_history,
            ui.sessions_state,
            *answer_style_inputs,
        ],
        outputs=chat_result_outputs,
    ).then(
        fn=_ready("Send →"),
        inputs=None,
        outputs=ui.send_btn,
    ).then(
        fn=show_chat_mode,
        inputs=[ui.workspace_evidence],
        outputs=home_mode_outputs,
    ).then(
        fn=maybe_autoplay_answer,
        inputs=autoplay_inputs,
        outputs=autoplay_outputs,
    )

    ui.message_box.submit(
        fn=lambda: show_chat_mode(""),
        outputs=home_mode_outputs,
    ).then(
        fn=submit_message,
        inputs=[
            ui.message_box,
            ui.chat_history,
            ui.sessions_state,
            *answer_style_inputs,
        ],
        outputs=chat_result_outputs,
    ).then(
        fn=show_chat_mode,
        inputs=[ui.workspace_evidence],
        outputs=home_mode_outputs,
    ).then(
        fn=maybe_autoplay_answer,
        inputs=autoplay_inputs,
        outputs=autoplay_outputs,
    )

    ui.mobile_send_btn.click(
        fn=submit_message,
        inputs=[
            ui.mobile_message,
            ui.chat_history,
            ui.sessions_state,
            *answer_style_inputs,
        ],
        outputs=[
            ui.chat_history,
            ui.mobile_message,
            ui.answer_document,
            ui.workspace_evidence,
            ui.history_radio,
            ui.sessions_state,
            ui.active_session,
        ],
    ).then(
        fn=show_chat_mode,
        inputs=[ui.workspace_evidence],
        outputs=home_mode_outputs,
    )

    ui.clear_btn.click(
        fn=start_new_question,
        outputs=[
            *navigate_outputs,
            ui.chat_history,
            ui.message_box,
            *home_mode_outputs,
            ui.answer_document,
            ui.workspace_evidence,
            ui.history_radio,
            ui.sessions_state,
            ui.active_session,
        ],
    )

    ui.speak_btn.click(
        fn=lambda: (*navigate("conversations"), *show_voice_mode()),
        outputs=[*navigate_outputs, *home_mode_outputs],
    )
    ui.mobile_speak_btn.click(
        fn=lambda: (*navigate("conversations"), *show_voice_mode()),
        outputs=[*navigate_outputs, *home_mode_outputs],
    )
    ui.add_document_btn.click(
        fn=go("documents"),
        outputs=navigate_outputs,
    )
    ui.mobile_add_btn.click(
        fn=go("documents"),
        outputs=navigate_outputs,
    )
    def ask_quick_prompt(index: int):
        def _handler(history, sessions, answer_detail, reading_level):
            yield from chat_response(
                QUICK_PROMPTS[index],
                history,
                sessions,
                answer_detail=answer_detail,
                reading_level=reading_level,
            )

        return _handler

    ui.card_ask.click(
        fn=lambda: show_chat_mode(""),
        outputs=home_mode_outputs,
    ).then(
        fn=ask_quick_prompt(0),
        inputs=[ui.chat_history, ui.sessions_state, *answer_style_inputs],
        outputs=chat_result_outputs,
    ).then(
        fn=show_chat_mode,
        inputs=[ui.workspace_evidence],
        outputs=home_mode_outputs,
    )

    ui.card_visit.click(
        fn=lambda: show_chat_mode(""),
        outputs=home_mode_outputs,
    ).then(
        fn=ask_quick_prompt(1),
        inputs=[ui.chat_history, ui.sessions_state, *answer_style_inputs],
        outputs=chat_result_outputs,
    ).then(
        fn=show_chat_mode,
        inputs=[ui.workspace_evidence],
        outputs=home_mode_outputs,
    )

    ui.card_documents.click(
        fn=lambda: show_chat_mode(""),
        outputs=home_mode_outputs,
    ).then(
        fn=ask_quick_prompt(2),
        inputs=[ui.chat_history, ui.sessions_state, *answer_style_inputs],
        outputs=chat_result_outputs,
    ).then(
        fn=show_chat_mode,
        inputs=[ui.workspace_evidence],
        outputs=home_mode_outputs,
    )

    ui.card_voice.click(
        fn=lambda: show_chat_mode(""),
        outputs=home_mode_outputs,
    ).then(
        fn=ask_quick_prompt(3),
        inputs=[ui.chat_history, ui.sessions_state, *answer_style_inputs],
        outputs=chat_result_outputs,
    ).then(
        fn=show_chat_mode,
        inputs=[ui.workspace_evidence],
        outputs=home_mode_outputs,
    )

    ui.history_radio.change(
        fn=load_session,
        inputs=[ui.history_radio, ui.sessions_state],
        outputs=[ui.answer_document, ui.workspace_evidence],
    ).then(
        fn=show_chat_mode,
        inputs=[ui.workspace_evidence],
        outputs=home_mode_outputs,
    ).then(
        fn=lambda session_id: session_id,
        inputs=ui.history_radio,
        outputs=ui.active_session,
    )

    voice_idle_outputs = [
        ui.voice_idle,
        ui.voice_recording,
        ui.voice_review,
        ui.audio_input,
        ui.voice_stage_html,
        ui.transcript,
        ui.transcript_highlight,
        ui.voice_details,
        ui.voice_confirmation,
        ui.voice_phase,
        ui.voice_status,
    ]

    ui.start_voice_btn.click(
        fn=start_voice_recording,
        outputs=[
            ui.voice_idle,
            ui.voice_recording,
            ui.voice_review,
            ui.audio_input,
            ui.voice_stage_html,
            ui.voice_phase,
            ui.voice_status,
        ],
    )
    ui.pause_voice_btn.click(
        fn=pause_voice_recording,
        outputs=[
            ui.audio_input,
            ui.voice_stage_html,
            ui.voice_phase,
            ui.voice_status,
        ],
    )
    ui.cancel_voice_btn.click(
        fn=cancel_voice_recording,
        outputs=voice_idle_outputs,
    )
    ui.rerecord_voice_btn.click(
        fn=cancel_voice_recording,
        outputs=voice_idle_outputs,
    )
    ui.finish_voice_btn.click(
        fn=_busy("Transcribing…"),
        outputs=ui.finish_voice_btn,
    ).then(
        fn=finish_voice_recording,
        inputs=ui.audio_input,
        outputs=voice_idle_outputs,
    ).then(fn=_ready("Finish"), outputs=ui.finish_voice_btn)

    ui.transcript.change(
        fn=refresh_transcript_review,
        inputs=ui.transcript,
        outputs=[ui.transcript_highlight, ui.voice_details],
    )

    ui.send_transcript_button.click(
        fn=_busy("Generating…"),
        outputs=ui.send_transcript_button,
    ).then(
        fn=send_confirmed_transcript,
        inputs=[
            ui.transcript,
            ui.voice_confirmation,
            ui.chat_history,
            ui.sessions_state,
            *answer_style_inputs,
        ],
        outputs=[
            ui.chat_history,
            ui.voice_status,
            ui.voice_confirmation,
            ui.transcript,
            ui.transcript_highlight,
            ui.voice_details,
            ui.answer_document,
            ui.workspace_evidence,
            ui.history_radio,
            ui.sessions_state,
            ui.active_session,
        ],
    ).then(
        fn=voice_idle_view,
        outputs=voice_idle_outputs,
    ).then(
        fn=_ready("Send confirmed question"),
        outputs=ui.send_transcript_button,
    ).then(
        fn=show_chat_mode,
        inputs=[ui.workspace_evidence],
        outputs=home_mode_outputs,
    )

    doc_flow_outputs = [
        ui.doc_drop_panel,
        ui.doc_split_panel,
        ui.image_input,
        ui.extracted_text,
        ui.extraction_fields,
        ui.image_confirmation,
        ui.image_status,
        ui.image_question,
    ]

    ui.image_input.change(
        fn=on_document_uploaded,
        inputs=[ui.image_input, ui.image_question],
        outputs=[
            ui.doc_drop_panel,
            ui.doc_split_panel,
            ui.image_preview,
            ui.extracted_text,
            ui.extraction_fields,
            ui.image_confirmation,
            ui.image_status,
            ui.image_question,
        ],
    )
    ui.analyze_image_button.click(
        fn=_busy("Extracting…"),
        outputs=ui.analyze_image_button,
    ).then(
        fn=create_image_extraction,
        inputs=[ui.image_preview, ui.image_question],
        outputs=[
            ui.doc_drop_panel,
            ui.doc_split_panel,
            ui.image_preview,
            ui.extracted_text,
            ui.extraction_fields,
            ui.image_confirmation,
            ui.image_status,
            ui.image_question,
        ],
    ).then(fn=_ready("Re-extract"), outputs=ui.analyze_image_button)

    ui.rotate_image_btn.click(
        fn=rotate_document_image,
        inputs=ui.image_preview,
        outputs=[ui.image_preview, ui.image_status],
    )
    ui.replace_image_btn.click(
        fn=clear_image_inputs,
        outputs=doc_flow_outputs,
    ).then(fn=lambda: None, outputs=ui.image_preview)

    ui.send_image_button.click(
        fn=_busy("Generating…"),
        outputs=ui.send_image_button,
    ).then(
        fn=send_confirmed_image_text,
        inputs=[
            ui.extracted_text,
            ui.image_confirmation,
            ui.chat_history,
            ui.sessions_state,
            ui.image_question,
            *answer_style_inputs,
        ],
        outputs=[
            ui.chat_history,
            ui.image_status,
            ui.image_confirmation,
            ui.extracted_text,
            ui.answer_document,
            ui.workspace_evidence,
            ui.history_radio,
            ui.sessions_state,
            ui.active_session,
        ],
    ).then(
        fn=clear_image_inputs,
        outputs=doc_flow_outputs,
    ).then(fn=lambda: None, outputs=ui.image_preview).then(
        fn=_ready("Send confirmed information"),
        outputs=ui.send_image_button,
    ).then(fn=go("conversations"), outputs=navigate_outputs).then(
        fn=show_chat_mode,
        inputs=[ui.workspace_evidence],
        outputs=home_mode_outputs,
    )

    def send_timeline(
        symptoms, started, changes, concerns, history, sessions,
        answer_detail, reading_level,
    ):
        prompt = build_timeline_question(
            symptoms, started, changes, concerns,
        )
        yield from chat_response(
            prompt,
            history,
            sessions,
            answer_detail=answer_detail,
            reading_level=reading_level,
        )

    def send_visit(
        reason, goals, questions, history, sessions,
        answer_detail, reading_level,
    ):
        prompt = build_visit_question(reason, goals, questions)
        yield from chat_response(
            prompt,
            history,
            sessions,
            answer_detail=answer_detail,
            reading_level=reading_level,
        )

    ui.timeline_send.click(
        fn=_busy("Preparing…"),
        outputs=ui.timeline_send,
    ).then(
        fn=send_timeline,
        inputs=[
            ui.timeline_symptoms,
            ui.timeline_started,
            ui.timeline_changes,
            ui.timeline_concerns,
            ui.chat_history,
            ui.sessions_state,
            *answer_style_inputs,
        ],
        outputs=chat_result_outputs,
    ).then(fn=_ready("Organize timeline"), outputs=ui.timeline_send).then(
        fn=go("conversations"),
        outputs=navigate_outputs,
    ).then(
        fn=show_chat_mode,
        inputs=[ui.workspace_evidence],
        outputs=home_mode_outputs,
    )

    ui.visit_send.click(
        fn=_busy("Preparing…"),
        outputs=ui.visit_send,
    ).then(
        fn=send_visit,
        inputs=[
            ui.visit_reason,
            ui.visit_goals,
            ui.visit_questions,
            ui.chat_history,
            ui.sessions_state,
            *answer_style_inputs,
        ],
        outputs=chat_result_outputs,
    ).then(fn=_ready("Prepare questions"), outputs=ui.visit_send).then(
        fn=go("conversations"),
        outputs=navigate_outputs,
    ).then(
        fn=show_chat_mode,
        inputs=[ui.workspace_evidence],
        outputs=home_mode_outputs,
    )

    ui.source_search.change(
        fn=filter_approved_sources,
        inputs=ui.source_search,
        outputs=ui.source_table,
    )
    ui.refresh_sources_button.click(
        fn=filter_approved_sources,
        inputs=ui.source_search,
        outputs=ui.source_table,
    ).then(
        fn=refresh_knowledge_summaries,
        outputs=[ui.knowledge_summary, ui.evidence_sources],
    )
