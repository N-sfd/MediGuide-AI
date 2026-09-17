import { ArrowLeft, ChevronRight } from "lucide-react";
import { MODALITY_LABELS, formatStudyDate, type ImagingStudy, type Modality, type ReportSection } from "./imaging-types";
import { deriveReportState } from "./imaging-types";
import { ImagingStatusChip } from "./ImagingStatusChip";
import { ImagingListEmptyState } from "./ImagingEmptyState";

export function ImagingStudyList({
  modality,
  studies,
  search,
  setSearch,
  onBack,
  onOpenStudy,
}: {
  modality: Modality;
  studies: ImagingStudy[];
  search: string;
  setSearch: (value: string) => void;
  onBack: () => void;
  onOpenStudy: (study: ImagingStudy) => void;
}) {
  const sorted = [...studies].sort((a, b) => (b.study_date || "").localeCompare(a.study_date || ""));
  const emptySections: ReportSection[] = [];

  return (
    <div className="workflow-view">
      <button type="button" className="quiet-button imaging-back" onClick={onBack}>
        <ArrowLeft size={14} /> Imaging
      </button>
      <h2>{MODALITY_LABELS[modality]} Studies</h2>
      <input
        className="imaging-search"
        placeholder="Search studies..."
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        aria-label="Search studies by description, body region, or date"
      />

      {sorted.length === 0 ? (
        <ImagingListEmptyState />
      ) : (
        <div className="source-list imaging-study-list">
          {sorted.map((study) => (
            <button key={study.study_id} type="button" onClick={() => onOpenStudy(study)}>
              <span>
                <ChevronRight size={16} aria-hidden="true" />
              </span>
              <div>
                <strong>{formatStudyDate(study.study_date)}</strong>
                <b>
                  {MODALITY_LABELS[study.modality]}
                  {study.body_region ? ` — ${study.body_region}` : ""}
                </b>
                <small>
                  <ImagingStatusChip state={deriveReportState(study, emptySections, null)} />
                </small>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
