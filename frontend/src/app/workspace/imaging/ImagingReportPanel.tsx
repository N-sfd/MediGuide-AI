import { Check, FileText } from "lucide-react";
import { MODALITY_LABELS, SECTION_LABELS, SECTION_ORDER, type ImagingStudy, type ReportSection } from "./imaging-types";

/**
 * The verification workflow. Only sections actually present in `sections`
 * render — this list is never padded with guessed/empty sections for
 * types the extractor didn't find, which is a safety property (never
 * inventing report content), not an incidental gap.
 */
export function ImagingReportPanel({
  study,
  sections,
  editedSections,
  setEditedSections,
  reviewedTypes,
  setReviewedTypes,
  onConfirm,
  confirming,
  onViewSourcePage,
  onOpenTerminology,
}: {
  study: ImagingStudy;
  sections: ReportSection[];
  editedSections: Record<string, string>;
  setEditedSections: (value: Record<string, string>) => void;
  reviewedTypes: Set<string>;
  setReviewedTypes: (value: Set<string>) => void;
  onConfirm: () => void;
  confirming: boolean;
  onViewSourcePage: (pageNumber: number) => void;
  onOpenTerminology: (term: string, sourceExcerpt: string) => void;
}) {
  const orderedSections = SECTION_ORDER.map((type) => sections.find((s) => s.section_type === type)).filter(
    (s): s is ReportSection => Boolean(s),
  );
  const alreadyVerified = study.verification_status === "verified";
  const allReviewed = orderedSections.every((section) => reviewedTypes.has(section.section_type));

  function markReviewed(sectionType: string) {
    if (reviewedTypes.has(sectionType)) return;
    const next = new Set(reviewedTypes);
    next.add(sectionType);
    setReviewedTypes(next);
  }

  if (orderedSections.length === 0) {
    return <p className="imaging-empty-note">No recognized report sections were extracted from this file yet.</p>;
  }

  return (
    <div className="imaging-report-panel">
      <p className="imaging-report-kicker">
        <FileText size={13} /> FROM THE RADIOLOGY REPORT
      </p>

      {!alreadyVerified && (
        <p className="imaging-review-progress" role="status" aria-live="polite">
          {reviewedTypes.size} of {orderedSections.length} sections reviewed
        </p>
      )}

      {orderedSections.map((section) => {
        const currentText = editedSections[section.section_type] ?? section.section_text;
        const isCorrected = currentText !== section.original_text;
        const reviewed = reviewedTypes.has(section.section_type);
        return (
          <div key={section.section_id} className="imaging-section-block">
            <div className="imaging-section-header">
              <label htmlFor={`imaging-section-${section.section_id}`}>
                {SECTION_LABELS[section.section_type] || section.section_type}
              </label>
              <span className={`imaging-section-status imaging-section-status-${reviewed ? "reviewed" : "unreviewed"}`}>
                {alreadyVerified ? "Confirmed" : isCorrected ? "Corrected" : reviewed ? "Reviewed" : "Unverified"}
              </span>
            </div>

            {isCorrected && (
              <div className="imaging-original-extraction">
                <small>Original extraction</small>
                <p>{section.original_text}</p>
              </div>
            )}

            <textarea
              id={`imaging-section-${section.section_id}`}
              value={currentText}
              disabled={alreadyVerified}
              onFocus={() => markReviewed(section.section_type)}
              onChange={(event) =>
                setEditedSections({ ...editedSections, [section.section_type]: event.target.value })
              }
            />

            <div className="imaging-section-footer">
              <span className="imaging-source-line">
                Source: {MODALITY_LABELS[study.modality]} Report · Page {section.page_number}
              </span>
              <button type="button" className="quiet-button" onClick={() => onViewSourcePage(section.page_number)}>
                View source page
              </button>
              <button
                type="button"
                className="quiet-button"
                onClick={() =>
                  onOpenTerminology("", currentText.split(/\s+/).slice(0, 24).join(" "))
                }
              >
                Understand terminology
              </button>
            </div>
          </div>
        );
      })}

      {!alreadyVerified && (
        <button
          type="button"
          className="forest-button imaging-confirm-button"
          disabled={!allReviewed || confirming}
          onClick={onConfirm}
        >
          <Check size={14} /> Confirm reviewed sections
        </button>
      )}
    </div>
  );
}
