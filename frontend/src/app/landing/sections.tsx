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

function ResultDetail({
  point,
  onViewSource,
}: {
  point: SyntheticLabPoint;
  onViewSource?: () => void;
}) {
  const flag = flagLabel(point.flagged);
  return (
    <aside className="lt-detail" aria-label="Selected synthetic lab result">
      <p className="lt-detail-value">
        {point.value}
        <span>{point.unit}</span>
      </p>
      <p className="lt-detail-date">{point.fullDate}</p>
      {flag ? <p className="lt-flag">{flag}</p> : null}
      <dl>
        <div>
          <dt>Printed reference range</dt>
          <dd>&lt;5.7%</dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd>{point.document}</dd>
        </div>
        <div>
          <dt>Page</dt>
          <dd>{point.page}</dd>
        </div>
      </dl>
      {onViewSource ? (
        <button type="button" className="quiet-button lt-source-btn" onClick={onViewSource}>
          View source page <ArrowRight size={14} />
        </button>
      ) : (
        <p className="lt-source-static">
          View source page <ArrowRight size={14} />
        </p>
      )}
    </aside>
  );
}

export function HeroLabTimeline({ onStart }: { onStart: StartHandler }) {
  const [selectedId, setSelectedId] = useState(SYNTHETIC_A1C_POINTS[2].id);
  const selected = SYNTHETIC_A1C_POINTS.find((p) => p.id === selectedId) ?? SYNTHETIC_A1C_POINTS[2];

  return (
    <MockChrome title="Lab Timeline" subtitle="3 verified reports" className="hero-timeline-frame">
      <div className="hero-timeline-body">
        <div className="lt-head">
          <div>
            <p className="panel-kicker">Lab Timeline</p>
            <h3>Hemoglobin A1C</h3>
          </div>
          <span className="lt-badge">Synthetic data</span>
        </div>
        <TimelineChart points={SYNTHETIC_A1C_POINTS} selectedId={selectedId} onSelect={setSelectedId} compact />
        <ResultDetail point={selected} onViewSource={() => onStart("documents", "sample")} />
      </div>
    </MockChrome>
  );
}

export function LabTimelineDemo({ onStart }: { onStart: StartHandler }) {
  const [selectedId, setSelectedId] = useState(SYNTHETIC_A1C_POINTS[2].id);
  const selected = SYNTHETIC_A1C_POINTS.find((p) => p.id === selectedId) ?? SYNTHETIC_A1C_POINTS[2];

  return (
    <section className="flagship-timeline band-white" id="product">
      <div className="section-shell reveal">
        <div className="section-intro narrow">
          <p className="eyebrow">LONGITUDINAL LAB INTELLIGENCE</p>
          <h2>See measurements across reports — without losing the source.</h2>
          <p>
            MediGuide organizes verified measurements from multiple reports into a longitudinal view while preserving
            the document evidence behind every result.
          </p>
        </div>
        <MockChrome title="Lab Timeline · Hemoglobin A1C" subtitle="Synthetic Jan · Apr · Aug" className="flagship-frame">
          <div className="flagship-timeline-grid">
            <div>
              <div className="lt-head">
                <div>
                  <p className="panel-kicker">Lab Timeline</p>
                  <h3>Hemoglobin A1C</h3>
                  <p className="lt-sub">3 verified measurements · 3 synthetic source reports</p>
                </div>
              </div>
              <TimelineChart points={SYNTHETIC_A1C_POINTS} selectedId={selectedId} onSelect={setSelectedId} />
            </div>
            <ResultDetail point={selected} onViewSource={() => onStart("documents", "sample")} />
          </div>
        </MockChrome>
      </div>
    </section>
  );
}

export function DocumentWorkflow() {
  const steps = [
    { n: "01", title: "UPLOAD", detail: "Lab report · PDF or image" },
    { n: "02", title: "EXTRACT", detail: "Lab values · Dates, units and printed ranges" },
    { n: "03", title: "VERIFY", detail: "Review information before it is used" },
    { n: "04", title: "TRACK", detail: "Build a timeline across verified reports" },
    { n: "05", title: "UNDERSTAND", detail: "Plain-language educational context" },
    { n: "06", title: "TRACE", detail: "Return to the original report and page" },
  ];

  return (
    <section className="doc-intel-workflow band-mint" id="how-it-works">
      <div className="section-shell reveal">
        <div className="section-intro narrow">
          <p className="eyebrow">FROM DOCUMENT TO TRACEABLE INFORMATION</p>
          <h2>One report. Structured information. Preserved evidence.</h2>
        </div>
        <ol className="workflow-rail" aria-label="Document intelligence workflow">
          {steps.map((step, index) => (
            <li key={step.n} className="workflow-rail-step">
              <span className="workflow-rail-num">{step.n}</span>
              <strong>{step.title}</strong>
              <small>{step.detail}</small>
              {index < steps.length - 1 ? <span className="workflow-rail-arrow" aria-hidden>→</span> : null}
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
    <section className="verification-demo band-white" id="verification">
      <div className="section-shell reveal">
        <div className="section-intro narrow">
          <p className="eyebrow">HUMAN VERIFICATION</p>
          <h2>AI extracts. You verify.</h2>
          <p>
            Before extracted information enters a timeline or explanation workflow, MediGuide lets the user review what
            was found against the original report.
          </p>
        </div>
        <MockChrome title="Document review" subtitle="Human verification" className="verify-frame">
          <div className="verify-grid">
            <div className="verify-report" aria-label="Synthetic report preview">
              <div className="verify-report-head">
                <FileText size={16} />
                <div>
                  <strong>Synthetic Lab Report</strong>
                  <small>Page 2 · Aug 12, 2026</small>
                </div>
              </div>
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
              <h3>Information found in your report</h3>
              <article className="verify-field-card">
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
                  <div>
                    <dt>Page</dt>
                    <dd>2</dd>
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
    <section className="provenance-section band-mint" id="provenance">
      <div className="section-shell reveal">
        <div className="section-intro narrow">
          <p className="eyebrow">BUILT FOR TRACEABILITY</p>
          <h2>Grounded twice.</h2>
        </div>
        <div className="provenance-grid">
          <article className="provenance-card">
            <p className="panel-kicker">DOCUMENT GROUNDING</p>
            <h3>Lab value provenance</h3>
            <ol>
              <li>
                <strong>6.7% HbA1C</strong>
                <span>Timeline point</span>
              </li>
              <li>
                <strong>Verified observation</strong>
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
                <strong>Original lab report</strong>
                <span>Uploaded source</span>
              </li>
            </ol>
          </article>
          <article className="provenance-card knowledge">
            <p className="panel-kicker">KNOWLEDGE GROUNDING</p>
            <h3>Explanation provenance</h3>
            <ol>
              <li>
                <strong>Plain-language explanation</strong>
                <span>Educational statement</span>
              </li>
              <li>
                <strong>Supporting citation</strong>
                <span>In-answer reference</span>
              </li>
              <li>
                <strong>Approved health source</strong>
                <span>MedlinePlus · CDC · NIH</span>
              </li>
              <li>
                <strong>Reviewed source / version</strong>
                <span>Transparent origin</span>
              </li>
            </ol>
          </article>
        </div>
        <p className="provenance-statement">
          MediGuide separates what your document says from educational information about what it means.
        </p>
      </div>
    </section>
  );
}

export function GroundedExplanationDemo({ onStart }: { onStart: StartHandler }) {
  return (
    <section className="grounded-explain band-white" id="explanation">
      <div className="section-shell reveal">
        <div className="section-intro narrow">
          <p className="eyebrow">GROUNDED EDUCATIONAL EXPLANATION</p>
          <h2>Educational context — with sources you can see.</h2>
          <p>
            After verification, MediGuide can explain generally what a measurement means using approved educational
            sources. It does not diagnose or interpret your personal result clinically.
          </p>
        </div>
        <MockChrome title="Grounded explanation" subtitle="Educational support" className="explain-demo-frame">
          <div className="explain-demo-grid">
            <article className="explain-demo-main">
              <p className="panel-kicker">Educational context</p>
              <h3>Hemoglobin A1C</h3>
              <div className="explain-report-facts">
                <div>
                  <span>Your report lists</span>
                  <strong>6.7%</strong>
                </div>
                <div>
                  <span>Printed reference range</span>
                  <strong>&lt;5.7%</strong>
                </div>
              </div>
              <p>
                Hemoglobin A1C is a blood test that reflects average blood glucose over roughly the prior two to three
                months. Educational materials from approved sources describe how the test is used in general health
                education — not as a personal clinical assessment.{" "}
                <button type="button" className="citation" onClick={() => onStart("sources")}>
                  [1]
                </button>{" "}
                <button type="button" className="citation" onClick={() => onStart("sources")}>
                  [2]
                </button>
              </p>
              <p className="explain-boundary">
                <ShieldCheck size={14} /> General educational information, not a diagnosis or treatment recommendation.
              </p>
            </article>
            <aside className="explain-demo-sources" aria-label="Approved educational sources">
              <p className="panel-kicker">Explanation provenance</p>
              {APPROVED_SOURCE_EXAMPLES.map((source) => (
                <button key={source.n} type="button" className="source-mini-card" onClick={() => onStart("sources")}>
                  <b>[{source.n}]</b>
                  <span>
                    <strong>{source.publisher}</strong>
                    <em>{source.title}</em>
                    <small>{source.reviewed}</small>
                  </span>
                </button>
              ))}
            </aside>
          </div>
        </MockChrome>
      </div>
    </section>
  );
}

export function SupportingCapabilities({ onStart }: { onStart: StartHandler }) {
  return (
    <section className="supporting-caps band-light" id="supporting">
      <div className="section-shell reveal">
        <div className="section-intro narrow">
          <p className="eyebrow">MORE WAYS TO PREPARE AND UNDERSTAND</p>
          <h2>Supporting capabilities around the document pipeline.</h2>
        </div>
        <div className="support-card-grid">
          <article className="support-card">
            <span className="support-icon">
              <Pill size={18} />
            </span>
            <p className="panel-kicker">MEDICATION LABELS</p>
            <h3>Verify printed medication information</h3>
            <p>Extract printed medication information, verify what was read, and access trusted educational context.</p>
            <button type="button" className="quiet-button" onClick={() => onStart("medication")}>
              Open medications <ArrowUpRight size={14} />
            </button>
          </article>
          <article className="support-card">
            <span className="support-icon">
              <Stethoscope size={18} />
            </span>
            <p className="panel-kicker">VISIT PREPARATION</p>
            <h3>Organize before an appointment</h3>
            <p>Organize concerns, verified lab information, medications, documents, and questions before an appointment.</p>
            <button type="button" className="quiet-button" onClick={() => onStart("visit")}>
              Open visit preparation <ArrowUpRight size={14} />
            </button>
          </article>
          <article className="support-card">
            <span className="support-icon">
              <Mic size={18} />
            </span>
            <p className="panel-kicker">VOICE</p>
            <h3>Speak, then confirm</h3>
            <p>Speak naturally, review the transcript, and confirm important names, numbers, dates, and units before sending.</p>
            <button type="button" className="quiet-button" onClick={() => onStart("conversation")}>
              Open Ask MediGuide <ArrowUpRight size={14} />
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
    <section className="responsible-ai band-white" id="responsible-ai">
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
