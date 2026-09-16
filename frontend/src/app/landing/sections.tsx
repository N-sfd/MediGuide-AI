"use client";

import { useId, useState, type ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  FileText,
  Mic,
  Pill,
  ShieldCheck,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import {
  APPROVED_SOURCE_EXAMPLES,
  SYNTHETIC_A1C_POINTS,
  type SyntheticLabPoint,
} from "./synthetic-labs";

export type StartHandler = (view?: string, action?: string) => void;

export function MockChrome({
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

function flagLabel(flagged: SyntheticLabPoint["flagged"]) {
  if (flagged === "high") return "Flagged high on this report";
  if (flagged === "low") return "Flagged low on this report";
  return null;
}

function TimelineChart({
  points,
  selectedId,
  onSelect,
  compact = false,
}: {
  points: SyntheticLabPoint[];
  selectedId: string;
  onSelect: (id: string) => void;
  compact?: boolean;
}) {
  const chartId = useId();
  const max = Math.max(...points.map((p) => p.value));
  const min = Math.min(...points.map((p) => p.value)) - 0.2;
  const range = Math.max(max - min, 0.6);

  return (
    <div className={compact ? "lt-chart compact" : "lt-chart"} role="img" aria-labelledby={`${chartId}-title`} aria-describedby={`${chartId}-desc`}>
      <p id={`${chartId}-title`} className="sr-only">
        Hemoglobin A1C synthetic timeline
      </p>
      <p id={`${chartId}-desc`} className="sr-only">
        Three verified synthetic measurements: January 2026 6.2 percent, April 2026 6.5 percent, and August 2026 6.7 percent.
      </p>
      <div className="lt-chart-plot" aria-hidden>
        <div className="lt-y-axis">
          <span>6.8</span>
          <span>6.6</span>
          <span>6.4</span>
          <span>6.2</span>
        </div>
        <div className="lt-points">
          {points.map((point) => {
            const height = ((point.value - min) / range) * 100;
            const selected = point.id === selectedId;
            return (
              <button
                key={point.id}
                type="button"
                className={selected ? "lt-point selected" : "lt-point"}
                style={{ ["--h" as string]: `${Math.max(14, height)}%` }}
                onClick={() => onSelect(point.id)}
                aria-pressed={selected}
                aria-label={`${point.fullDate}: ${point.value}${point.unit}`}
              >
                <span className="lt-point-dot" />
                <strong>
                  {point.value}
                  {point.unit}
                </strong>
                <small>{point.dateLabel}</small>
              </button>
            );
          })}
        </div>
      </div>
      <ul className="lt-table-fallback">
        {points.map((point) => (
          <li key={`row-${point.id}`}>
            <button type="button" className={point.id === selectedId ? "active" : ""} onClick={() => onSelect(point.id)}>
              <span>{point.dateLabel}</span>
              <strong>
                {point.value}
                {point.unit}
              </strong>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HeroLabTimeline({ onStart }: { onStart: StartHandler }) {
  const [selectedId, setSelectedId] = useState(SYNTHETIC_A1C_POINTS[2].id);
  const selected = SYNTHETIC_A1C_POINTS.find((p) => p.id === selectedId) ?? SYNTHETIC_A1C_POINTS[2];
  const flag = flagLabel(selected.flagged);

  return (
    <MockChrome title="Lab Timeline" subtitle="Verified · Synthetic" className="hero-timeline-frame">
      <div className="hero-timeline-body hero-timeline-compact">
        <div className="lt-head">
          <div>
            <p className="panel-kicker">Hemoglobin A1C</p>
            <h3>
              {selected.value}
              <span className="lt-unit">%</span>
            </h3>
            <p className="lt-sub">{selected.fullDate} · Latest verified</p>
          </div>
          <span className="lt-badge">Synthetic</span>
        </div>
        <TimelineChart points={SYNTHETIC_A1C_POINTS} selectedId={selectedId} onSelect={setSelectedId} compact />
        <div className="hero-timeline-strip">
          {flag ? <span className="lt-flag">{flag}</span> : null}
          <button type="button" className="quiet-button lt-source-btn" onClick={() => onStart("documents", "sample")}>
            View source page <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </MockChrome>
  );
}

export function ProductWorkspacePreview({ onStart }: { onStart: StartHandler }) {
  const [selectedId, setSelectedId] = useState(SYNTHETIC_A1C_POINTS[2].id);
  const selected = SYNTHETIC_A1C_POINTS.find((p) => p.id === selectedId) ?? SYNTHETIC_A1C_POINTS[2];
  const flag = flagLabel(selected.flagged);

  return (
    <section className="flagship-workspace band-white tier-1" id="product">
      <div className="section-shell reveal">
        <div className="section-intro narrow">
          <p className="eyebrow">PRODUCT WORKSPACE</p>
          <h2>See measurements across reports — without losing the source.</h2>
          <p>
            The Lab Timeline organizes verified measurements from multiple reports while preserving the document
            evidence behind every result.
          </p>
        </div>
        <MockChrome title="Workspace · Lab Timeline" subtitle="Synthetic Jan · Apr · Aug" className="flagship-frame workspace-preview-frame">
          <div className="workspace-preview">
            <aside className="workspace-preview-nav" aria-hidden>
              <p className="wp-brand">MediGuide</p>
              <p className="wp-section">Workspace</p>
              <span>Documents</span>
              <span className="active">Lab Timeline</span>
              <span>Medications</span>
              <span>Visit Preparation</span>
              <span>Ask MediGuide</span>
            </aside>
            <div className="workspace-preview-main">
              <header className="wp-main-head">
                <div>
                  <h3>Lab Timeline</h3>
                  <p>Hemoglobin A1C · Latest verified result</p>
                </div>
                <div className="wp-latest">
                  <strong>
                    {selected.value}
                    {selected.unit}
                  </strong>
                  <small>{selected.fullDate}</small>
                </div>
              </header>
              <TimelineChart points={SYNTHETIC_A1C_POINTS} selectedId={selectedId} onSelect={setSelectedId} />
              <div className="wp-stats">
                <div>
                  <span>Verified measurements</span>
                  <strong>3</strong>
                </div>
                <div>
                  <span>Source reports</span>
                  <strong>3</strong>
                </div>
              </div>
              <div className="wp-selected">
                <p className="panel-kicker">Selected result</p>
                <p className="wp-selected-value">
                  {selected.value}
                  {selected.unit} · {selected.fullDate}
                </p>
                {flag ? <p className="lt-flag">{flag}</p> : null}
                <p className="wp-source-line">
                  {selected.document} · Page {selected.page}
                </p>
                <button type="button" className="quiet-button" onClick={() => onStart("documents", "sample")}>
                  View source page <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </MockChrome>
      </div>
    </section>
  );
}

export function DocumentWorkflow() {
  const row1 = [
    { n: "01", title: "Upload", detail: "Lab report · PDF or image" },
    { n: "02", title: "Extract", detail: "Values, dates, units, ranges" },
    { n: "03", title: "Verify", detail: "Review before downstream use" },
  ];
  const row2 = [
    { n: "06", title: "Trace", detail: "Return to report and page" },
    { n: "05", title: "Understand", detail: "Educational context with sources" },
    { n: "04", title: "Track", detail: "Timeline across verified reports" },
  ];

  return (
    <section className="doc-intel-workflow band-mint tier-2" id="how-it-works">
      <div className="section-shell reveal">
        <div className="section-intro narrow">
          <p className="eyebrow">FROM DOCUMENT TO TRACEABLE INFORMATION</p>
          <h2>One report. Structured information. Preserved evidence.</h2>
        </div>
        <div className="workflow-pipeline" aria-label="Document intelligence workflow">
          <ol className="workflow-pipeline-row">
            {row1.map((step, index) => (
              <li key={step.n} className="workflow-pipe-step">
                <span className="workflow-rail-num">{step.n}</span>
                <strong>{step.title}</strong>
                <small>{step.detail}</small>
                {index < row1.length - 1 ? <span className="workflow-pipe-line" aria-hidden /> : null}
              </li>
            ))}
          </ol>
          <div className="workflow-pipeline-turn" aria-hidden>
            <span />
          </div>
          <ol className="workflow-pipeline-row reverse">
            {row2.map((step, index) => (
              <li key={step.n} className="workflow-pipe-step">
                <span className="workflow-rail-num">{step.n}</span>
                <strong>{step.title}</strong>
                <small>{step.detail}</small>
                {index < row2.length - 1 ? <span className="workflow-pipe-line" aria-hidden /> : null}
              </li>
            ))}
          </ol>
        </div>
        <ol className="workflow-stepper-mobile" aria-label="Document intelligence workflow mobile">
          {[...row1, { n: "04", title: "Track", detail: "Timeline across verified reports" }, { n: "05", title: "Understand", detail: "Educational context with sources" }, { n: "06", title: "Trace", detail: "Return to report and page" }].map((step) => (
            <li key={`m-${step.n}`}>
              <span>{step.n}</span>
              <div>
                <strong>{step.title}</strong>
                <small>{step.detail}</small>
              </div>
            </li>
          ))}
        </ol>
        <div className="workflow-emphasis">
          <p className="workflow-emphasis-lead">The source never disappears.</p>
          <p>Every verified measurement retains a connection to the document and page it came from.</p>
        </div>
      </div>
    </section>
  );
}

export function VerificationDemo({ onStart }: { onStart: StartHandler }) {
  return (
    <section className="verification-demo band-white tier-1" id="verification">
      <div className="section-shell reveal">
        <div className="section-intro narrow">
          <p className="eyebrow">HUMAN VERIFICATION</p>
          <h2>AI extracts. You verify.</h2>
          <p>
            Before extracted information enters a timeline or explanation workflow, MediGuide lets you review what was
            found against the original report.
          </p>
        </div>
        <MockChrome title="Document review" subtitle="2 of 8 reviewed" className="verify-frame">
          <div className="verify-toolbar">
            <div className="verify-toolbar-doc">
              <FileText size={15} />
              <div>
                <strong>Synthetic Lab Report</strong>
                <small>Page 2 of 3</small>
              </div>
            </div>
            <div className="verify-zoom" aria-hidden>
              <span>−</span>
              <em>100%</em>
              <span>+</span>
              <button type="button" tabIndex={-1}>Fit width</button>
            </div>
          </div>
          <div className="verify-grid">
            <div className="verify-report" aria-label="Synthetic report preview">
              <div className="verify-report-page">
                <p className="report-letterhead">SYNTHETIC CLINICAL LABORATORY</p>
                <p className="report-meta">Collection date: Aug 12, 2026 · Demo specimen only</p>
                <table>
                  <thead>
                    <tr>
                      <th>Test</th>
                      <th>Result</th>
                      <th>Flag</th>
                      <th>Reference</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="highlight-row">
                      <td>Hemoglobin A1C</td>
                      <td>6.7 %</td>
                      <td>H</td>
                      <td>&lt;5.7</td>
                    </tr>
                    <tr>
                      <td>Glucose</td>
                      <td>108 mg/dL</td>
                      <td>—</td>
                      <td>70–99</td>
                    </tr>
                  </tbody>
                </table>
                <p className="report-footnote">Synthetic portfolio sample — not a real patient record.</p>
              </div>
            </div>
            <div className="verify-fields">
              <p className="panel-kicker">Extracted lab information</p>
              <p className="review-progress">2 of 8 reviewed</p>
              <article className="verify-field-card active">
                <header>
                  <strong>Hemoglobin A1C</strong>
                  <span className="confidence-pill">Clearly visible</span>
                </header>
                <p className="verify-value">
                  6.7 <span>%</span>
                </p>
                <dl>
                  <div>
                    <dt>Printed reference range</dt>
                    <dd>&lt;5.7</dd>
                  </div>
                </dl>
                <p className="lt-flag">Flagged high on this report</p>
                <div className="verify-actions">
                  <button type="button" className="forest-button" onClick={() => onStart("documents", "sample")}>
                    Confirm <Check size={14} />
                  </button>
                  <button type="button" className="quiet-button" onClick={() => onStart("documents", "sample")}>
                    Edit
                  </button>
                </div>
              </article>
              <article className="verify-field-card next-field">
                <header>
                  <strong>Glucose</strong>
                  <span className="confidence-pill needs-review">Needs review</span>
                </header>
                <p className="verify-value">
                  108 <span>mg/dL</span>
                </p>
                <dl>
                  <div>
                    <dt>Printed reference range</dt>
                    <dd>70–99</dd>
                  </div>
                </dl>
              </article>
              <p className="verify-note">Extraction confidence describes readability only — not medical correctness.</p>
            </div>
          </div>
        </MockChrome>
      </div>
    </section>
  );
}

export function ProvenanceSection() {
  return (
    <section className="provenance-section band-mint tier-1" id="provenance">
      <div className="section-shell reveal">
        <div className="section-intro narrow">
          <p className="eyebrow">BUILT FOR TRACEABILITY</p>
          <h2>Grounded twice.</h2>
        </div>
        <div className="provenance-visual">
          <article className="provenance-chain">
            <p className="panel-kicker">Document evidence</p>
            <ol>
              <li>
                <strong>Timeline measurement</strong>
                <span>6.7%</span>
              </li>
              <li>
                <strong>Verified result</strong>
                <span>Human-confirmed</span>
              </li>
              <li>
                <strong>Extracted field</strong>
                <span>Structured value</span>
              </li>
              <li>
                <strong>Page 2</strong>
                <span>Document page</span>
              </li>
              <li>
                <strong>Original report</strong>
                <span>Uploaded source</span>
              </li>
            </ol>
          </article>
          <article className="provenance-chain knowledge">
            <p className="panel-kicker">Educational evidence</p>
            <ol>
              <li>
                <strong>Explanation</strong>
                <span>Educational statement</span>
              </li>
              <li>
                <strong>Citation [1]</strong>
                <span>In-answer reference</span>
              </li>
              <li>
                <strong>MedlinePlus</strong>
                <span>Approved publisher</span>
              </li>
              <li>
                <strong>Reviewed source</strong>
                <span>Transparent origin</span>
              </li>
            </ol>
          </article>
        </div>
        <div className="provenance-contrast" aria-label="Evidence boundary">
          <p>What your document says</p>
          <span>≠</span>
          <p>General educational information</p>
        </div>
        <p className="provenance-statement">
          MediGuide keeps these evidence chains separate and visible.
        </p>
      </div>
    </section>
  );
}

export function GroundedExplanationDemo({ onStart }: { onStart: StartHandler }) {
  return (
    <section className="grounded-explain band-white tier-2" id="explanation">
      <div className="section-shell reveal">
        <div className="section-intro narrow">
          <p className="eyebrow">GROUNDED EDUCATIONAL EXPLANATION</p>
          <h2>Educational context — with sources you can see.</h2>
          <p>
            After verification, MediGuide can explain generally what a measurement means using approved educational
            sources. It does not diagnose or interpret your personal result clinically.
          </p>
        </div>
        <MockChrome title="Understand this result" subtitle="Educational support" className="explain-demo-frame">
          <div className="explain-structured">
            <p className="panel-kicker">Understand this result</p>
            <h3>Hemoglobin A1C</h3>
            <div className="explain-report-block">
              <p className="panel-kicker">Your report</p>
              <p>
                <strong>6.7%</strong> · Printed reference range: &lt;5.7%
              </p>
            </div>
            <div className="explain-about-block">
              <p className="panel-kicker">About this test</p>
              <p>
                Hemoglobin A1C reflects average blood glucose over roughly the prior two to three months. Approved
                educational sources describe how the test is used in general health education.{" "}
                <button type="button" className="citation" onClick={() => onStart("sources")}>
                  [1]
                </button>{" "}
                <button type="button" className="citation" onClick={() => onStart("sources")}>
                  [2]
                </button>
              </p>
            </div>
            <div className="explain-sources-block">
              <p className="panel-kicker">Sources</p>
              <ul>
                {APPROVED_SOURCE_EXAMPLES.map((source) => (
                  <li key={source.n}>
                    <button type="button" onClick={() => onStart("sources")}>
                      [{source.n}] {source.publisher}
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" className="quiet-button" onClick={() => onStart("sources")}>
                View all sources <ArrowUpRight size={14} />
              </button>
            </div>
            <p className="explain-boundary">
              <ShieldCheck size={14} /> General educational information. Not a diagnosis or treatment recommendation.
            </p>
          </div>
        </MockChrome>
      </div>
    </section>
  );
}

export function SupportingCapabilities({ onStart }: { onStart: StartHandler }) {
  return (
    <section className="supporting-caps band-light tier-3" id="supporting">
      <div className="section-shell reveal">
        <div className="section-intro narrow">
          <p className="eyebrow">SUPPORTING CAPABILITIES</p>
          <h2>Around the document pipeline.</h2>
        </div>
        <div className="support-card-grid restrained">
          <article className="support-card quiet">
            <span className="support-icon">
              <Pill size={16} />
            </span>
            <h3>Medications</h3>
            <p>Verify printed medication information and open trusted educational context.</p>
            <button type="button" className="text-link" onClick={() => onStart("medication")}>
              Open medications <ArrowUpRight size={13} />
            </button>
          </article>
          <article className="support-card quiet">
            <span className="support-icon">
              <Stethoscope size={16} />
            </span>
            <h3>Visit Preparation</h3>
            <p>Organize concerns, verified labs, medications, and questions before an appointment.</p>
            <button type="button" className="text-link" onClick={() => onStart("visit")}>
              Open visit preparation <ArrowUpRight size={13} />
            </button>
          </article>
          <article className="support-card quiet">
            <span className="support-icon">
              <Mic size={16} />
            </span>
            <h3>Voice</h3>
            <p>Speak naturally, review the transcript, then confirm before sending.</p>
            <button type="button" className="text-link" onClick={() => onStart("conversation")}>
              Open Ask MediGuide <ArrowUpRight size={13} />
            </button>
          </article>
        </div>
      </div>
    </section>
  );
}

export function ResponsibleAISection({ onStart }: { onStart?: StartHandler }) {
  const principles = [
    "Source evidence stays visible",
    "Human verification before downstream use",
    "Synthetic / demo data available",
    "Clear educational boundaries",
    "Document deletion controls",
    "Privacy-conscious processing",
  ];

  return (
    <section className="responsible-ai band-white tier-3" id="responsible-ai">
      <div className="section-shell reveal">
        <div className="responsible-grid">
          <div>
            <p className="eyebrow">RESPONSIBLE AI + PRIVACY</p>
            <h2>Built around grounded AI.</h2>
            <p>
              Extracted information stays connected to its original document evidence, while educational explanations are
              supported by approved health sources. MediGuide does not autonomously diagnose conditions, prescribe
              treatment, or replace professional medical care.
            </p>
            <p className="privacy-inline" id="privacy">
              Session uploads and temporary files are designed to stay under user control. MediGuide is an educational
              prototype — not a clinical system of record.
            </p>
            {onStart ? (
              <button type="button" className="quiet-button privacy-system-link" onClick={() => onStart("system")}>
                Open system status <ArrowUpRight size={14} />
              </button>
            ) : null}
          </div>
          <ul className="principle-list">
            {principles.map((item) => (
              <li key={item}>
                <Check size={15} /> {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export function FinalCTA({ onStart }: { onStart: StartHandler }) {
  return (
    <section className="final-cta band-mint" id="demo">
      <div className="section-shell reveal">
        <p className="eyebrow">TRY MEDIGUIDE</p>
        <h2>See document intelligence with the evidence still attached.</h2>
        <p>Explore MediGuide using synthetic lab data, or open the workspace to review a document.</p>
        <div className="final-cta-actions">
          <button type="button" className="forest-button" onClick={() => onStart("documents", "sample")}>
            Try the synthetic demo <ArrowUpRight size={17} />
          </button>
          <button type="button" className="quiet-button" onClick={() => onStart("documents")}>
            Open workspace
          </button>
        </div>
        <p className="final-boundary">
          <Sparkles size={14} /> Educational support only. No autonomous diagnosis or treatment decisions.
        </p>
      </div>
    </section>
  );
}
