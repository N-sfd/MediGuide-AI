import { ArrowLeft } from "lucide-react";
import { MODALITY_LABELS, formatStudyDate, type ImagingStudy } from "./imaging-types";
import type { CompareBucket } from "./imaging-types";
import { SECTION_LABELS } from "./imaging-types";
import { ImagingCompareEmptyState } from "./ImagingEmptyState";

export function ImagingCompare({
  candidates,
  compareA,
  setCompareA,
  compareB,
  setCompareB,
  sameModalityOnly,
  setSameModalityOnly,
  result,
  onRunCompare,
  onBack,
  onViewSource,
}: {
  candidates: ImagingStudy[];
  compareA: string;
  setCompareA: (value: string) => void;
  compareB: string;
  setCompareB: (value: string) => void;
  sameModalityOnly: boolean;
  setSameModalityOnly: (value: boolean) => void;
  result: CompareBucket[] | null;
  onRunCompare: () => void;
  onBack: () => void;
  onViewSource: (documentId: string, pageNumber: number | null) => void;
}) {
  const studyA = candidates.find((study) => study.study_id === compareA);
  const pool = sameModalityOnly && studyA
    ? candidates.filter((study) => study.modality === studyA.modality)
    : candidates;
  const sorted = [...pool].sort((a, b) => (a.study_date || "").localeCompare(b.study_date || ""));

  return (
    <div className="workflow-view">
      <button type="button" className="quiet-button imaging-back" onClick={onBack}>
        <ArrowLeft size={14} /> Imaging
      </button>
      <h2>Compare Imaging Reports</h2>
      <p className="workflow-lead">
        Comparison is textual only — it shows what changed in the report&rsquo;s wording, not a
        medical judgment about whether anything improved or worsened.
      </p>

      {candidates.length < 2 ? (
        <ImagingCompareEmptyState />
      ) : (
        <>
          <label className="imaging-compare-scope">
            <input
              type="checkbox"
              checked={sameModalityOnly}
              onChange={(event) => setSameModalityOnly(event.target.checked)}
            />
            Only show studies of the same modality
          </label>

          <div className="imaging-compare-picker">
            <label>
              Earlier report
              <select value={compareA} onChange={(event) => setCompareA(event.target.value)}>
                <option value="">Select a study</option>
                {sorted.map((study) => (
                  <option key={study.study_id} value={study.study_id}>
                    {formatStudyDate(study.study_date)} — {MODALITY_LABELS[study.modality]}
                    {study.body_region ? ` (${study.body_region})` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Later report
              <select value={compareB} onChange={(event) => setCompareB(event.target.value)}>
                <option value="">Select a study</option>
                {sorted.map((study) => (
                  <option key={study.study_id} value={study.study_id}>
                    {formatStudyDate(study.study_date)} — {MODALITY_LABELS[study.modality]}
                    {study.body_region ? ` (${study.body_region})` : ""}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="forest-button" disabled={!compareA || !compareB} onClick={onRunCompare}>
              What changed?
            </button>
          </div>

          {result && (
            <div className="imaging-compare-results">
              {result.length === 0 && (
                <p className="imaging-empty-note">No comparable confirmed sections were found on both reports.</p>
              )}
              {result.map((bucket) => (
                <div key={bucket.section_type} className="imaging-compare-section">
                  <h3>{SECTION_LABELS[bucket.section_type] || bucket.section_type}</h3>
                  {/* Neutral, colorless treatment is intentional: this view must
                      never visually imply a clinical direction (better/worse). */}
                  <div className="imaging-compare-columns">
                    <div>
                      <strong>Present in both</strong>
                      {bucket.present_in_both.length === 0 && <small>None</small>}
                      <ul>
                        {bucket.present_in_both.map((sentence, index) => (
                          <li key={index}>{sentence}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <strong>Newly mentioned</strong>
                      {bucket.newly_mentioned.length === 0 && <small>None</small>}
                      <ul>
                        {bucket.newly_mentioned.map((sentence, index) => (
                          <li key={index}>{sentence}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <strong>No longer mentioned</strong>
                      {bucket.no_longer_mentioned.length === 0 && <small>None</small>}
                      <ul>
                        {bucket.no_longer_mentioned.map((sentence, index) => (
                          <li key={index}>{sentence}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <div className="imaging-compare-sources">
                    <button type="button" className="quiet-button" onClick={() => onViewSource(bucket.earlier.document_id, bucket.earlier.page_number)}>
                      View earlier source
                    </button>
                    <button type="button" className="quiet-button" onClick={() => onViewSource(bucket.later.document_id, bucket.later.page_number)}>
                      View later source
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
