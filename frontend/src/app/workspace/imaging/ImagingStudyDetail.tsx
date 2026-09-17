import { useEffect, useState } from "react";
import { ArrowLeft, GitCompare, History, Maximize2, Minimize2, ScanLine, Trash2 } from "lucide-react";
import { MODALITY_LABELS, formatStudyDate, type ImagingStudy, type ReportSection, deriveReportState } from "./imaging-types";
import { ImagingStatusChip } from "./ImagingStatusChip";
import { ImagingReportPanel } from "./ImagingReportPanel";
import { ImagingNoReportEmptyState } from "./ImagingEmptyState";
import { ImagingProcessingState } from "./ImagingProcessingState";
import { ImagingProcessingFailedState } from "./ImagingErrorState";
import { reportPagePreviewUrl } from "./imaging-api";

export function ImagingStudyDetail({
  apiUrl,
  study,
  sections,
  editedSections,
  setEditedSections,
  reviewedTypes,
  setReviewedTypes,
  selectedPage,
  setSelectedPage,
  viewerExpanded,
  setViewerExpanded,
  transientStatus,
  processingError,
  confirming,
  onBack,
  onOpenHistory,
  onOpenCompare,
  onUploadReport,
  onRetryUpload,
  onConfirm,
  onRequestDelete,
  onOpenTerminology,
}: {
  apiUrl: string;
  study: ImagingStudy;
  sections: ReportSection[];
  editedSections: Record<string, string>;
  setEditedSections: (value: Record<string, string>) => void;
  reviewedTypes: Set<string>;
  setReviewedTypes: (value: Set<string>) => void;
  selectedPage: number;
  setSelectedPage: (value: number) => void;
  viewerExpanded: boolean;
  setViewerExpanded: (value: boolean) => void;
  transientStatus: "processing" | "failed" | null;
  processingError: string;
  confirming: boolean;
  onBack: () => void;
  onOpenHistory: () => void;
  onOpenCompare: () => void;
  onUploadReport: (file: File) => void;
  onRetryUpload: () => void;
  onConfirm: () => void;
  onRequestDelete: () => void;
  onOpenTerminology: (term: string, sourceExcerpt: string) => void;
}) {
  const state = deriveReportState(study, sections, transientStatus);
  const previewUrl = study.report_document_id ? reportPagePreviewUrl(apiUrl, study.study_id, selectedPage) : "";

  // The backend has no page-count endpoint to check bounds against before
  // requesting a preview, so "does this page have a real preview" can only
  // be known by trying to load it — onError swaps in the same honest
  // fallback text used for "no report at all," rather than ever leaving a
  // broken-image icon or a fake highlight over a page that doesn't exist.
  const [previewFailed, setPreviewFailed] = useState(false);
  useEffect(() => {
    setPreviewFailed(false);
  }, [previewUrl]);
  const showPreviewImage = Boolean(previewUrl) && !previewFailed;

  function viewSourcePage(pageNumber: number) {
    setSelectedPage(pageNumber);
    setViewerExpanded(true);
  }

  return (
    <div className="workflow-view">
      <button type="button" className="quiet-button imaging-back" onClick={onBack}>
        <ArrowLeft size={14} /> Imaging / {MODALITY_LABELS[study.modality]}
      </button>

      <div className="document-meta imaging-study-meta">
        <ScanLine size={18} aria-hidden="true" />
        <span>
          <strong>
            {MODALITY_LABELS[study.modality]}
            {study.body_region ? ` — ${study.body_region}` : ""}
          </strong>
          <small>{formatStudyDate(study.study_date)}</small>
        </span>
        <ImagingStatusChip state={state} />
      </div>

      <div className="imaging-detail-actions">
        <button type="button" className="quiet-button" onClick={onOpenHistory}>
          <History size={14} /> View history
        </button>
        <button type="button" className="quiet-button" onClick={onOpenCompare}>
          <GitCompare size={14} /> Compare
        </button>
        <button type="button" className="quiet-button imaging-delete" onClick={onRequestDelete}>
          <Trash2 size={14} /> Delete study
        </button>
      </div>

      {transientStatus === "processing" && <ImagingProcessingState />}
      {transientStatus === "failed" && (
        <ImagingProcessingFailedState message={processingError} onRetry={onRetryUpload} />
      )}

      {!study.report_document_id && !transientStatus ? (
        <ImagingNoReportEmptyState onAttach={onUploadReport} />
      ) : study.report_document_id && !transientStatus ? (
        viewerExpanded ? (
          <div className="imaging-viewer-expanded">
            <button type="button" className="quiet-button imaging-back" onClick={() => setViewerExpanded(false)}>
              <Minimize2 size={14} /> Back to report section
            </button>
            <div className="document-preview imaging-viewer imaging-viewer-full">
              {showPreviewImage ? (
                <img
                  src={previewUrl}
                  alt={`Page ${selectedPage} of the imaging report`}
                  onError={() => setPreviewFailed(true)}
                />
              ) : (
                <span>No preview is available for this page.</span>
              )}
            </div>
          </div>
        ) : (
          <div className="extraction-grid imaging-detail-grid">
            <div className="document-preview imaging-viewer">
              {showPreviewImage ? (
                <img
                  src={previewUrl}
                  alt={`Page ${selectedPage} of the imaging report`}
                  onError={() => setPreviewFailed(true)}
                />
              ) : (
                <span>No preview is available for this page.</span>
              )}
              <div className="imaging-page-nav">
                <button type="button" className="quiet-button" disabled={selectedPage <= 1} onClick={() => setSelectedPage(selectedPage - 1)}>
                  Previous page
                </button>
                <span>Page {selectedPage}</span>
                <button type="button" className="quiet-button" onClick={() => setSelectedPage(selectedPage + 1)}>
                  Next page
                </button>
                <button
                  type="button"
                  className="quiet-button"
                  aria-label="View report page full-screen"
                  onClick={() => setViewerExpanded(true)}
                >
                  <Maximize2 size={14} />
                </button>
              </div>
            </div>

            <ImagingReportPanel
              study={study}
              sections={sections}
              editedSections={editedSections}
              setEditedSections={setEditedSections}
              reviewedTypes={reviewedTypes}
              setReviewedTypes={setReviewedTypes}
              onConfirm={onConfirm}
              confirming={confirming}
              onViewSourcePage={viewSourcePage}
              onOpenTerminology={onOpenTerminology}
            />
          </div>
        )
      ) : null}
    </div>
  );
}
