"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, type ReactNode } from "react";
import {
  ArrowUpRight,
  BookOpen,
  Check,
  FileText,
  Pill,
  Play,
  ShieldCheck,
  Sparkles,
  Upload,
  Volume2,
} from "lucide-react";
import "./premium-landing.css";

function useReveal() {
  useEffect(() => {
    const nodes = document.querySelectorAll<HTMLElement>(".reveal");
    if (!nodes.length) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      nodes.forEach((node) => node.classList.add("is-visible"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.14, rootMargin: "0px 0px -40px 0px" },
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);
}

function MockChrome({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mg-ui-frame ${className}`}>
      <div className="browser-chrome">
        <div className="browser-dots" aria-hidden>
          <i />
          <i />
          <i />
        </div>
        <div className="browser-title">
          <strong>MediGuide</strong>
          <span>{title}</span>
        </div>
        <div className="browser-status">
          <span className="status-dot" /> {subtitle}
        </div>
      </div>
      <div className="mg-ui-body">{children}</div>
    </div>
  );
}

export function PremiumLanding({ onStart }: { onStart: () => void }) {
  useReveal();

  return (
    <main className="premium-landing">
      <header className="landing-header">
        <button className="app-brand" onClick={onStart}>
          <span className="brand-mark">
            <ShieldCheck size={15} />
          </span>
          <span>
            MediGuide <em>AI</em>
          </span>
        </button>
        <button className="quiet-button" onClick={onStart}>
          Open workspace <ArrowUpRight size={15} />
        </button>
      </header>

      <section className="premium-hero">
        <div className="premium-hero-copy reveal">
          <p className="eyebrow hero-trust-label">
            <span /> PRIVATE • LOCAL • EVIDENCE-SUPPORTED
          </p>
          <h1>
            Feel more informed.
            <br />
            <i>Ask better questions.</i>
          </h1>
          <p>
            MediGuide helps you understand health information, review medical documents and medication labels, use your
            voice, and prepare for appointments with trusted evidence alongside you.
          </p>
          <div className="hero-actions">
            <button className="forest-button" onClick={onStart}>
              Start a private session <ArrowUpRight size={17} />
            </button>
            <button
              className="quiet-button"
              onClick={() => document.getElementById("how-medi-guide-works")?.scrollIntoView({ behavior: "smooth" })}
            >
              See how it works
            </button>
          </div>
          <ul className="hero-trust">
            <li>
              <Check size={14} /> Private by default
            </li>
            <li>
              <Check size={14} /> Local processing
            </li>
            <li>
              <Check size={14} /> Evidence citations
            </li>
          </ul>
          <div className="hero-chips" aria-label="Example starting points">
            <button type="button" onClick={onStart}>
              Understand a medication label
            </button>
            <button type="button" onClick={onStart}>
              Review lab results
            </button>
            <button
              type="button"
              onClick={() => document.getElementById("how-medi-guide-works")?.scrollIntoView({ behavior: "smooth" })}
            >
              Prepare for an appointment
            </button>
          </div>
        </div>

        <div className="hero-product-stage hero-med-stage reveal reveal-delay">
          <figure className="hero-med-photo">
            <img
              src="/assets/mediguide_medication_hero.png"
              alt="Adult at home reviewing a generic prescription medication container beside a laptop"
            />
          </figure>

          <article className="med-explain-card" aria-label="MediGuide medication explanation preview">
            <header>
              <Sparkles size={14} />
              <strong>Medication explained</strong>
              <small>Educational</small>
            </header>
            <div className="med-identity">
              <span>Amoxicillin</span>
              <strong>500 mg</strong>
            </div>
            <div className="med-block">
              <h4>General information</h4>
              <p>Amoxicillin is an antibiotic used for certain bacterial infections.</p>
            </div>
            <div className="med-block">
              <h4>Things to understand</h4>
              <ul>
                <li>How it is generally taken</li>
                <li>Common side effects</li>
                <li>Important precautions</li>
              </ul>
            </div>
            <div className="med-evidence-row">
              <span>Supported by trusted sources</span>
              <div className="cite-pills">
                <span>[1]</span>
                <span>[2]</span>
                <span>[3]</span>
              </div>
            </div>
            <div className="med-listen">
              <button type="button" className="listen-play" aria-label="Play explanation">
                <Play size={12} fill="currentColor" />
              </button>
              <div>
                <strong>Listen to explanation</strong>
                <div className="waveform" aria-hidden>
                  {Array.from({ length: 22 }).map((_, i) => (
                    <i key={i} style={{ ["--h" as string]: `${30 + ((i * 19) % 50)}%` }} />
                  ))}
                </div>
              </div>
            </div>
          </article>

          <div className="hero-badge med-verify">
            <Pill size={17} />
            <span>
              <strong>Medication label</strong>
              <small>
                Amoxicillin · 500 mg
                <br />
                Needs your confirmation
              </small>
            </span>
            <em>Review</em>
          </div>
          <div className="hero-badge med-evidence">
            <Check size={16} />
            <span>
              <strong>Evidence checked</strong>
              <small>3 trusted educational sources</small>
            </span>
          </div>
        </div>
      </section>

      <section className="feature-proof-strip">
        <span>
          <Upload size={17} /> Document upload
        </span>
        <span>
          <Sparkles size={17} /> AI explanation
        </span>
        <span>
          <BookOpen size={17} /> Evidence citations
        </span>
        <span>
          <Volume2 size={17} /> Voice playback
        </span>
        <span>
          <ShieldCheck size={17} /> Private by design
        </span>
      </section>

      <section className="visit-prep-section band-light" id="how-medi-guide-works">
        <div className="section-shell reveal">
          <div className="section-intro">
            <p className="eyebrow">VISIT PREPARATION</p>
            <h2>
              Prepare for more confident <i>health conversations</i>
            </h2>
          </div>
          <div className="visit-prep-grid">
            <figure className="lifestyle-figure">
              <img
                src="/assets/mediguide_lifestyle_home.png"
                alt="Adult at home reviewing health information on a tablet in warm daylight"
                loading="lazy"
              />
            </figure>
            <MockChrome title="Visit preparation" subtitle="Private local">
              <div className="visit-ui-card nested">
                <div className="visit-ui-head">
                  <span className="brand-mark small">
                    <Sparkles size={13} />
                  </span>
                  <div>
                    <strong>Visit preparation</strong>
                    <small>Organize what you want to ask</small>
                  </div>
                  <em>80%</em>
                </div>
                <div className="visit-progress-bar" aria-hidden>
                  <i />
                </div>
                <div className="visit-field">
                  <span>Main concern</span>
                  <p>Understanding my recent lab results before my appointment</p>
                </div>
                <div className="visit-field">
                  <span>Questions for clinician</span>
                  <ul>
                    <li>
                      <Check size={13} /> Are there trends over time?
                    </li>
                    <li>
                      <Check size={13} /> Could medications affect this?
                    </li>
                    <li>Do I need follow-up testing?</li>
                  </ul>
                </div>
                <button className="forest-button" onClick={onStart}>
                  Open visit preparation <ArrowUpRight size={14} />
                </button>
              </div>
            </MockChrome>
          </div>
        </div>
      </section>

      <section className="document-workflow-section band-mint">
        <div className="section-shell reveal">
          <div className="workflow-copy">
            <p className="eyebrow">DOCUMENT WORKFLOW</p>
            <h2>
              Understand documents without losing <i>context</i>
            </h2>
            <p>
              Move from upload to verification to a grounded explanation. The review step keeps names, values, units,
              and dates in your hands.
            </p>
          </div>
          <MockChrome title="Document review" subtitle="Verified locally" className="doc-frame">
            <div className="doc-steps" aria-label="Document understanding workflow">
              <article className="doc-step">
                <span className="step-num">01</span>
                <h3>Upload</h3>
                <div className="step-upload">
                  <FileText size={22} />
                  <strong>Lab_Report.pdf</strong>
                  <small>2 pages · Temporary session file</small>
                </div>
              </article>
              <article className="doc-step">
                <span className="step-num">02</span>
                <h3>Verify</h3>
                <div className="step-verify">
                  <label>
                    Hemoglobin
                    <input defaultValue="13.2 g/dL" readOnly />
                    <em className="clear">Clearly visible</em>
                  </label>
                  <label>
                    WBC
                    <input defaultValue="6.2" readOnly />
                    <em className="review">Needs review</em>
                  </label>
                </div>
              </article>
              <article className="doc-step">
                <span className="step-num">03</span>
                <h3>Understand</h3>
                <div className="step-understand">
                  <p>Hemoglobin helps carry oxygen. Your value is within the listed reference range on this report.</p>
                  <div className="cite-pills">
                    <span>[1]</span>
                    <span>[2]</span>
                  </div>
                </div>
              </article>
            </div>
          </MockChrome>
        </div>
      </section>

      <section className="voice-workflow-section band-white">
        <div className="section-shell voice-split reveal">
          <div className="workflow-copy">
            <p className="eyebrow">VOICE, WITH A REVIEW STEP</p>
            <h2>
              Speak naturally. <i>Review before sending.</i>
            </h2>
            <p>
              Your voice becomes an editable transcript. MediGuide highlights medication names, numbers, units, and
              dates before anything is sent.
            </p>
          </div>
          <MockChrome title="Voice transcript" subtitle="Review before send">
            <div className="voice-ui nested" aria-label="Voice transcript confirmation workflow">
              <div className="voice-wave-card">
                <span className="rec-dot" />
                <div className="voice-wave">
                  {Array.from({ length: 42 }).map((_, i) => (
                    <i key={i} style={{ ["--h" as string]: `${22 + ((i * 23) % 70)}%` }} />
                  ))}
                </div>
                <small>00:18 captured locally</small>
              </div>
              <div className="flow-arrow" aria-hidden>
                ↓
              </div>
              <div className="transcript-card">
                <span className="panel-kicker">Editable transcript</span>
                <p>
                  Can you help me prepare a question about whether <mark>Amoxicillin</mark> at <mark>5 mg</mark> started
                  on <mark>August 12</mark> could affect my lab values?
                </p>
                <div className="term-pills">
                  <span>Amoxicillin</span>
                  <span>5 mg</span>
                  <span>August 12</span>
                </div>
              </div>
              <div className="flow-arrow" aria-hidden>
                ↓
              </div>
              <label className="voice-confirm">
                <input type="checkbox" defaultChecked readOnly /> I reviewed this transcript
              </label>
              <button className="forest-button voice-send" type="button" onClick={onStart}>
                Send confirmed question <ArrowUpRight size={14} />
              </button>
            </div>
          </MockChrome>
        </div>
      </section>

      <section className="evidence-showcase-section band-mint">
        <div className="section-shell evidence-split reveal">
          <div className="workflow-copy">
            <p className="eyebrow">TRANSPARENT BY DESIGN</p>
            <h2>
              See where every answer <i>comes from</i>
            </h2>
            <p>
              Evidence sits beside the explanation — with publisher, topic, review date, and the passage that supports
              the answer.
            </p>
          </div>
          <MockChrome title="Evidence panel" subtitle="Cited answers">
            <div className="evidence-sidebar-demo nested">
              <div className="evidence-demo-top">
                <div>
                  <p className="panel-kicker">Evidence</p>
                  <h3>Sources &amp; context</h3>
                </div>
                <strong>Strong support</strong>
              </div>
              {[
                {
                  n: 1,
                  publisher: "MedlinePlus",
                  topic: "Hemoglobin information",
                  date: "Reviewed Aug 2025",
                  passage: "Hemoglobin is the iron-rich protein in red blood cells that carries oxygen.",
                },
                {
                  n: 2,
                  publisher: "CDC",
                  topic: "Blood health education",
                  date: "Reviewed Mar 2025",
                  passage: "Lab reference ranges help describe typical values for a given population and method.",
                },
                {
                  n: 3,
                  publisher: "FDA",
                  topic: "Consumer health information",
                  date: "Reviewed Jan 2025",
                  passage: "Educational materials can help you prepare questions for a healthcare professional.",
                },
              ].map((source) => (
                <article className="evidence-demo-card" key={source.n}>
                  <b>[{source.n}]</b>
                  <div>
                    <strong>{source.publisher}</strong>
                    <span>{source.topic}</span>
                    <small>{source.date}</small>
                    <p>{source.passage}</p>
                  </div>
                </article>
              ))}
            </div>
          </MockChrome>
        </div>
      </section>

      <section className="privacy-section band-white">
        <div className="section-shell privacy-split reveal">
          <div className="privacy-copy">
            <p className="eyebrow">PRIVATE BY DESIGN</p>
            <h2>
              Your health information stays <i>in your hands.</i>
            </h2>
            <p>Clear data handling and responsible boundaries are part of the product, not an afterthought.</p>
            <div className="privacy-points">
              <span>
                <Check size={14} /> Temporary files cleared
              </span>
              <span>
                <Check size={14} /> No advertising profile
              </span>
              <span>
                <Check size={14} /> User-controlled uploads
              </span>
              <span>
                <Check size={14} /> Educational use only
              </span>
            </div>
          </div>
          <div className="privacy-visual">
            <ShieldCheck size={28} />
            <strong>Private processing</strong>
            <small>Session data is handled with care and control.</small>
            <i />
            <span>
              <Check size={13} /> Upload
            </span>
            <span>
              <Check size={13} /> Review
            </span>
            <span>
              <Check size={13} /> Clear
            </span>
          </div>
        </div>
      </section>

      <section className="final-cta band-mint">
        <div className="section-shell reveal">
          <p className="eyebrow">YOUR HEALTH QUESTIONS, WITH CONTEXT</p>
          <h2>
            Understand your health information <i>with more context.</i>
          </h2>
          <p>Educational guidance with evidence-backed sources and clear safety boundaries.</p>
          <div className="final-cta-actions">
            <button className="forest-button" onClick={onStart}>
              Start a private session <ArrowUpRight size={17} />
            </button>
            <button className="quiet-button" onClick={onStart}>
              <Upload size={15} /> Upload a medical document
            </button>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <span>
          <ShieldCheck size={14} /> Educational support, never a diagnosis.
        </span>
        <nav>
          <a href="#privacy">Privacy</a>
          <a href="#safety">Safety</a>
          <a href="#sources">Sources</a>
          <a href="#about">About</a>
          <a href="#terms">Terms</a>
        </nav>
        <span>© 2026 MediGuide AI</span>
      </footer>
    </main>
  );
}
