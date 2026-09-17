"use client";

import { useId, useState, type ReactNode } from "react";
import {
  Aperture,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  FileText,
  GitCompare,
  Layers,
  Link2,
  Mic,
  Pill,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Waves,
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

/**
 * A teaser, not the full instrument — deliberately lighter than TimelineChart
 * (no axis, no per-point buttons, no table fallback) so the hero previews
 * the idea of a trend without duplicating the full Lab Intelligence section
 * immediately below it.
 */
function HeroSparkline({ points }: { points: SyntheticLabPoint[] }) {
  const max = Math.max(...points.map((p) => p.value));
  const min = Math.min(...points.map((p) => p.value));
  const range = Math.max(max - min, 0.4);
  const width = 220;
  const height = 56;
  const coords = points.map((point, index) => {
    const x = (index / (points.length - 1)) * width;
    const y = height - ((point.value - min) / range) * (height - 12) - 6;
    return { x, y, point };
  });
  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");

  return (
    <svg
      className="hero-sparkline"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Hemoglobin A1C trend across ${points.length} verified synthetic reports, rising from ${points[0].value}% to ${points[points.length - 1].value}%`}
    >
      <path d={path} fill="none" stroke="#156b5a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {coords.map(({ x, y, point }, index) => (
        <circle key={point.id} cx={x} cy={y} r={index === coords.length - 1 ? 4 : 3} fill={index === coords.length - 1 ? "#d87968" : "#156b5a"} />
      ))}
    </svg>
  );
}

export function HeroLabTimeline({ onStart }: { onStart: StartHandler }) {
  const selected = SYNTHETIC_A1C_POINTS[SYNTHETIC_A1C_POINTS.length - 1];
  const first = SYNTHETIC_A1C_POINTS[0];
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
        <div className="hero-sparkline-row">
          <HeroSparkline points={SYNTHETIC_A1C_POINTS} />
          <p className="hero-sparkline-caption">
            {first.value}% → {selected.value}% across {SYNTHETIC_A1C_POINTS.length} verified reports
          </p>
        </div>
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

export function ConnectedRecordSection() {
  return (
    <section className="connected-record band-mint tier-2" id="connected">
      <div className="section-shell reveal">
        <div className="section-intro narrow">
          <p className="eyebrow">CONNECTED HEALTH INFORMATION</p>
          <h2>Your health information rarely lives in one place.</h2>
          <p>
            Lab reports, imaging reports, medication labels and visit notes often arrive as separate documents.
            MediGuide helps organize verified information while keeping every item connected to its original
            evidence.
          </p>
        </div>
        <div className="connected-record-grid">
          <article className="connected-tile connected-tile-photo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/mediguide_lifestyle.png" alt="" loading="lazy" decoding="async" />
            <div className="connected-tile-label">
              <span className="connected-tile-kicker">LABS</span>
              <p>Longitudinal measurements, verified and source-linked.</p>
            </div>
          </article>
          <article className="connected-tile connected-tile-icon">
            <span className="connected-tile-icon-mark">
              <ScanLine size={22} />
            </span>
            <span className="connected-tile-kicker">IMAGING</span>
            <p>Studies and radiology report text, organized by modality.</p>
          </article>
          <article className="connected-tile connected-tile-photo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/mediguide_medication_hero.png" alt="" loading="lazy" decoding="async" />
            <div className="connected-tile-label">
              <span className="connected-tile-kicker">MEDICATIONS</span>
              <p>Printed label information, verified before it is trusted.</p>
            </div>
          </article>
          <article className="connected-tile connected-tile-icon">
            <span className="connected-tile-icon-mark">
              <Stethoscope size={22} />
            </span>
            <span className="connected-tile-kicker">VISITS</span>
            <p>Preparation summaries built from information already verified.</p>
          </article>
        </div>
      </div>
    </section>
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

const IMAGING_MODALITIES = [
  { label: "X-Ray", Icon: ScanLine },
  { label: "CT", Icon: Layers },
  { label: "MRI", Icon: Aperture },
  { label: "Ultrasound", Icon: Waves },
  { label: "PET/CT", Icon: Sparkles },
];

const IMAGING_HISTORY_ROWS = [
  { year: "2026", modality: "MRI", region: "Right Knee", date: "Sep 02" },
  { year: "2025", modality: "MRI", region: "Right Knee", date: "May 14" },
  { year: "2024", modality: "X-Ray", region: "Right Knee", date: "Nov 03" },
];

export function ImagingIntelligenceSection({ onStart }: { onStart: StartHandler }) {
  return (
    <section className="imaging-intel band-white tier-1" id="imaging">
      <div className="section-shell imaging-intel-grid reveal">
        <div className="imaging-intel-side">
          <p className="eyebrow">IMAGING INTELLIGENCE</p>
          <h2>Keep imaging studies and their reports connected.</h2>
          <p>
            Organize X-Ray, CT, MRI, Ultrasound and PET/CT studies, verify information extracted from radiology
            reports, compare report wording over time, and return to the original source evidence.
          </p>
          <div className="imaging-modality-badges" aria-hidden="true">
            {IMAGING_MODALITIES.map(({ label, Icon }) => (
              <span key={label} className="imaging-modality-badge">
                <Icon size={16} /> {label}
              </span>
            ))}
          </div>
          <button type="button" className="text-link" onClick={() => onStart("imaging")}>
            Open imaging <ArrowUpRight size={13} />
          </button>
        </div>
        <MockChrome title="Imaging · History" subtitle="3 studies · verified" className="imaging-history-frame">
          <div className="imaging-history-mock">
            <p className="panel-kicker">Imaging History</p>
            {IMAGING_HISTORY_ROWS.map((row, index) => {
              const showYear = index === 0 || row.year !== IMAGING_HISTORY_ROWS[index - 1].year;
              return (
                <div key={`${row.year}-${row.date}`} className="imaging-history-mock-row">
                  {showYear ? <span className="imaging-history-mock-year">{row.year}</span> : <span />}
                  <div>
                    <strong>
                      {row.modality} · {row.region}
                    </strong>
                    <small>{row.date}</small>
                  </div>
                  <span className="imaging-history-mock-status">
                    <Check size={13} /> Report verified
                  </span>
                </div>
              );
            })}
            <button type="button" className="quiet-button imaging-history-mock-compare" onClick={() => onStart("imaging")}>
              <GitCompare size={14} /> Compare reports
            </button>
          </div>
        </MockChrome>
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
        <MockChrome title="Document review" subtitle="3 of 8 reviewed" className="verify-frame">
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
                    <tr>
                      <td>LDL Cholesterol</td>
                      <td>111 mg/dL</td>
                      <td>—</td>
                      <td>&lt;100</td>
                    </tr>
                  </tbody>
                </table>
                <p className="report-footnote">Synthetic portfolio sample — not a real patient record.</p>
              </div>
            </div>
            <div className="verify-fields">
              <p className="panel-kicker">Extracted lab information</p>
              <p className="review-progress">3 of 8 reviewed</p>
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
                    Confirmed <Check size={14} />
                  </button>
                </div>
              </article>
              <article className="verify-field-card">
                <header>
                  <strong>LDL Cholesterol</strong>
                  <span className="confidence-pill">Clearly visible</span>
                </header>
                <p className="verify-value">
                  111 <span>mg/dL</span>
                </p>
                <dl>
                  <div>
                    <dt>Printed reference range</dt>
                    <dd>&lt;100</dd>
                  </div>
                </dl>
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

const UNIFIED_TIMELINE_ROWS = [
  { date: "SEP 02", category: "Imaging", Icon: ScanLine, title: "MRI — Right Knee", detail: "Verified report", action: "View study" },
  { date: "AUG 12", category: "Laboratory", Icon: FileText, title: "Lab Report", detail: "12 verified measurements", action: "View results" },
  { date: "JUL 28", category: "Medication", Icon: Pill, title: "Medication label", detail: "Verified", action: "View" },
  { date: "APR 18", category: "Laboratory", Icon: FileText, title: "Lab Report", detail: "11 verified measurements", action: "View results" },
];

export function UnifiedTimelinePreview({ onStart }: { onStart: StartHandler }) {
  return (
    <section className="unified-timeline band-white tier-1" id="unified-timeline">
      <div className="section-shell reveal">
        <div className="section-intro narrow">
          <p className="eyebrow">CONNECTED ACROSS WORKSPACES</p>
          <h2>A clearer history across your health documents.</h2>
          <p>
            Health Timeline brings verified imaging, lab, and medication activity into one chronological view —
            every entry still links back to the workspace and evidence it came from.
          </p>
        </div>
        <MockChrome title="Health Timeline" subtitle="Verified · 2026" className="unified-timeline-frame">
          <div className="unified-timeline-mock">
            <p className="unified-timeline-year">2026</p>
            {UNIFIED_TIMELINE_ROWS.map((row) => (
              <div key={`${row.date}-${row.title}`} className="unified-timeline-row">
                <span className="unified-timeline-date">{row.date}</span>
                <div>
                  <span className="unified-timeline-category">
                    <row.Icon size={13} aria-hidden="true" /> {row.category}
                  </span>
                  <strong>{row.title}</strong>
                  <small>
                    <Check size={12} /> {row.detail}
                  </small>
                </div>
                <button type="button" className="text-link" onClick={() => onStart("timeline")}>
                  {row.action}
                </button>
              </div>
            ))}
          </div>
        </MockChrome>
        <button type="button" className="quiet-button" onClick={() => onStart("timeline")}>
          Open Health Timeline <ArrowUpRight size={14} />
        </button>
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
              <ScanLine size={16} />
            </span>
            <h3>Imaging</h3>
            <p>Organize X-Ray, CT, MRI, Ultrasound and PET/CT studies and their radiology reports.</p>
            <button type="button" className="text-link" onClick={() => onStart("imaging")}>
              Open imaging <ArrowUpRight size={13} />
            </button>
          </article>
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

const RESPONSIBLE_PRINCIPLES = [
  { Icon: Check, title: "VERIFY", detail: "Extracted information is reviewed before downstream use." },
  { Icon: Link2, title: "TRACE", detail: "Verified information remains connected to source evidence." },
  { Icon: BookOpen, title: "GROUND", detail: "Educational explanations use approved sources." },
];

export function ResponsibleAISection({ onStart }: { onStart?: StartHandler }) {
  return (
    <section className="responsible-ai band-white tier-3" id="responsible-ai">
      <div className="section-shell reveal">
        <div className="section-intro narrow">
          <p className="eyebrow">RESPONSIBLE AI + PRIVACY</p>
          <h2>Built around grounded AI.</h2>
        </div>
        <div className="principle-card-row">
          {RESPONSIBLE_PRINCIPLES.map(({ Icon, title, detail }) => (
            <article key={title} className="principle-card">
              <span className="principle-card-icon">
                <Icon size={17} />
              </span>
              <h3>{title}</h3>
              <p>{detail}</p>
            </article>
          ))}
        </div>
        <p className="responsible-statement">
          MediGuide does not autonomously diagnose conditions, prescribe treatment, or replace professional medical
          care.
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
    </section>
  );
}

export function FinalCTA({ onStart }: { onStart: StartHandler }) {
  return (
    <section className="final-cta band-mint" id="demo">
      <div className="section-shell final-cta-grid reveal">
        <div className="final-cta-copy">
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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="final-cta-photo"
          src="/assets/mediguide_lifestyle_home.png"
          alt="A person reviewing a printed lab report alongside their MediGuide results on a tablet at home"
          loading="lazy"
          decoding="async"
        />
      </div>
    </section>
  );
}
