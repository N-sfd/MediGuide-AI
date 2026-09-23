"use client";

import { useState } from "react";
import { ArrowRight, BookOpen, CheckSquare, ChevronRight, FileText, Stethoscope } from "lucide-react";
import { MODALITY_LABELS, formatStudyDate, type ImagingFinding, type ImagingStudy, type ReportGap, type ReportSection } from "./imaging-types";
import {
  appendFindingToVisitPrep,
  appendQuestionsToVisitPrep,
  buildAppointmentQuestions,
  buildPossibleContext,
} from "./imaging-findings";

export function ImagingOverviewPanel({
  study,
  sections,
  findings,
  gaps,
  boundary,
  onViewSourcePage,
  onUnderstandFinding,
  onAddToVisit,
}: {
  study: ImagingStudy;
  sections: ReportSection[];
  findings: ImagingFinding[];
  gaps: ReportGap[];
  boundary: string;
  onViewSourcePage: (pageNumber: number, documentId?: string) => void;
  onUnderstandFinding: (finding: ImagingFinding) => void;
  onAddToVisit: () => void;
}) {
  const confirmed = findings.filter((f) => f.verification_status === "confirmed");
  const questions = buildAppointmentQuestions(confirmed);
  const context = buildPossibleContext(sections, confirmed);
  const clinicalHistory = sections.find((s) => s.section_type === "clinical_history")?.section_text?.trim();
  const technique = sections.find((s) => s.section_type === "technique")?.section_text?.trim();
  const sourcePage = confirmed[0]?.source_page || 1;
  const sourceDoc = confirmed[0]?.source_document_id;
  const studyLabel = [
    MODALITY_LABELS[study.modality],
    study.body_region || "",
  ]
    .filter(Boolean)
    .join(" · ");
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  if (confirmed.length === 0) {
    return (
      <div className="imaging-overview">
        <p className="imaging-boundary">{boundary}</p>
        <p className="imaging-empty-note">
          Confirm structured findings on the Report tab to see the report summary, educational context, and appointment
          questions here.
        </p>
      </div>
    );
  }

  function handleAddQuestions() {
    const selected = questions.filter((q) => checked[q.id]);
    appendQuestionsToVisitPrep(
      selected.length ? selected : questions,
      studyLabel,
      confirmed.map((f) => f.summary_label),
    );
    onAddToVisit();
  }

  return (
    <div className="imaging-overview">
      <p className="imaging-boundary imaging-image-boundary">{boundary}</p>

      <header className="imaging-overview-head">
        <h3>{studyLabel || MODALITY_LABELS[study.modality]}</h3>
        <p className="imaging-overview-meta">{formatStudyDate(study.study_date)}</p>
      </header>

      <section className="imaging-layer imaging-layer-report">
        <p className="imaging-layer-label">
          <FileText size={13} /> From your report · Study
        </p>
        <dl className="imaging-meta-grid">
          <div>
            <dt>Modality</dt>
            <dd>{MODALITY_LABELS[study.modality]}</dd>
          </div>
          <div>
            <dt>Body region</dt>
            <dd>{study.body_region || "Not listed"}</dd>
          </div>
          <div>
            <dt>Study date</dt>
            <dd>{formatStudyDate(study.study_date)}</dd>
          </div>
          <div>
            <dt>Institution</dt>
            <dd>{study.institution || "Not listed"}</dd>
          </div>
          <div>
            <dt>Verification</dt>
            <dd>{study.verification_status === "verified" ? "Report verified ✓" : study.verification_status.replaceAll("_", " ")}</dd>
          </div>
          {technique ? (
            <div className="wide">
              <dt>Technique</dt>
              <dd>{technique}</dd>
            </div>
          ) : null}
          {clinicalHistory ? (
            <div className="wide">
              <dt>Clinical history</dt>
              <dd>{clinicalHistory}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section className="imaging-layer imaging-layer-report">
        <div className="imaging-layer-head">
          <p className="imaging-layer-label">
            <FileText size={13} /> From your report · Key findings
          </p>
          <button type="button" className="quiet-button" onClick={() => onViewSourcePage(sourcePage, sourceDoc)}>
            View source <ArrowRight size={13} />
          </button>
        </div>
        <p className="imaging-summary-count">{confirmed.length} verified finding{confirmed.length === 1 ? "" : "s"}</p>
        <ul className="imaging-summary-list">
          {confirmed.map((finding) => (
            <li key={finding.finding_id}>
              <button type="button" className="imaging-finding-link" onClick={() => onUnderstandFinding(finding)}>
                {finding.summary_label}
                <ChevronRight size={14} />
              </button>
            </li>
          ))}
        </ul>
        <p className="imaging-source-attribution">
          Source: {studyLabel} · Page {sourcePage}
        </p>
      </section>

      <section className="imaging-layer imaging-layer-edu">
        <p className="imaging-layer-label">
          <BookOpen size={13} /> General health information · Understand your report
        </p>
        <ul className="imaging-understand-list">
          {confirmed.map((finding) => (
            <li key={finding.finding_id} className="imaging-understand-item">
              <button type="button" className="imaging-understand-toggle" onClick={() => onUnderstandFinding(finding)}>
                <span>{finding.summary_label}</span>
                <span className="imaging-understand-cta">
                  Understand <ChevronRight size={14} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {(context.fromReport || context.general) && (
        <section className="imaging-layer imaging-layer-edu">
          <p className="imaging-layer-label">
            <BookOpen size={13} /> Possible context
          </p>
          {context.fromReport ? (
            <div className="imaging-context-block">
              <p className="imaging-layer-label">From your report</p>
              <p>{context.fromReport}</p>
            </div>
          ) : null}
          {context.general ? (
            <div className="imaging-context-block">
              <p className="imaging-layer-label">General associations</p>
              <p>{context.general}</p>
            </div>
          ) : null}
          <p className="imaging-boundary">
            This separates report-documented context from general associations. It does not establish causation.
          </p>
        </section>
      )}

      {gaps.length > 0 ? (
        <section className="imaging-layer imaging-layer-report">
          <p className="imaging-layer-label">
            <FileText size={13} /> Not described in this report
          </p>
          <ul className="imaging-summary-list">
            {gaps.map((gap) => (
              <li key={gap.label}>{gap.label}</li>
            ))}
          </ul>
          <p className="imaging-boundary">{gaps[0]?.note}</p>
        </section>
      ) : null}

      <section className="imaging-layer imaging-layer-next">
        <p className="imaging-layer-label">
          <Stethoscope size={13} /> What may be discussed next
        </p>
        <p>
          A clinician may correlate the report wording with strength, range of motion, pain, function, and the actual
          images. Depending on examination findings, options commonly discussed can include rehabilitation,
          symptom-management approaches, further assessment, or surgical evaluation in appropriate cases.
        </p>
        <p className="imaging-boundary">
          These are general discussion points — not recommendations, prescriptions, or a determination that surgery is
          required.
        </p>

        <h4 className="imaging-questions-heading">Questions you may want to ask</h4>
        <ul className="imaging-question-list">
          {questions.map((question) => (
            <li key={question.id}>
              <label>
                <input
                  type="checkbox"
                  checked={Boolean(checked[question.id])}
                  onChange={() => setChecked((prev) => ({ ...prev, [question.id]: !prev[question.id] }))}
                />
                <span>{question.text}</span>
              </label>
            </li>
          ))}
        </ul>
        <div className="imaging-overview-actions">
          <button type="button" className="forest-button" onClick={handleAddQuestions}>
            <CheckSquare size={14} /> Add selected questions to Visit Preparation
          </button>
          <button
            type="button"
            className="quiet-button"
            onClick={() => {
              confirmed.forEach((f) => appendFindingToVisitPrep(studyLabel, f));
              onAddToVisit();
            }}
          >
            Add findings to Visit Preparation
          </button>
        </div>
      </section>
    </div>
  );
}
