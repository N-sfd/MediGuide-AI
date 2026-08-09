"""Landing-page hero and marketing sections for MediGuide."""

from __future__ import annotations

from src.config import BASE_DIR

LIFESTYLE_IMAGE = BASE_DIR / "assets" / "mediguide_lifestyle.png"
LIFESTYLE_FILE_URL = (
    f"/gradio_api/file={LIFESTYLE_IMAGE.as_posix()}"
    if LIFESTYLE_IMAGE.exists()
    else ""
)

PRODUCT_HERO_IMAGE = BASE_DIR / "assets" / "mediguide_product_hero.png"
PRODUCT_HERO_FILE_URL = (
    f"/gradio_api/file={PRODUCT_HERO_IMAGE.as_posix()}"
    if PRODUCT_HERO_IMAGE.exists()
    else ""
)

DOCS_SECTION_IMAGE = BASE_DIR / "assets" / "mediguide_docs_section.png"
DOCS_SECTION_FILE_URL = (
    f"/gradio_api/file={DOCS_SECTION_IMAGE.as_posix()}"
    if DOCS_SECTION_IMAGE.exists()
    else ""
)

VOICE_SECTION_IMAGE = BASE_DIR / "assets" / "mediguide_voice_section.png"
VOICE_SECTION_FILE_URL = (
    f"/gradio_api/file={VOICE_SECTION_IMAGE.as_posix()}"
    if VOICE_SECTION_IMAGE.exists()
    else ""
)

EVIDENCE_SECTION_IMAGE = BASE_DIR / "assets" / "mediguide_evidence_section.png"
EVIDENCE_SECTION_FILE_URL = (
    f"/gradio_api/file={EVIDENCE_SECTION_IMAGE.as_posix()}"
    if EVIDENCE_SECTION_IMAGE.exists()
    else ""
)

VISIT_SECTION_IMAGE = BASE_DIR / "assets" / "mediguide_visit_section.png"
VISIT_SECTION_FILE_URL = (
    f"/gradio_api/file={VISIT_SECTION_IMAGE.as_posix()}"
    if VISIT_SECTION_IMAGE.exists()
    else ""
)

_MINI_LOGO = """
<svg class="mg-mock-logo" width="16" height="16" viewBox="0 0 32 32" fill="none">
  <path d="M16 5.2l8.2 3.1v6.2c0 5.05-3.35 9.1-8.2 10.7
           C10.15 23.6 6.8 19.55 6.8 14.5V8.3L16 5.2z"
        stroke="#176B5B" stroke-width="2" stroke-linejoin="round"/>
  <path d="M16 12.85l.72 1.85 1.85.72-1.85.72L16 18l-.72-1.86
           -1.85-.72 1.85-.72.72-1.85z" fill="#176B5B"/>
</svg>
"""

_ICONS = {
    "upload": """
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 16V5M12 5l-4 4M12 5l4 4" stroke="currentColor"
            stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M5 19h14" stroke="currentColor" stroke-width="1.7"
            stroke-linecap="round"/>
    </svg>""",
    "extract": """
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="3.5" width="16" height="17" rx="2.5"
            stroke="currentColor" stroke-width="1.7"/>
      <path d="M8 9h8M8 13h5" stroke="currentColor" stroke-width="1.7"
            stroke-linecap="round"/>
      <circle cx="16.5" cy="15.5" r="2.2" stroke="currentColor" stroke-width="1.5"/>
    </svg>""",
    "explain": """
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 6.5h14v8.5a2 2 0 0 1-2 2H11l-4 3v-3H7a2 2 0 0 1-2-2V6.5z"
            stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>
      <path d="M9 10h6M9 13h4" stroke="currentColor" stroke-width="1.7"
            stroke-linecap="round"/>
    </svg>""",
    "evidence": """
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 4h7l3 3v13H7V4z" stroke="currentColor" stroke-width="1.7"
            stroke-linejoin="round"/>
      <path d="M14 4v3h3M9 11h6M9 15h4" stroke="currentColor" stroke-width="1.7"
            stroke-linecap="round" stroke-linejoin="round"/>
    </svg>""",
    "questions": """
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="3"
            stroke="currentColor" stroke-width="1.7"/>
      <path d="M8 9h8M8 13h5M8 17h3" stroke="currentColor" stroke-width="1.7"
            stroke-linecap="round"/>
    </svg>""",
}


def _section_figure(url: str, alt: str) -> str:
    if not url:
        return ""
    return f"""
    <figure class="mg-section-figure">
      <img src="{url}" alt="{alt}" class="mg-section-image"
           loading="lazy" width="1200" height="675" />
    </figure>
    """


def _floating_cards_html() -> str:
    return """
    <aside class="mg-float-card mg-float-doc" aria-hidden="true">
      <span class="mg-float-check">✓</span>
      <div>
        <strong>Document verified</strong>
        <p>Lab values reviewed</p>
      </div>
    </aside>
    <svg class="mg-float-line mg-float-line-doc" viewBox="0 0 80 60"
         aria-hidden="true" preserveAspectRatio="none">
      <path d="M4 30 C 28 30, 40 8, 76 12" fill="none" stroke="#9BB5AD"
            stroke-width="1.4" stroke-dasharray="3 4"/>
    </svg>
    <aside class="mg-float-card mg-float-privacy" aria-hidden="true">
      <span class="mg-float-check">✓</span>
      <div>
        <strong>Processed privately</strong>
        <p>On-device · Temporary</p>
      </div>
    </aside>
    <svg class="mg-float-line mg-float-line-privacy" viewBox="0 0 80 60"
         aria-hidden="true" preserveAspectRatio="none">
      <path d="M76 30 C 52 30, 40 48, 4 44" fill="none" stroke="#9BB5AD"
            stroke-width="1.4" stroke-dasharray="3 4"/>
    </svg>
    """


def _product_visual_html() -> str:
    """Right-column product composition: image preferred, HTML fallback."""
    if PRODUCT_HERO_FILE_URL:
        # Product PNG already includes the two allowed floating cards
        # (Document verified / Processed privately) with connector lines.
        return f"""
        <div class="mg-hero-visual mg-rise mg-rise-delay">
          <div class="mg-hero-glow-local" aria-hidden="true"></div>
          <div class="mg-hero-dotgrid" aria-hidden="true"></div>
          <div class="mg-hero-mesh" aria-hidden="true"></div>
          <img
            src="{PRODUCT_HERO_FILE_URL}"
            alt="MediGuide desktop interface: lab report uploaded, AI explanation,
                 evidence panel, voice playback, privacy badge, and citations"
            class="mg-product-hero-img"
            width="1100"
            height="720"
          />
        </div>
        """

    return f"""
        <div class="mg-hero-visual mg-rise mg-rise-delay" aria-hidden="true">
          <div class="mg-hero-dotgrid"></div>
          <div class="mg-hero-mesh"></div>
          {_floating_cards_html()}

          <div class="mg-product-window">
            <div class="mg-product-topbar">
              {_MINI_LOGO}
              <span class="mg-product-title">Lab report explanation</span>
              <span class="mg-product-status">● Local · Private</span>
            </div>

            <div class="mg-product-workspace">
              <aside class="mg-mock-doc">
                <p class="mg-mock-doc-label">CBC panel</p>
                <div class="mg-mock-doc-lines">
                  <span></span><span></span><span></span><span></span>
                </div>
                <p class="mg-mock-doc-meta">Synthetic sample · No PHI</p>
              </aside>

              <div class="mg-mock-answer">
                <h3>Your results, explained</h3>
                <div class="mg-mock-metric">
                  <span>Hemoglobin</span>
                  <strong>13.2 g/dL</strong>
                </div>
                <div class="mg-mock-metric">
                  <span>Status</span>
                  <strong class="mg-in-range">Within the listed
                    reference range</strong>
                </div>
                <p class="mg-mock-copy">
                  This value sits within a common adult reference range
                  shown on the report. MediGuide can help you prepare
                  questions—not diagnose.
                </p>
                <div class="mg-mock-chips">
                  <span>What this may mean</span>
                  <span>Questions to ask your clinician</span>
                </div>
              </div>

              <aside class="mg-mock-evidence">
                <p class="mg-mock-ev-kicker">Evidence strength</p>
                <p class="mg-mock-ev-strong">Strong support</p>
                <ol class="mg-mock-sources">
                  <li><em>[1]</em> MedlinePlus
                    <small>Reviewed Jan 2025</small></li>
                  <li><em>[2]</em> CDC
                    <small>Reviewed Dec 2024</small></li>
                  <li><em>[3]</em> FDA
                    <small>Label education</small></li>
                </ol>
                <div class="mg-cite-pills">
                  <span>[1]</span><span>[2]</span><span>[3]</span>
                </div>
              </aside>
            </div>

            <div class="mg-product-footer">
              <button type="button" class="mg-mock-play" tabindex="-1">▶</button>
              <span class="mg-voice-wave">
                <i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>
              </span>
              <span class="mg-listen-label">Listen to explanation</span>
              <span class="mg-mock-lang">English ▾</span>
            </div>
          </div>
        </div>
        """


def _workflow_strip_html() -> str:
    """Horizontal how-it-works strip with icons and mini product thumbs."""
    steps = [
        (
            "upload",
            "Upload Document",
            "Drop a lab report or label",
            DOCS_SECTION_FILE_URL,
        ),
        (
            "extract",
            "AI Extraction",
            "Highlight and verify values",
            DOCS_SECTION_FILE_URL,
        ),
        (
            "explain",
            "Medical Explanation",
            "Plain-language summary",
            PRODUCT_HERO_FILE_URL,
        ),
        (
            "evidence",
            "Evidence",
            "Cited trusted sources",
            EVIDENCE_SECTION_FILE_URL,
        ),
        (
            "questions",
            "Questions for Doctor",
            "Ready for your visit",
            VISIT_SECTION_FILE_URL,
        ),
    ]

    items = []
    for i, (key, title, blurb, thumb) in enumerate(steps):
        thumb_html = (
            f'<img src="{thumb}" alt="" class="mg-wf-thumb" loading="lazy" />'
            if thumb
            else '<div class="mg-wf-thumb mg-wf-thumb-fallback" aria-hidden="true"></div>'
        )
        arrow = (
            '<span class="mg-wf-arrow" aria-hidden="true">→</span>'
            if i < len(steps) - 1
            else ""
        )
        items.append(
            f"""
            <article class="mg-wf-step">
              <div class="mg-wf-icon">{_ICONS[key]}</div>
              <div class="mg-wf-thumb-wrap">{thumb_html}</div>
              <h3>{title}</h3>
              <p>{blurb}</p>
            </article>
            {arrow}
            """
        )

    return f"""
    <section class="mg-lp-section mg-workflow-section" aria-labelledby="mg-wf-heading">
      <div class="mg-lp-intro">
        <p class="mg-lp-kicker">How MediGuide works</p>
        <h2 id="mg-wf-heading" class="mg-lp-title">
          From document to doctor-ready questions
        </h2>
        <p class="mg-lp-lead">
          One calm path: upload, extract, explain, cite, and prepare—
          without leaving your device.
        </p>
      </div>
      <div class="mg-workflow-strip" role="list">
        {"".join(items)}
      </div>
    </section>
    """


def build_home_hero_html() -> str:
    """Split hero: copy left, one large product composition right."""
    return f"""
    <section class="hero-shell mg-home-hero" aria-label="MediGuide overview">
      <div class="mg-hero-glow" aria-hidden="true"></div>
      <div class="mg-hero-orb mg-hero-orb-a" aria-hidden="true"></div>
      <div class="mg-hero-orb mg-hero-orb-b" aria-hidden="true"></div>
      <div class="mg-hero-split">
        <div class="hero-copy mg-rise">
          <p class="mg-hero-eyebrow">
            PRIVATE · LOCAL · EVIDENCE-SUPPORTED
          </p>
          <h1 class="hero-title">
            Understand your health information with confidence.
          </h1>
          <p class="mg-home-support">
            Ask general health questions, review medical documents, and
            prepare for appointments with clear explanations grounded in
            trusted educational sources.
          </p>
          <div class="mg-hero-actions">
            <button type="button" class="mg-hero-primary" id="mg-hero-ask">
              Ask MediGuide
              <span class="mg-btn-arrow" aria-hidden="true">→</span>
            </button>
            <button type="button" class="mg-hero-secondary" id="mg-hero-how">
              See how it works
            </button>
          </div>
          <ul class="mg-hero-trust" aria-label="Product promises">
            <li>
              <span class="mg-trust-icon" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 2.2l4.4 1.7v3.4c0 2.8-1.85 5-4.4 5.9
                           C5.45 12.3 3.6 10.1 3.6 7.3V3.9L8 2.2z"
                        stroke="currentColor" stroke-width="1.4"
                        stroke-linejoin="round"/>
                </svg>
              </span>
              Private by default
            </li>
            <li>
              <span class="mg-trust-icon" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="3" y="3" width="10" height="10" rx="2.2"
                        stroke="currentColor" stroke-width="1.4"/>
                  <path d="M6 8h4M8 6v4" stroke="currentColor"
                        stroke-width="1.4" stroke-linecap="round"/>
                </svg>
              </span>
              Local processing
            </li>
            <li>
              <span class="mg-trust-icon" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M4 4.5h8M4 8h8M4 11.5h5" stroke="currentColor"
                        stroke-width="1.4" stroke-linecap="round"/>
                </svg>
              </span>
              Evidence citations
            </li>
          </ul>
        </div>

        {_product_visual_html()}
      </div>
    </section>
    """


def build_landing_sections_html() -> str:
    """Homepage sections below the composer and quick-action cards."""
    if LIFESTYLE_FILE_URL:
        lifestyle = f"""
        <div class="mg-story-photo">
          <img src="{LIFESTYLE_FILE_URL}"
               alt="Person at home reviewing a medical report on a laptop
                    in warm daylight"
               class="mg-story-image" loading="lazy" />
        </div>
        """
    else:
        lifestyle = (
            '<div class="mg-story-photo mg-story-photo-fallback" '
            'aria-hidden="true"></div>'
        )

    docs_visual = _section_figure(
        DOCS_SECTION_FILE_URL,
        "Document understanding interface: lab report, highlighted values, "
        "editable extraction, AI explanation, and citation panel",
    ) or """
        <div class="mg-flow-row" aria-hidden="true">
          <article class="mg-flow-card">
            <p class="mg-flow-step">1</p>
            <h3>Uploaded document</h3>
            <div class="mg-mini-doc">
              <span></span><span></span><span></span>
              <em>CBC panel · Sample</em>
            </div>
          </article>
          <span class="mg-flow-arrow">→</span>
          <article class="mg-flow-card">
            <p class="mg-flow-step">2</p>
            <h3>Verified information</h3>
            <ul class="mg-mini-values">
              <li><span>Hemoglobin</span>
                <strong>13.2
                  <em class="mg-conf clear">Clearly visible</em>
                </strong></li>
              <li><span>Platelets</span>
                <strong>—
                  <em class="mg-conf review">Needs review</em>
                </strong></li>
            </ul>
          </article>
          <span class="mg-flow-arrow">→</span>
          <article class="mg-flow-card">
            <p class="mg-flow-step">3</p>
            <h3>Plain-language explanation</h3>
            <p class="mg-mini-explain">
              This hemoglobin reading sits within a common adult reference
              range. <span class="mg-cite-tag">[1]</span>
            </p>
          </article>
        </div>
        """

    voice_visual = _section_figure(
        VOICE_SECTION_FILE_URL,
        "Voice interface: waveform, editable transcript with medical terms "
        "highlighted, user confirmation, and audio response",
    ) or """
        <div class="mg-voice-flow" aria-hidden="true">
          <article class="mg-voice-panel">
            <p class="mg-flow-step">1 · Waveform</p>
            <div class="mg-voice-panel-wave">
              <i></i><i></i><i></i><i></i><i></i><i></i><i></i>
              <i></i><i></i><i></i><i></i><i></i>
            </div>
          </article>
          <article class="mg-flow-card">
            <p class="mg-flow-step">2 · Transcript</p>
            <p class="mg-mini-transcript">
              “Explain my <mark class="mg-tok-med">Amoxicillin</mark>
              dose of <mark class="mg-tok-num">5 mg</mark>.”
            </p>
          </article>
          <article class="mg-flow-card">
            <p class="mg-flow-step">3 · Confirm</p>
            <p class="mg-mini-confirm">✓ Ready to send</p>
          </article>
        </div>
        """

    evidence_visual = _section_figure(
        EVIDENCE_SECTION_FILE_URL,
        "Trusted source cards for CDC, MedlinePlus, FDA, and WHO with "
        "publisher, review date, evidence strength, and citation numbers",
    ) or """
        <div class="mg-source-showcase" aria-hidden="true">
          <article class="mg-showcase-card">
            <div class="mg-pub-icon" data-pub="medline">M</div>
            <div>
              <strong>MedlinePlus</strong>
              <p>Plain-language consumer health information</p>
              <span class="mg-cite-tag">[1]</span>
            </div>
          </article>
          <article class="mg-showcase-card">
            <div class="mg-pub-icon" data-pub="cdc">C</div>
            <div>
              <strong>CDC</strong>
              <p>Public health guidance</p>
              <span class="mg-cite-tag">[2]</span>
            </div>
          </article>
          <article class="mg-showcase-card">
            <div class="mg-pub-icon" data-pub="fda">F</div>
            <div>
              <strong>FDA</strong>
              <p>Medication labeling education</p>
              <span class="mg-cite-tag">[3]</span>
            </div>
          </article>
          <article class="mg-showcase-card">
            <div class="mg-pub-icon" data-pub="who">W</div>
            <div>
              <strong>WHO</strong>
              <p>Global health education</p>
              <span class="mg-cite-tag">[4]</span>
            </div>
          </article>
        </div>
        """

    visit_ui = _section_figure(
        VISIT_SECTION_FILE_URL,
        "Visit preparation interface: symptom timeline, appointment "
        "questions, and checklist",
    )

    return f"""
    <div class="mg-landing-sections" id="mg-how-it-works">

      {_workflow_strip_html()}

      <section class="mg-lp-section mg-lp-alt mg-lp-with-bg"
               aria-labelledby="mg-doc-heading">
        <div class="mg-lp-bg" aria-hidden="true"></div>
        <div class="mg-lp-intro">
          <p class="mg-lp-kicker">Document understanding</p>
          <h2 id="mg-doc-heading" class="mg-lp-title">
            From uploaded paperwork to clear explanations
          </h2>
          <p class="mg-lp-lead">
            Lab report → highlighted values → editable extraction →
            AI explanation → citation panel—inside one clean interface.
          </p>
        </div>
        {docs_visual}
      </section>

      <section class="mg-lp-section" aria-labelledby="mg-voice-heading">
        <div class="mg-lp-intro">
          <p class="mg-lp-kicker">Voice conversations</p>
          <h2 id="mg-voice-heading" class="mg-lp-title">
            Speak, review, confirm, then ask
          </h2>
          <p class="mg-lp-lead">
            Waveform → editable transcript → highlighted medical terms →
            confirmation → audio response. No microphones as decoration—
            just the product flow.
          </p>
        </div>
        {voice_visual}
      </section>

      <section class="mg-lp-section mg-lp-alt mg-lp-with-bg"
               aria-labelledby="mg-evidence-heading">
        <div class="mg-lp-bg" aria-hidden="true"></div>
        <div class="mg-lp-intro">
          <p class="mg-lp-kicker">Trusted evidence</p>
          <h2 id="mg-evidence-heading" class="mg-lp-title">
            Answers grounded in approved sources
          </h2>
          <p class="mg-lp-lead">
            CDC, MedlinePlus, FDA, and WHO appear as information cards with
            publisher, review date, evidence strength, and citation numbers.
          </p>
        </div>
        {evidence_visual}
      </section>

      <section class="mg-lp-section" aria-labelledby="mg-visit-heading">
        <div class="mg-story-grid">
          {lifestyle}
          <div class="mg-story-copy">
            <p class="mg-lp-kicker">Appointment preparation</p>
            <h2 id="mg-visit-heading" class="mg-lp-title">
              Prepare for more confident health conversations
            </h2>
            <p class="mg-lp-lead">
              Turn confusing paperwork and symptoms into clear notes and
              questions you can take to your appointment.
            </p>
            <button type="button" class="mg-hero-secondary mg-visit-cta"
                    id="mg-prepare-visit">
              Prepare for a visit
            </button>
          </div>
        </div>
        {visit_ui}
      </section>

      <section class="mg-privacy-strip" aria-label="Privacy">
        <div class="mg-privacy-strip-inner">
          <div>
            <h2 class="mg-lp-title">Private, local processing</h2>
            <p class="mg-lp-lead">
              Questions, documents, and voice stay on this device.
              Storage stays off unless you choose otherwise.
            </p>
          </div>
          <ul class="mg-privacy-points">
            <li>✓ On-device processing</li>
            <li>✓ No cloud account required</li>
            <li>✓ Clear session anytime</li>
          </ul>
        </div>
      </section>

      <section class="mg-safety-strip" aria-label="Safety limitations">
        <h2 class="mg-lp-title">Safety and limitations</h2>
        <p class="mg-lp-lead">
          MediGuide provides educational information only. It does not
          diagnose, prescribe, or replace professional medical care.
          In an emergency, call 911 or your local emergency number.
        </p>
      </section>

      <footer class="mg-landing-footer">
        <p>
          <strong>MediGuide</strong>
          · Your private health intelligence
        </p>
        <p>
          Educational AI · Not for emergencies or diagnosis
        </p>
      </footer>
    </div>
    """
