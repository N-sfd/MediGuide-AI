"""MediGuide Gradio theme."""

import gradio as gr

THEME = gr.themes.Base(
    primary_hue=gr.themes.Color(
        name="mediguide_green",
        c50="#EDF8F4",
        c100="#DDF1EB",
        c200="#B8E0D4",
        c300="#8ACAB9",
        c400="#56AD97",
        c500="#278D76",
        c600="#176B5B",
        c700="#135648",
        c800="#12453B",
        c900="#103A32",
        c950="#08211D",
    ),
    neutral_hue=gr.themes.Color(
        name="mediguide_neutral",
        c50="#F7FAF9",
        c100="#EEF3F1",
        c200="#DDE7E3",
        c300="#C3D1CD",
        c400="#91A29D",
        c500="#687A75",
        c600="#52625E",
        c700="#3F4D49",
        c800="#2A3633",
        c900="#172321",
        c950="#0B1210",
    ),
    font=[
        gr.themes.GoogleFont("Inter"),
        "Arial",
        "sans-serif",
    ],
).set(
    body_background_fill="#F7FAF9",
    body_text_color="#172321",
    block_background_fill="#FFFFFF",
    block_border_color="#DDE7E3",
    block_border_width="1px",
    block_radius="18px",
    block_shadow="0 8px 30px rgba(29, 61, 54, 0.06)",
    button_primary_background_fill="#176B5B",
    button_primary_background_fill_hover="#125748",
    button_primary_text_color="#FFFFFF",
    button_large_radius="14px",
    input_background_fill="#FFFFFF",
    input_border_color="#DDE7E3",
    input_border_color_focus="#176B5B",
)
