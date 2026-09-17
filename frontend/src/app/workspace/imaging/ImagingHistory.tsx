import { ArrowLeft, ChevronRight, GitCompare } from "lucide-react";
import { MODALITY_LABELS, MODALITY_ORDER, formatStudyDate, type ImagingStudy, type ReportSection } from "./imaging-types";
import { deriveReportState } from "./imaging-types";
import { ImagingStatusChip } from "./ImagingStatusChip";
import { ImagingHistoryEmptyState } from "./ImagingEmptyState";

export function ImagingHistory({
  studies,
  modalityFilter,
  setModalityFilter,
  regionFilter,
  setRegionFilter,
  onApplyFilters,
  onBack,
  onOpenStudy,
  onCompareStudy,
}: {
  studies: ImagingStudy[];
  modalityFilter: string;
  setModalityFilter: (value: string) => void;
  regionFilter: string;
  setRegionFilter: (value: string) => void;
  onApplyFilters: () => void;
  onBack: () => void;
  onOpenStudy: (study: ImagingStudy) => void;
  onCompareStudy: (study: ImagingStudy) => void;
}) {
  const emptySections: ReportSection[] = [];
  const byYear = new Map<string, ImagingStudy[]>();
  for (const study of studies) {
    const year = study.study_date ? study.study_date.slice(0, 4) : "Undated";
    byYear.set(year, [...(byYear.get(year) || []), study]);
  }
  const years = [...byYear.keys()].sort((a, b) => b.localeCompare(a));

  const verifiedByModality = new Map<string, number>();
  for (const study of studies) {
    if (study.verification_status === "verified" && study.report_document_id) {
      verifiedByModality.set(study.modality, (verifiedByModality.get(study.modality) || 0) + 1);
    }
  }

  return (
    <div className="workflow-view">
      <button type="button" className="quiet-button imaging-back" onClick={onBack}>
        <ArrowLeft size={14} /> Imaging
      </button>
      <h2>Imaging History</h2>

      <div className="imaging-filters">
        <label htmlFor="imaging-history-modality" className="imaging-visually-hidden">
          Filter by modality
        </label>
        <select id="imaging-history-modality" value={modalityFilter} onChange={(event) => setModalityFilter(event.target.value)}>
          <option value="">All modalities</option>
          {MODALITY_ORDER.map((modality) => (
            <option key={modality} value={modality}>
              {MODALITY_LABELS[modality]}
            </option>
          ))}
        </select>
        <label htmlFor="imaging-history-region" className="imaging-visually-hidden">
          Filter by body region
        </label>
        <input
          id="imaging-history-region"
          placeholder="Filter by body region"
          value={regionFilter}
          onChange={(event) => setRegionFilter(event.target.value)}
        />
        <button type="button" className="quiet-button" onClick={onApplyFilters}>
          Apply filters
        </button>
      </div>

      {years.length === 0 ? (
        <ImagingHistoryEmptyState />
      ) : (
        years.map((year) => (
          <div key={year} className="imaging-history-year">
            <h3>{year}</h3>
            <div className="source-list imaging-study-list">
              {(byYear.get(year) || [])
                .sort((a, b) => (b.study_date || "").localeCompare(a.study_date || ""))
                .map((study) => {
                  const canCompare = (verifiedByModality.get(study.modality) || 0) >= 2 && study.verification_status === "verified";
                  return (
                    <div key={study.study_id} className="imaging-history-row">
                      <button type="button" onClick={() => onOpenStudy(study)}>
                        <span>
                          <ChevronRight size={16} aria-hidden="true" />
                        </span>
                        <div>
                          <strong>
                            {MODALITY_LABELS[study.modality]}
                            {study.body_region ? ` · ${study.body_region}` : ""}
                          </strong>
                          <small>
                            {formatStudyDate(study.study_date)} —{" "}
                            <ImagingStatusChip state={deriveReportState(study, emptySections, null)} />
                          </small>
                        </div>
                      </button>
                      {canCompare && (
                        <button
                          type="button"
                          className="quiet-button imaging-history-compare"
                          onClick={() => onCompareStudy(study)}
                        >
                          <GitCompare size={14} /> Compare with another study
                        </button>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
