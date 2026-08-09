"""Top bar: brand mark, privacy pill, and compact header actions."""

from __future__ import annotations

import gradio as gr

# Distinctive shield + guidance bubble + AI spark (no medical cross).
_BRAND_HTML = """
<div class="mg-brand">
  <div class="mg-logo" aria-hidden="true">
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none"
         xmlns="http://www.w3.org/2000/svg">
      <path
        d="M16 4.8l9 3.2v7.1c0 5.4-3.6 9.7-9 11.5
           -5.4-1.8-9-6.1-9-11.5V8L16 4.8z"
        stroke="#176B5B"
        stroke-width="2"
        stroke-linejoin="round"
      />
      <path
        d="M11.2 12.2h9.6c.9 0 1.6.7 1.6 1.6v3.5c0 .9-.7 1.6-1.6 1.6
           h-3.1l-2.35 2.05c-.3.26-.75.05-.75-.35v-1.7H11.2
           c-.9 0-1.6-.7-1.6-1.6v-3.5c0-.9.7-1.6 1.6-1.6z"
        stroke="#123F36"
        stroke-width="1.35"
        stroke-linejoin="round"
        opacity="0.4"
      />
      <path
        d="M16 13.1l.85 2.1 2.1.85-2.1.85L16 19l-.85-2.1
           -2.1-.85 2.1-.85.85-2.1z"
        fill="#176B5B"
      />
    </svg>
  </div>
  <div class="mg-brand-text">
    <span class="mg-wordmark">MediGuide</span>
    <span class="mg-tagline">Your private health intelligence</span>
  </div>
</div>
"""


def create_header(ui) -> None:
    """Build the sticky 72px top bar into the current Blocks context."""
    with gr.Row(
        elem_id="mg-topbar",
        elem_classes=["app-header"],
        equal_height=True,
    ):
        ui.menu_btn = gr.Button(
            "Menu",
            elem_id="mg-menu-btn",
            elem_classes=["mg-header-text-btn", "mg-menu-btn"],
            scale=0,
            min_width=64,
            size="sm",
        )

        gr.HTML(_BRAND_HTML, padding=False, elem_id="mg-brand-block")

        with gr.Row(elem_id="mg-header-actions"):
            ui.privacy_btn = gr.Button(
                "● Private on-device",
                elem_id="mg-privacy-btn",
                elem_classes=["mg-privacy-pill"],
                scale=0,
                min_width=148,
                size="sm",
            )
            ui.language_select = gr.Dropdown(
                choices=["English"],
                value="English",
                show_label=False,
                container=False,
                elem_classes=["mg-lang"],
                scale=0,
                min_width=96,
            )
            ui.help_btn = gr.Button(
                "Help",
                elem_classes=["mg-header-text-btn"],
                scale=0,
                min_width=48,
                size="sm",
            )
            ui.header_settings_btn = gr.Button(
                "Settings",
                elem_classes=["mg-header-icon-btn", "mg-settings-btn"],
                scale=0,
                min_width=40,
                size="sm",
            )
            ui.profile_btn = gr.Button(
                "Profile",
                elem_classes=["mg-header-icon-btn", "mg-profile-btn"],
                scale=0,
                min_width=40,
                size="sm",
            )
