import html
import json
import re
import tempfile
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import gradio as gr
from PIL import Image

from src.chatbot import SAFETY_REMINDER
from src.config import (
    BASE_DIR,
    KNOWLEDGE_DIR,
    MAX_IMAGE_MB,
    MAX_TTS_CHARACTERS,
)
from src.image_analyzer import (
    analyze_medical_document_image,
    format_extraction_for_review,
)
from src.rag_chatbot import stream_rag_response
from src.retriever import diversify_results, retrieve_chunks
from src.transcriber import transcribe_audio as run_transcription
from src.tts import TextToSpeechError, synthesize_speech
from src.ui.empty_states import EMPTY_NO_CONVERSATION, EMPTY_NO_HISTORY
from src.ui.landing import build_home_hero_html
from src.ui.loading import skeleton_html, stage_banner_html
from src.ui.safety_cards import (
    classify_answer_kind,
    diagnosis_card_html,
    emergency_card_html,
    low_evidence_card_html,
)

THINKING_MESSAGE = (
    "Searching approved medical sources…"
)

HERO_IMAGE = BASE_DIR / "assets" / "mediguide_hero.png"
HERO_FILE_URL = (
    f"/gradio_api/file={HERO_IMAGE.as_posix()}"
    if HERO_IMAGE.exists()
    else ""
)

SOURCE_TABLE_HEADERS = [
    "Title",
    "Publisher",
    "Published",
    "Reviewed",
    "Source",
]

NAV_VIEWS = (
    "conversations",
    "documents",
    "visit",
    "timeline",
    "sources",
    "safety",
    "privacy",
    "about",
)

NAV_BUTTON_KEYS = (
    "conversations",
    "documents",
    "visit",
    "timeline",
    "sources",
    "privacy",
    "safety",
    "about",
)

EVIDENCE_VIEWS = {
    "conversations",
    "documents",
    "visit",
    "timeline",
}


def time_greeting() -> str:
    hour = datetime.now(timezone.utc).astimezone().hour
    if hour < 12:
        return "Good morning."
    if hour < 17:
        return "Good afternoon."
    return "Good evening."


ANSWER_PLACEHOLDER = EMPTY_NO_CONVERSATION
HISTORY_EMPTY_HTML = EMPTY_NO_HISTORY

EVIDENCE_PLACEHOLDER = """
<div class="mg-evidence-empty">
  <p class="mg-evidence-kicker">Evidence &amp; details</p>
  <p>Source cards, passages, and limitations appear here after
  MediGuide answers.</p>
  <p class="mg-local-status">● Private Local Mode · Storage off</p>
</div>
"""

INPUT_TYPE_ICONS = {
    "text": "💬",
    "voice": "🎤",
    "document": "📄",
}

ANSWER_SECTIONS = (
    "General explanation",
    "What this means",
    "What MediGuide cannot determine",
    "Questions to ask a healthcare professional",
    "When to seek professional care",
)

COMMON_MEDICATIONS = (
    "amoxicillin",
    "ibuprofen",
    "acetaminophen",
    "paracetamol",
    "metformin",
    "lisinopril",
    "atorvastatin",
    "amlodipine",
    "omeprazole",
    "losartan",
    "gabapentin",
    "sertraline",
    "levothyroxine",
    "albuterol",
    "prednisone",
    "warfarin",
    "aspirin",
    "insulin",
    "azithromycin",
    "ciprofloxacin",
    "hydrochlorothiazide",
    "pantoprazole",
    "montelukast",
    "fluoxetine",
    "escitalopram",
    "tramadol",
    "oxycodone",
    "hydrocodone",
    "naproxen",
    "clopidogrel",
    "rosuvastatin",
    "simvastatin",
    "metoprolol",
    "carvedilol",
    "furosemide",
    "spironolactone",
    "doxycycline",
    "cephalexin",
    "penicillin",
)

MED_SUFFIX_RE = re.compile(
    r"\b[A-Za-z][A-Za-z-]{2,}(?:cillin|mycin|cycline|oxacin|"
    r"olol|pril|sartan|statin|azole|pine|mab|nib|vir|"
    r"parin|dopa|prazole|gliptin|flozin)\b",
    re.IGNORECASE,
)

UNIT_RE = re.compile(
    r"\b(?:mg|mcg|µg|g|kg|ml|mL|L|mmHg|bpm|IU|units?|"
    r"mg/dL|mmol/L|mEq|%|mcg/kg|mg/kg|drops?|tablets?|"
    r"capsules?|puffs?)\b",
)

DATE_RE = re.compile(
    r"\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|"
    r"\d{4}-\d{2}-\d{2}|"
    r"(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|"
    r"May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|"
    r"Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)"
    r"\s+\d{1,2}(?:,\s*\d{4})?)\b",
    re.IGNORECASE,
)

NUMBER_RE = re.compile(r"\b\d+(?:\.\d+)?\b")

CONFIDENCE_LABELS = {
    "clearly_visible": "Clearly visible",
    "partially_visible": "Needs review",
    "uncertain": "Needs review",
    "not_visible": "Could not read",
}

VOICE_IDLE_HTML = """
<div class="mg-voice-card mg-voice-idle-card">
  <div class="mg-voice-mic" aria-hidden="true">
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
      <rect x="9" y="3.5" width="6" height="11" rx="3"
            stroke="currentColor" stroke-width="1.8"/>
      <path d="M6.5 11.5a5.5 5.5 0 0 0 11 0"
            stroke="currentColor" stroke-width="1.8"
            stroke-linecap="round"/>
      <path d="M12 17v3.5M9 20.5h6"
            stroke="currentColor" stroke-width="1.8"
            stroke-linecap="round"/>
    </svg>
  </div>
  <p class="mg-voice-title">Tap to start speaking</p>
  <p class="mg-voice-sub">Your audio stays on this device.</p>
</div>
"""

VOICE_RECORDING_HTML = """
<div class="mg-voice-card mg-voice-recording-card">
  <p class="mg-voice-timer" id="mg-voice-timer">00:00</p>
  <div class="mg-voice-wave" aria-hidden="true">
    <span></span><span></span><span></span><span></span>
    <span></span><span></span><span></span><span></span>
    <span></span><span></span><span></span><span></span>
  </div>
  <p class="mg-voice-listening">Listening…</p>
</div>
"""

VOICE_PAUSED_HTML = """
<div class="mg-voice-card mg-voice-recording-card is-paused">
  <p class="mg-voice-timer" id="mg-voice-timer">Paused</p>
  <div class="mg-voice-wave is-paused" aria-hidden="true">
    <span></span><span></span><span></span><span></span>
    <span></span><span></span><span></span><span></span>
    <span></span><span></span><span></span><span></span>
  </div>
  <p class="mg-voice-listening">Paused — tap Finish when ready</p>
</div>
"""

DOC_DROP_HTML = f"""
<div class="mg-doc-drop-chrome">
  <div class="mg-doc-icon" aria-hidden="true">
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
      <path d="M7 3.5h7.2L19 8.3V20a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 6 20V5A1.5 1.5 0 0 1 7.5 3.5H7z"
            stroke="currentColor" stroke-width="1.7"
            stroke-linejoin="round"/>
      <path d="M14 3.5V8h4.8M9 13h6M9 16.5h4"
            stroke="currentColor" stroke-width="1.7"
            stroke-linecap="round"/>
    </svg>
  </div>
  <p class="mg-doc-title">Drop a health document here</p>
  <p class="mg-doc-sub">or choose a file from your computer</p>
  <p class="mg-doc-meta">
    PNG, JPG or WEBP · Maximum {MAX_IMAGE_MB} MB
  </p>
</div>
"""


def has_retrieved_sources(evidence_html: str | None) -> bool:
    """True when evidence HTML includes retrieved source cards."""
    text = evidence_html or ""
    return 'class="source-card"' in text or 'id="source-' in text


def show_home_mode():
    """Landing: hero, composer, cards, sections — no sidebar or evidence."""
    return (
        gr.update(value=build_home_hero_html(), visible=True),
        gr.update(visible=True),   # quick_cards
        gr.update(visible=False),  # chat_workspace
        gr.update(visible=False),  # voice_panel
        gr.update(visible=True),   # composer_panel
        gr.update(visible=False),  # chat_actions
        gr.update(visible=False),  # evidence_panel
        gr.update(visible=False),  # sidebar_host
        gr.update(visible=True),   # landing_sections
        gr.update(visible=True),   # composer_notice
        gr.update(visible=False),  # workspace_evidence_col
    )


def show_chat_mode(evidence_html: str | None = None):
    """Workspace after a question: sidebar | answer | evidence (if sources)."""
    show_evidence = has_retrieved_sources(evidence_html)
    return (
        gr.update(visible=False),  # home_hero
        gr.update(visible=False),  # quick_cards
        gr.update(visible=True),   # chat_workspace
        gr.update(visible=False),  # voice_panel
        gr.update(visible=True),   # composer_panel
        gr.update(visible=True),   # chat_actions
        gr.update(visible=False),  # evidence_panel
        gr.update(visible=True),   # sidebar_host
        gr.update(visible=False),  # landing_sections
        gr.update(visible=True),   # composer_notice
        gr.update(visible=show_evidence),  # workspace_evidence_col
    )


def show_voice_mode():
    return (
        gr.update(visible=False),
        gr.update(visible=False),
        gr.update(visible=True),
        gr.update(visible=True),
        gr.update(visible=False),
        gr.update(visible=True),
        gr.update(visible=False),
        gr.update(visible=True),
        gr.update(visible=False),  # landing_sections
        gr.update(visible=False),
        gr.update(visible=False),
    )


def _status(message: str, kind: str = "neutral"):
    return gr.update(
        value=message,
        elem_classes=["mg-status", f"mg-status-{kind}"],
    )


def make_session_title(question: str) -> str:
    clean = re.sub(r"\s+", " ", (question or "").strip())
    clean = re.sub(r"\b\d[\d.,/-]{2,}\b", "[…]", clean)
    words = clean.split()
    if not words:
        return "Health question"
    title = " ".join(words[:6])
    if len(words) > 6:
        title += "…"
    if len(title) > 48:
        title = title[:45].rstrip() + "…"
    return title


def local_now() -> datetime:
    return datetime.now(timezone.utc).astimezone()


def day_label_for(moment: datetime) -> str:
    today = local_now().date()
    day = moment.date()
    if day == today:
        return "Today"
    if day == today - timedelta(days=1):
        return "Yesterday"
    return moment.strftime("%b %d")


def split_answer_document(full_answer: str) -> tuple[str, str]:
    text = (full_answer or "").strip()
    if not text:
        return "", ""

    if "### Sources" in text:
        body, sources = text.split("### Sources", 1)
        body = body.rstrip().removesuffix("---").rstrip()
        sources_block = "### Sources" + sources
        return body, sources_block

    return text, ""


def relevance_label(distance: float) -> str:
    if distance <= 0.35:
        return "Highly relevant"
    if distance <= 0.55:
        return "Relevant"
    return "Limited match"


def parse_answer_sections(body: str) -> list[tuple[str, str]]:
    text = (body or "").strip()
    if not text:
        return []

    pattern = re.compile(r"^##\s+(.+?)\s*$", re.MULTILINE)
    matches = list(pattern.finditer(text))
    if not matches:
        return [("General explanation", text)]

    sections: list[tuple[str, str]] = []
    for index, match in enumerate(matches):
        title = match.group(1).strip()
        start = match.end()
        end = (
            matches[index + 1].start()
            if index + 1 < len(matches)
            else len(text)
        )
        content = text[start:end].strip()
        if content:
            sections.append((title, content))
    return sections


def linkify_citations(escaped_text: str) -> str:
    return re.sub(
        r"\[(\d+)\]",
        (
            r'<a class="cite-pill" href="#source-\1" '
            r'title="View source \1">[\1]</a>'
        ),
        escaped_text,
    )


def paragraphs_to_html(text: str) -> str:
    chunks = [
        chunk.strip()
        for chunk in re.split(r"\n\s*\n", text.strip())
        if chunk.strip()
    ]
    if not chunks:
        return ""

    html_parts: list[str] = []
    for chunk in chunks:
        if chunk.lstrip().startswith(("- ", "* ")):
            items = []
            for line in chunk.splitlines():
                clean = re.sub(r"^[-*]\s+", "", line.strip())
                if clean:
                    items.append(
                        "<li>"
                        f"{linkify_citations(html.escape(clean))}"
                        "</li>"
                    )
            if items:
                html_parts.append("<ul>" + "".join(items) + "</ul>")
            continue

        normalized = " ".join(chunk.splitlines())
        html_parts.append(
            "<p>"
            f"{linkify_citations(html.escape(normalized))}"
            "</p>"
        )
    return "".join(html_parts)


def collect_source_cards(question: str) -> list[dict]:
    cards: list[dict] = []
    try:
        chunks = diversify_results(retrieve_chunks(question))
    except Exception:  # noqa: BLE001
        return cards

    seen: set[str] = set()
    for chunk in chunks:
        source_id = str(
            chunk.metadata.get("source_id", chunk.chunk_id),
        )
        if source_id in seen:
            continue
        seen.add(source_id)

        excerpt = re.sub(r"\s+", " ", chunk.text).strip()
        if len(excerpt) > 180:
            excerpt = excerpt[:177].rstrip() + "…"

        cards.append(
            {
                "number": len(cards) + 1,
                "title": str(
                    chunk.metadata.get("title", "Approved source"),
                ),
                "publisher": str(
                    chunk.metadata.get(
                        "publisher",
                        "Unknown publisher",
                    ),
                ),
                "publication_date": str(
                    chunk.metadata.get("publication_date", "—"),
                ),
                "review_date": str(
                    chunk.metadata.get("review_date", "—"),
                ),
                "source_url": str(
                    chunk.metadata.get("source_url", ""),
                ),
                "relevance": relevance_label(float(chunk.distance)),
                "passage": excerpt,
            }
        )
        if len(cards) >= 5:
            break

    return cards


def render_source_cards_html(cards: list[dict]) -> str:
    if not cards:
        return (
            '<div class="mg-evidence-empty">'
            "<p>No approved source cards are available "
            "for this answer.</p></div>"
        )

    parts: list[str] = []
    for card in cards:
        url = card.get("source_url") or ""
        link = (
            f'<a class="source-link" href="{html.escape(url)}" '
            'target="_blank" rel="noopener noreferrer">'
            "View source ↗</a>"
            if url
            else (
                '<span class="source-link muted">'
                "Local source</span>"
            )
        )
        parts.append(
            f"""
            <article class="source-card" id="source-{card["number"]}">
              <div class="source-card-top">
                <span class="source-index">[{card["number"]}]</span>
                <span class="source-relevance">
                  {html.escape(card["relevance"])}
                </span>
              </div>
              <h4>{html.escape(card["title"])}</h4>
              <p class="source-publisher">
                <span class="source-pub-icon" aria-hidden="true"></span>
                {html.escape(card["publisher"])}
              </p>
              <p class="source-meta">
                Published {html.escape(card["publication_date"])}
                · Reviewed {html.escape(card["review_date"])}
              </p>
              <p class="source-passage-label">Relevant passage</p>
              <p class="source-passage">
                {html.escape(card["passage"])}
              </p>
              {link}
            </article>
            """
        )
    return "".join(parts)


def render_answer_html(
    question: str,
    full_answer: str,
    *,
    streaming: bool = False,
    updated_label: str = "just now",
    stage: str = "generation",
) -> tuple[str, str]:
    body, _sources = split_answer_document(full_answer)
    working_body = body or full_answer or ""

    kind = classify_answer_kind(question, working_body)
    if not streaming and kind == "emergency":
        card = emergency_card_html()
        return card, (
            '<div class="mg-evidence-panel">'
            '<p class="mg-evidence-kicker">Safety</p>'
            "<p>Emergency guidance takes priority over educational retrieval.</p>"
            '<p class="mg-local-status">● Private Local Mode · Storage off</p>'
            "</div>"
        )
    if not streaming and kind == "diagnosis":
        card = diagnosis_card_html()
        return card, (
            '<div class="mg-evidence-panel">'
            '<p class="mg-evidence-kicker">Safety</p>'
            "<p>MediGuide stays within educational boundaries.</p>"
            '<p class="mg-local-status">● Private Local Mode · Storage off</p>'
            "</div>"
        )
    if not streaming and kind == "low_evidence":
        card = low_evidence_card_html()
        return card, (
            '<div class="mg-evidence-panel">'
            '<p class="mg-evidence-kicker">Evidence</p>'
            "<p>No approved passages were strong enough to cite.</p>"
            '<p class="mg-local-status">● Private Local Mode · Storage off</p>'
            "</div>"
        )

    if streaming:
        banner = stage_banner_html(stage)
        if not working_body.strip():
            answer_html = f"""
            <div class="mg-answer-doc">
              {banner}
              {skeleton_html(6)}
            </div>
            """
        else:
            sections = parse_answer_sections(working_body)
            section_html = "".join(
                (
                    '<section class="answer-section">'
                    f"<h3>{html.escape(title)}</h3>"
                    f"{paragraphs_to_html(content)}"
                    "</section>"
                )
                for title, content in sections
            ) or (
                '<section class="answer-section">'
                f"{paragraphs_to_html(working_body)}"
                "</section>"
            )
            answer_html = f"""
            <div class="mg-answer-doc">
              {banner}
              <div class="answer-header">
                <h2>{html.escape(make_session_title(question))}</h2>
                <p class="answer-subheader">
                  Drafting cited educational answer…
                </p>
              </div>
              {section_html}
            </div>
            """
        evidence_html = """
        <div class="mg-evidence-panel">
          <p class="mg-evidence-kicker">Evidence &amp; details</p>
          <p>Source cards will appear when the answer is validated.</p>
          <p class="mg-local-status">
            ● Private Local Mode · Storage off
          </p>
        </div>
        """
        return answer_html, evidence_html

    cards = collect_source_cards(question)
    cited = set(re.findall(r"\[(\d+)\]", working_body))
    if cited:
        matched = [
            card
            for card in cards
            if str(card["number"]) in cited
        ]
        cards = matched or cards
    else:
        cards = []
    source_count = len(cited) if cited else len(cards)
    sections = parse_answer_sections(working_body)

    ordered: list[tuple[str, str]] = []
    found = {title.lower(): content for title, content in sections}
    for expected in ANSWER_SECTIONS:
        content = found.get(expected.lower())
        if content:
            ordered.append((expected, content))
    if not ordered:
        ordered = sections or [("General explanation", working_body)]

    section_html = "".join(
        (
            f'<section class="answer-section" id="section-{index}">'
            f"<h3>{html.escape(title)}</h3>"
            f"{paragraphs_to_html(content)}"
            "</section>"
        )
        for index, (title, content) in enumerate(ordered, start=1)
    )

    sources_nav = "".join(
        (
            "<li>"
            f'<a class="cite-pill" href="#source-{card["number"]}">'
            f'[{card["number"]}]</a> '
            f'{html.escape(card["title"])}'
            "</li>"
        )
        for card in cards
    ) or "<li>No approved sources were attached.</li>"

    badge = ""
    if source_count:
        badge = (
            '<span class="evidence-badge">'
            "✓ Supported by approved sources"
            "</span>"
        )

    plural = "s" if source_count != 1 else ""
    evidence_line = (
        f"Evidence supported · {source_count} approved source{plural}"
        if source_count
        else "Educational response"
    )
    answer_html = f"""
    <div class="mg-answer-doc">
      <div class="answer-header">
        <h2>{html.escape(make_session_title(question))}</h2>
        <div class="answer-header-meta">
          <span class="evidence-supported">
            {evidence_line}
          </span>
          <span class="answer-updated">
            Updated {html.escape(updated_label)}
          </span>
        </div>
        {badge}
      </div>
      {section_html}
      <section class="answer-section" id="section-sources">
        <h3>Sources</h3>
        <ul class="answer-source-list">{sources_nav}</ul>
      </section>
    </div>
    """

    evidence_html = f"""
    <div class="mg-evidence-panel">
      <p class="mg-evidence-kicker">Evidence &amp; details</p>
      {badge or '<span class="evidence-badge muted">Review needed</span>'}
      <div class="source-card-stack">
        {render_source_cards_html(cards)}
      </div>
      <div class="mg-evidence-limits">
        <h4>Important limitations</h4>
        <p>{html.escape(SAFETY_REMINDER.replace("**", ""))}</p>
        <p>
          Not a medical device. Verify medication names, numbers, units,
          and dates before relying on extracted text.
        </p>
      </div>
      <p class="mg-local-status">
        ● Private Local Mode · Processed on this device · Storage off
      </p>
    </div>
    """
    return answer_html, evidence_html


def build_evidence_panel(
    question: str,
    full_answer: str,
    *,
    streaming: bool = False,
) -> str:
    _answer_html, evidence_html = render_answer_html(
        question,
        full_answer,
        streaming=streaming,
    )
    return evidence_html


def sessions_to_choices(
    sessions: list[dict],
) -> list[tuple[str, str]]:
    choices: list[tuple[str, str]] = []
    for session in sessions:
        icon = INPUT_TYPE_ICONS.get(
            session.get("input_type", "text"),
            "💬",
        )
        label = (
            f"{session['day']}  {icon}  {session['title']}  ·  "
            f"{session['time']}  ⋯"
        )
        choices.append((label, session["id"]))
    return choices


def upsert_session(
    sessions: list[dict],
    *,
    question: str,
    full_answer: str,
    input_type: str,
) -> tuple[list[dict], str, str, str]:
    moment = local_now()
    answer_html, evidence_html = render_answer_html(
        question,
        full_answer,
        streaming=False,
        updated_label="just now",
    )
    session = {
        "id": str(uuid.uuid4()),
        "title": make_session_title(question),
        "time": moment.strftime("%I:%M %p").lstrip("0"),
        "day": day_label_for(moment),
        "input_type": input_type,
        "question": question,
        "raw_answer": full_answer,
        "answer_body": answer_html,
        "evidence": evidence_html,
        "created": moment.isoformat(),
    }
    updated = [session, *list(sessions or [])][:24]
    return (
        updated,
        session["id"],
        session["answer_body"],
        evidence_html,
    )


def load_session(
    session_id: str | None,
    sessions: list[dict] | None,
) -> tuple[str, str]:
    for session in sessions or []:
        if session["id"] != session_id:
            continue

        created = datetime.fromisoformat(session["created"])
        minutes = max(
            int((local_now() - created).total_seconds() // 60),
            0,
        )
        if minutes <= 0:
            updated = "just now"
        elif minutes == 1:
            updated = "1 minute ago"
        else:
            updated = f"{minutes} minutes ago"

        raw = session.get("raw_answer") or ""
        if raw:
            return render_answer_html(
                session["question"],
                raw,
                streaming=False,
                updated_label=updated,
            )

        return session["answer_body"], session["evidence"]

    return ANSWER_PLACEHOLDER, EVIDENCE_PLACEHOLDER


def _plain_text_for_speech(raw_answer: str) -> str:
    """Strip markdown/citation markup so Piper reads clean prose."""
    body, _sources = split_answer_document(raw_answer or "")
    text = body or raw_answer or ""
    text = re.sub(r"\[\d+\]", "", text)
    text = re.sub(r"^#+\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"[*_`]", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:MAX_TTS_CHARACTERS]


def synthesize_answer_speech(
    active_session: str | None,
    sessions: list[dict] | None,
    speech_speed: float = 1.0,
    autoplay: bool = False,
):
    raw_answer = ""
    for session in sessions or []:
        if session["id"] == active_session:
            raw_answer = session.get("raw_answer", "")
            break

    spoken_text = _plain_text_for_speech(raw_answer)

    if not spoken_text:
        return (
            gr.update(),
            _status(
                "There is no answer to read yet.",
                "warning",
            ),
        )

    length_scale = 1.0 / max(float(speech_speed or 1.0), 0.1)

    try:
        output_path = synthesize_speech(
            spoken_text,
            length_scale=length_scale,
        )
    except (TextToSpeechError, ValueError) as error:
        return (
            gr.update(),
            _status(f"Voice output is unavailable: {error}", "error"),
        )

    return (
        gr.update(value=output_path, visible=True, autoplay=autoplay),
        _status("Playing the answer aloud.", "success"),
    )


def maybe_autoplay_answer(
    active_session: str | None,
    sessions: list[dict] | None,
    voice_output: bool,
    autoplay: bool,
    speech_speed: float = 1.0,
):
    if not (voice_output and autoplay):
        return gr.update(), gr.update()

    return synthesize_answer_speech(
        active_session,
        sessions,
        speech_speed,
        autoplay=True,
    )


def chat_response(
    message: str,
    history: list[dict] | None,
    sessions: list[dict] | None,
    input_type: str = "text",
    retrieval_message: str | None = None,
    answer_detail: str = "Standard",
    reading_level: str = "Standard",
):
    current_history = list(history or [])
    current_sessions = list(sessions or [])
    rag_message = (retrieval_message or message or "").strip()
    display_message = (message or "").strip() or rag_message

    if not rag_message:
        yield (
            current_history,
            "",
            ANSWER_PLACEHOLDER,
            EVIDENCE_PLACEHOLDER,
            gr.update(),
            current_sessions,
            None,
        )
        return

    current_history.extend(
        [
            {"role": "user", "content": display_message},
            {"role": "assistant", "content": THINKING_MESSAGE},
        ]
    )
    draft_answer, draft_evidence = render_answer_html(
        rag_message,
        "",
        streaming=True,
        stage="retrieval",
    )
    yield (
        current_history,
        "",
        draft_answer,
        draft_evidence,
        gr.update(),
        current_sessions,
        None,
    )

    # Diagnosis asks get a calm boundary before RAG when clearly diagnostic.
    if classify_answer_kind(rag_message, "") == "diagnosis":
        final_answer = diagnosis_card_html()
        current_history[-1] = {
            "role": "assistant",
            "content": final_answer,
        }
        updated_sessions, active_id, body, evidence = upsert_session(
            current_sessions,
            question=display_message,
            full_answer=(
                "MediGuide cannot diagnose a condition. "
                "It can help organize symptoms, explain general health "
                "information, and prepare questions for a professional."
            ),
            input_type=input_type,
        )
        # Force diagnosis card in UI
        body = diagnosis_card_html()
        evidence = (
            '<div class="mg-evidence-panel">'
            '<p class="mg-evidence-kicker">Safety</p>'
            "<p>MediGuide stays within educational boundaries.</p>"
            '<p class="mg-local-status">● Private Local Mode · Storage off</p>'
            "</div>"
        )
        choices = sessions_to_choices(updated_sessions)
        yield (
            current_history,
            "",
            body,
            evidence,
            gr.update(choices=choices, value=active_id),
            updated_sessions,
            active_id,
        )
        return

    final_answer = ""
    first_chunk = True
    for partial in stream_rag_response(
        rag_message,
        history,
        answer_detail=answer_detail,
        reading_level=reading_level,
    ):
        final_answer = partial
        current_history[-1] = {
            "role": "assistant",
            "content": partial,
        }
        stage = "retrieval" if first_chunk else "generation"
        first_chunk = False
        stream_answer, stream_evidence = render_answer_html(
            rag_message,
            partial,
            streaming=True,
            stage=stage,
        )
        yield (
            current_history,
            "",
            stream_answer,
            stream_evidence,
            gr.update(),
            current_sessions,
            None,
        )

    current_history[-1] = {
        "role": "assistant",
        "content": final_answer,
    }
    updated_sessions, active_id, body, evidence = upsert_session(
        current_sessions,
        question=display_message,
        full_answer=final_answer,
        input_type=input_type,
    )
    choices = sessions_to_choices(updated_sessions)

    yield (
        current_history,
        "",
        body,
        evidence,
        gr.update(choices=choices, value=active_id),
        updated_sessions,
        active_id,
    )


def transcribe_audio(audio_path: str | None) -> str:
    result = run_transcription(audio_path)
    if not result.success:
        return result.error or "Transcription failed."
    return result.text


def _medication_terms() -> set[str]:
    return {term.lower() for term in COMMON_MEDICATIONS}


def highlight_transcript_html(text: str) -> str:
    raw = (text or "").strip()
    if not raw:
        return (
            '<div class="mg-transcript-highlight empty">'
            "Transcript highlights will appear here."
            "</div>"
        )

    medications = _medication_terms()
    markers: list[tuple[int, int, str]] = []

    for match in DATE_RE.finditer(raw):
        markers.append((match.start(), match.end(), "date"))
    for match in MED_SUFFIX_RE.finditer(raw):
        markers.append((match.start(), match.end(), "med"))
    for match in re.finditer(r"\b[A-Za-z][A-Za-z-]{2,}\b", raw):
        if match.group(0).lower() in medications:
            markers.append((match.start(), match.end(), "med"))
    for match in UNIT_RE.finditer(raw):
        markers.append((match.start(), match.end(), "unit"))
    for match in NUMBER_RE.finditer(raw):
        markers.append((match.start(), match.end(), "num"))

    markers.sort(key=lambda item: (item[0], -(item[1] - item[0])))
    chosen: list[tuple[int, int, str]] = []
    occupied_until = -1
    for start, end, kind in markers:
        if start < occupied_until:
            continue
        chosen.append((start, end, kind))
        occupied_until = end

    parts: list[str] = []
    cursor = 0
    for start, end, kind in chosen:
        parts.append(html.escape(raw[cursor:start]))
        parts.append(
            f'<mark class="hl-{kind}">'
            f"{html.escape(raw[start:end])}"
            "</mark>"
        )
        cursor = end
    parts.append(html.escape(raw[cursor:]))

    return (
        '<div class="mg-transcript-highlight">'
        f"{''.join(parts)}"
        "</div>"
    )


def extract_important_details(text: str) -> list[tuple[str, str]]:
    raw = (text or "").strip()
    if not raw:
        return []

    details: list[tuple[str, str]] = []
    medications = _medication_terms()
    seen: set[str] = set()

    for match in MED_SUFFIX_RE.finditer(raw):
        name = match.group(0)
        key = f"med:{name.lower()}"
        if key not in seen:
            seen.add(key)
            details.append(("Medication", name))

    for match in re.finditer(r"\b[A-Za-z][A-Za-z-]{2,}\b", raw):
        word = match.group(0)
        if word.lower() in medications:
            key = f"med:{word.lower()}"
            if key not in seen:
                seen.add(key)
                details.append(("Medication", word))

    for match in re.finditer(
        r"(\d+(?:\.\d+)?)\s*"
        r"(mg|mcg|µg|g|ml|mL|IU|units?|mg/dL|mmol/L|%|mmHg)",
        raw,
        flags=re.IGNORECASE,
    ):
        value = f"{match.group(1)} {match.group(2)}"
        key = f"val:{value.lower()}"
        if key not in seen:
            seen.add(key)
            details.append(("Value", value))

    for match in DATE_RE.finditer(raw):
        value = match.group(0)
        key = f"date:{value.lower()}"
        if key not in seen:
            seen.add(key)
            details.append(("Date", value))

    return details[:6]


def render_important_details_html(text: str) -> str:
    details = extract_important_details(text)
    if not details:
        return (
            '<div class="mg-voice-details empty">'
            "<p>No medication names, values, or dates were detected yet. "
            "Edit the transcript if needed.</p>"
            "</div>"
        )

    rows = "".join(
        (
            '<div class="mg-detail-row">'
            f'<span class="mg-detail-label">{html.escape(label)}</span>'
            f'<strong class="mg-detail-value">{html.escape(value)}</strong>'
            "</div>"
        )
        for label, value in details
    )
    return (
        '<div class="mg-voice-details">'
        "<h4>Important details detected</h4>"
        f"{rows}"
        "</div>"
    )


def voice_idle_view():
    return (
        gr.update(visible=True),
        gr.update(visible=False),
        gr.update(visible=False),
        gr.update(value=None, recording=False),
        VOICE_RECORDING_HTML,
        "",
        highlight_transcript_html(""),
        render_important_details_html(""),
        False,
        "idle",
        _status("Ready to record. Audio stays on this device.", "neutral"),
    )


def start_voice_recording():
    return (
        gr.update(visible=False),
        gr.update(visible=True),
        gr.update(visible=False),
        gr.update(value=None, recording=True),
        VOICE_RECORDING_HTML,
        "recording",
        _status("Listening… speak your health question.", "busy"),
    )


def pause_voice_recording():
    return (
        gr.update(recording=False),
        VOICE_PAUSED_HTML,
        "paused",
        _status(
            "Recording paused. Tap Finish to transcribe, or Cancel.",
            "warning",
        ),
    )


def cancel_voice_recording():
    return voice_idle_view()


def finish_voice_recording(audio_path: str | None):
    if not audio_path:
        return (
            gr.update(visible=False),
            gr.update(visible=True),
            gr.update(visible=False),
            gr.update(recording=False),
            VOICE_PAUSED_HTML,
            "",
            highlight_transcript_html(""),
            render_important_details_html(""),
            False,
            "paused",
            _status(
                "No audio captured yet. Keep speaking, then tap Finish.",
                "warning",
            ),
        )

    result = run_transcription(audio_path)
    if not result.success:
        return (
            gr.update(visible=False),
            gr.update(visible=True),
            gr.update(visible=False),
            gr.update(recording=False),
            VOICE_PAUSED_HTML,
            "",
            highlight_transcript_html(""),
            render_important_details_html(""),
            False,
            "paused",
            _status(result.error or "Transcription failed.", "error"),
        )

    text = (result.text or "").strip()
    return (
        gr.update(visible=False),
        gr.update(visible=False),
        gr.update(visible=True),
        gr.update(recording=False),
        VOICE_RECORDING_HTML,
        text,
        highlight_transcript_html(text),
        render_important_details_html(text),
        False,
        "review",
        _status(
            "Review and correct the transcript before sending.",
            "success",
        ),
    )


def refresh_transcript_review(transcript_text: str):
    return (
        highlight_transcript_html(transcript_text),
        render_important_details_html(transcript_text),
    )


def confidence_label(raw: str | None) -> str:
    key = (raw or "uncertain").strip().lower()
    return CONFIDENCE_LABELS.get(key, "Needs review")


def render_extraction_fields_html(data: dict | None) -> str:
    if not data:
        return (
            '<div class="mg-extract-empty">'
            "<p>Extracted fields will appear here after analysis.</p>"
            "</div>"
        )

    rows: list[str] = []
    document_type = data.get("document_type") or "Unknown document"
    rows.append(
        '<div class="mg-extract-field">'
        '<div class="mg-extract-field-top">'
        "<span>Document type</span>"
        '<span class="confidence-label confidence-clear">'
        "Clearly visible</span>"
        "</div>"
        f"<strong>{html.escape(str(document_type))}</strong>"
        "</div>"
    )

    for item in data.get("visible_text", []) or []:
        field = str(item.get("field", "Field"))
        value = str(item.get("value", ""))
        label = confidence_label(item.get("confidence"))
        css = (
            "confidence-clear"
            if label == "Clearly visible"
            else (
                "confidence-missing"
                if label == "Could not read"
                else "confidence-review"
            )
        )
        rows.append(
            '<div class="mg-extract-field">'
            '<div class="mg-extract-field-top">'
            f"<span>{html.escape(field)}</span>"
            f'<span class="confidence-label {css}">'
            f"{html.escape(label)}</span>"
            "</div>"
            f"<strong>{html.escape(value) or '—'}</strong>"
            "</div>"
        )

    for item in data.get("uncertain_text", []) or []:
        field = str(item.get("field", "Field"))
        value = str(item.get("value", ""))
        label = confidence_label(item.get("confidence", "uncertain"))
        rows.append(
            '<div class="mg-extract-field">'
            '<div class="mg-extract-field-top">'
            f"<span>{html.escape(field)}</span>"
            '<span class="confidence-label confidence-review">'
            f"{html.escape(label)}</span>"
            "</div>"
            f"<strong>{html.escape(value) or '—'}</strong>"
            "</div>"
        )

    for item in data.get("unreadable_areas", []) or []:
        rows.append(
            '<div class="mg-extract-field">'
            '<div class="mg-extract-field-top">'
            "<span>Unreadable area</span>"
            '<span class="confidence-label confidence-missing">'
            "Could not read</span>"
            "</div>"
            f"<strong>{html.escape(str(item))}</strong>"
            "</div>"
        )

    return (
        '<div class="mg-extract-stack">'
        "<h4>Extracted information</h4>"
        f"{''.join(rows)}"
        "</div>"
    )


def create_image_extraction(
    image_path: str | None,
    question: str,
) -> tuple[object, ...]:
    kept_question = question or ""

    if not image_path:
        return (
            gr.update(visible=True),
            gr.update(visible=False),
            None,
            "",
            render_extraction_fields_html(None),
            False,
            _status("Upload a document image first.", "warning"),
            kept_question,
        )

    result = analyze_medical_document_image(
        image_path=image_path,
        user_question=question,
    )

    if not result.success:
        return (
            gr.update(visible=False),
            gr.update(visible=True),
            image_path,
            "",
            render_extraction_fields_html(None),
            False,
            _status(f"{result.error}", "error"),
            kept_question,
        )

    if not result.structured_data:
        return (
            gr.update(visible=False),
            gr.update(visible=True),
            image_path,
            "",
            render_extraction_fields_html(None),
            False,
            _status("No structured information was returned.", "error"),
            kept_question,
        )

    editable_text = format_extraction_for_review(
        result.structured_data,
    )
    editable_text = re.sub(
        r"\s*\[(?:clearly_visible|partially_visible|"
        r"uncertain|not_visible)\]",
        "",
        editable_text,
    )

    return (
        gr.update(visible=False),
        gr.update(visible=True),
        image_path,
        editable_text,
        render_extraction_fields_html(result.structured_data),
        False,
        _status(
            "Extraction completed. Review every name, value, unit, "
            "and date before confirming.",
            "success",
        ),
        kept_question,
    )


def on_document_uploaded(image_path: str | None, question: str):
    if not image_path:
        return (
            gr.update(visible=True),
            gr.update(visible=False),
            None,
            "",
            render_extraction_fields_html(None),
            False,
            _status("Drop a health document to begin.", "neutral"),
            question or "",
        )
    return create_image_extraction(image_path, question)


def rotate_document_image(image_path: str | None):
    if not image_path:
        return None, _status("No image to rotate.", "warning")

    try:
        with Image.open(image_path) as image:
            rotated = image.rotate(-90, expand=True)
            suffix = Path(image_path).suffix or ".png"
            out = Path(tempfile.gettempdir()) / (
                f"mediguide_rot_{uuid.uuid4().hex}{suffix}"
            )
            save_kwargs = {}
            if suffix.lower() in {".jpg", ".jpeg"}:
                save_kwargs["quality"] = 95
            rotated.save(out, **save_kwargs)
        return str(out), _status("Image rotated.", "neutral")
    except OSError as error:
        return image_path, _status(f"Could not rotate: {error}", "error")


def clear_image_inputs():
    return (
        gr.update(visible=True),
        gr.update(visible=False),
        None,
        "",
        render_extraction_fields_html(None),
        False,
        _status("Drop a health document to begin.", "neutral"),
        "",
    )


def send_confirmed_transcript(
    transcript_text: str,
    confirmed: bool,
    history: list[dict] | None,
    sessions: list[dict] | None,
    answer_detail: str = "Standard",
    reading_level: str = "Standard",
):
    current_history = list(history or [])
    current_sessions = list(sessions or [])
    answer = ANSWER_PLACEHOLDER
    evidence = EVIDENCE_PLACEHOLDER
    history_update = gr.update()
    active_id = None

    if not transcript_text or not transcript_text.strip():
        yield (
            current_history,
            _status("There is no transcript to send.", "error"),
            False,
            transcript_text,
            highlight_transcript_html(transcript_text or ""),
            render_important_details_html(transcript_text or ""),
            answer,
            evidence,
            history_update,
            current_sessions,
            active_id,
        )
        return

    if not confirmed:
        yield (
            current_history,
            _status(
                "Review medical names and numbers, then check "
                "the confirmation box first.",
                "warning",
            ),
            False,
            transcript_text,
            highlight_transcript_html(transcript_text),
            render_important_details_html(transcript_text),
            answer,
            evidence,
            history_update,
            current_sessions,
            active_id,
        )
        return

    clean_transcript = transcript_text.strip()

    for item in chat_response(
        clean_transcript,
        history,
        sessions,
        input_type="voice",
        answer_detail=answer_detail,
        reading_level=reading_level,
    ):
        (
            current_history,
            _message,
            answer,
            evidence,
            history_update,
            current_sessions,
            active_id,
        ) = item
        yield (
            current_history,
            _status("Drafting the answer…", "busy"),
            False,
            clean_transcript,
            highlight_transcript_html(clean_transcript),
            render_important_details_html(clean_transcript),
            answer,
            evidence,
            history_update,
            current_sessions,
            active_id,
        )

    yield (
        current_history,
        _status("Confirmed question sent to Conversations.", "success"),
        False,
        "",
        highlight_transcript_html(""),
        render_important_details_html(""),
        answer,
        evidence,
        history_update,
        current_sessions,
        active_id,
    )


def send_confirmed_image_text(
    extracted_text: str,
    confirmed: bool,
    history: list[dict] | None,
    sessions: list[dict] | None,
    image_question: str | None = "",
    answer_detail: str = "Standard",
    reading_level: str = "Standard",
):
    current_history = list(history or [])
    current_sessions = list(sessions or [])
    answer = ANSWER_PLACEHOLDER
    evidence = EVIDENCE_PLACEHOLDER
    history_update = gr.update()
    active_id = None

    if not extracted_text or not extracted_text.strip():
        yield (
            current_history,
            _status("There is no extracted information to send.", "error"),
            False,
            extracted_text,
            answer,
            evidence,
            history_update,
            current_sessions,
            active_id,
        )
        return

    if not confirmed:
        yield (
            current_history,
            _status(
                "Review the extracted information and check "
                "the confirmation box first.",
                "warning",
            ),
            False,
            extracted_text,
            answer,
            evidence,
            history_update,
            current_sessions,
            active_id,
        )
        return

    display_question = (
        (image_question or "").strip() or "Explain this document."
    )
    retrieval_question = (
        f"{display_question}\n\n"
        f"Confirmed extracted information:\n"
        f"{extracted_text.strip()}"
    )

    for item in chat_response(
        display_question,
        history,
        sessions,
        input_type="document",
        retrieval_message=retrieval_question,
        answer_detail=answer_detail,
        reading_level=reading_level,
    ):
        (
            current_history,
            _message,
            answer,
            evidence,
            history_update,
            current_sessions,
            active_id,
        ) = item
        yield (
            current_history,
            _status("Drafting the answer…", "busy"),
            False,
            extracted_text,
            answer,
            evidence,
            history_update,
            current_sessions,
            active_id,
        )

    yield (
        current_history,
        _status(
            "Confirmed information sent to Conversations.",
            "success",
        ),
        False,
        "",
        answer,
        evidence,
        history_update,
        current_sessions,
        active_id,
    )


def load_approved_sources() -> list[list[str]]:
    if not KNOWLEDGE_DIR.exists():
        return []

    rows: list[list[str]] = []

    for metadata_path in sorted(KNOWLEDGE_DIR.glob("*.json")):
        try:
            metadata = json.loads(
                metadata_path.read_text(encoding="utf-8"),
            )
        except (OSError, ValueError):
            continue

        if not metadata.get("approved"):
            continue

        source_url = metadata.get("source_url", "")

        rows.append(
            [
                metadata.get("title", metadata_path.stem),
                metadata.get("publisher", "Unknown publisher"),
                metadata.get("publication_date", "—"),
                metadata.get("review_date", "—"),
                f"[Open]({source_url})" if source_url else "—",
            ]
        )

    return rows


def filter_approved_sources(query: str) -> list[list[str]]:
    rows = load_approved_sources()
    clean_query = (query or "").strip().lower()

    if not clean_query:
        return rows

    return [
        row
        for row in rows
        if clean_query in " ".join(row).lower()
    ]


def describe_knowledge_base() -> str:
    rows = load_approved_sources()
    publishers = {row[1] for row in rows}

    if not rows:
        return (
            "No approved sources have been added yet."
        )

    return (
        f"**{len(rows)} approved documents** from "
        f"**{len(publishers)} publishers** are available locally."
    )


def refresh_knowledge_summaries() -> tuple[str, str]:
    summary = describe_knowledge_base()
    return summary, summary


def build_timeline_question(
    symptoms: str,
    started: str,
    changes: str,
    concerns: str,
) -> str:
    parts = [
        "Help me prepare a clear symptom timeline for a clinician.",
        "",
        f"Symptoms: {(symptoms or '').strip() or 'Not provided'}",
        f"When it started: {(started or '').strip() or 'Not provided'}",
        f"How it has changed: {(changes or '').strip() or 'Not provided'}",
        f"What worries me most: {(concerns or '').strip() or 'Not provided'}",
        "",
        (
            "Please organize this into a concise timeline and suggest "
            "clear questions I can ask at an appointment. Do not diagnose."
        ),
    ]
    return "\n".join(parts)


def build_visit_question(
    reason: str,
    goals: str,
    questions: str,
) -> str:
    parts = [
        "Help me prepare for an upcoming healthcare visit.",
        "",
        f"Reason for visit: {(reason or '').strip() or 'Not provided'}",
        f"What I hope to learn: {(goals or '').strip() or 'Not provided'}",
        (
            "Questions I already have: "
            f"{(questions or '').strip() or 'Not provided'}"
        ),
        "",
        (
            "Please suggest a short, practical list of questions and what "
            "information I should bring. Do not diagnose or prescribe."
        ),
    ]
    return "\n".join(parts)


def navigate(view: str):
    view_updates = [
        gr.update(visible=(key == view))
        for key in NAV_VIEWS
    ]
    button_updates = [
        gr.update(
            elem_classes=[
                "mg-nav-item",
                "mg-nav-active" if key == view else "",
            ]
        )
        for key in NAV_BUTTON_KEYS
    ]
    # Sidebar appears once the user leaves the landing surface.
    # Evidence stays hidden here; chat mode reveals it only with sources.
    return (
        view,
        *view_updates,
        *button_updates,
        gr.update(visible=False),
        gr.update(visible=True),
    )


def _busy(label: str):
    def _apply():
        return gr.update(value=label, interactive=False)

    return _apply


def _ready(label: str):
    def _apply():
        return gr.update(value=label, interactive=True)

    return _apply


