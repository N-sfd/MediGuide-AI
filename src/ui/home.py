"""Home hero, composer notice, quick cards, and landing sections."""

from __future__ import annotations

import gradio as gr

from src.ui.landing import build_home_hero_html, build_landing_sections_html

# Short card labels shown on the landing screen.
CARD_LABELS = (
    "Explain a lab result",
    "Prepare for an appointment",
    "Understand a medication label",
    "Track my symptoms",
)

# Full prompts sent when a card is clicked.
QUICK_PROMPTS = (
    "Explain what a lab result means in plain language.",
    "Help me prepare questions for an upcoming appointment.",
    "Help me understand the terms on a medication label.",
    "Help me track my symptoms so I can share them clearly.",
)

_PROMPT_ICONS = (
    """
    <svg class="quick-prompt-icon" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect x="8" y="10" width="32" height="28" rx="8" stroke="currentColor" stroke-width="2"/>
      <path d="M16 24h6l3-6 4 12 3-6h6" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    """,
    """
    <svg class="quick-prompt-icon" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect x="10" y="8" width="28" height="32" rx="4" stroke="currentColor" stroke-width="2"/>
      <path d="M18 18h12M18 24h12M18 30h8" stroke="currentColor" stroke-width="2"
            stroke-linecap="round"/>
    </svg>
    """,
    """
    <svg class="quick-prompt-icon" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect x="14" y="6" width="20" height="36" rx="10" stroke="currentColor" stroke-width="2"/>
      <path d="M14 20h20" stroke="currentColor" stroke-width="2"/>
      <circle cx="24" cy="30" r="3" fill="currentColor"/>
    </svg>
    """,
    """
    <svg class="quick-prompt-icon" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect x="8" y="12" width="32" height="28" rx="4" stroke="currentColor" stroke-width="2"/>
      <path d="M8 20h32M18 8v8M30 8v8" stroke="currentColor" stroke-width="2"
            stroke-linecap="round"/>
      <path d="M18 28l4 4 8-8" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    """,
)

_COMPOSER_NOTICE_HTML = """
<p class="mg-composer-notice" role="note">
  Educational information only · Not for emergencies or diagnosis
</p>
"""


def create_home_hero(ui) -> None:
    """Split landing hero with product composition."""
    ui.home_hero = gr.HTML(
        build_home_hero_html(),
        padding=False,
        elem_id="mg-home-hero",
    )


def create_composer_notice(ui) -> None:
    """Compact safety line under the unified composer."""
    ui.composer_notice = gr.HTML(
        _COMPOSER_NOTICE_HTML,
        padding=False,
        elem_id="mg-composer-notice",
    )


def create_suggested_cards(ui) -> None:
    """Four suggested-question cards below the composer."""
    with gr.Row(elem_classes=["mg-quick-grid"], elem_id="mg-quick-grid") as quick_cards:
        ui.quick_cards = quick_cards

        cards = (
            (CARD_LABELS[0], QUICK_PROMPTS[0], _PROMPT_ICONS[0], "card_ask"),
            (CARD_LABELS[1], QUICK_PROMPTS[1], _PROMPT_ICONS[1], "card_visit"),
            (CARD_LABELS[2], QUICK_PROMPTS[2], _PROMPT_ICONS[2], "card_documents"),
            (CARD_LABELS[3], QUICK_PROMPTS[3], _PROMPT_ICONS[3], "card_voice"),
        )

        for label, _prompt, icon, attr in cards:
            with gr.Column(elem_classes=["quick-card", "quick-prompt"]):
                gr.HTML(
                    f"<div class='quick-prompt-top'>{icon}"
                    f"<p class='quick-prompt-text'>{label}</p></div>",
                    padding=False,
                )
                btn = gr.Button("Ask this →", size="sm")
                setattr(ui, attr, btn)


def create_landing_sections(ui) -> None:
    """Document, voice, evidence, visit, privacy, safety, and footer."""
    ui.landing_sections = gr.HTML(
        build_landing_sections_html(),
        padding=False,
        elem_id="mg-landing-sections",
    )
