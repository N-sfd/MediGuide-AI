import { useState, type ChangeEvent } from "react";
import { Upload } from "lucide-react";
import { EmptyState } from "../polish-ui";
import { DICOM_NOT_SUPPORTED_MESSAGE } from "./imaging-api";

/** Intercepts .dcm selection before any request is made — the raw
 * DICOM_NOT_YET_SUPPORTED backend error is a defensive fallback only; the
 * user should never see it, per item 12 ("don't present DICOM as broken"). */
function handleReportFileSelect(
  event: ChangeEvent<HTMLInputElement>,
  onAttach: (file: File) => void,
  onDicomSelected: () => void,
) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  if (file.name.toLowerCase().endsWith(".dcm")) {
    onDicomSelected();
    return;
  }
  onAttach(file);
}

export function ImagingLandingEmptyState({ onAddStudy }: { onAddStudy: () => void }) {
  return (
    <EmptyState
      title="No imaging studies yet"
      body="Add an imaging study and its report to organize your imaging history."
    >
      <button type="button" className="forest-button" onClick={onAddStudy}>
        <Upload size={15} /> Add imaging study
      </button>
    </EmptyState>
  );
}

export function ImagingNoReportEmptyState({ onAttach }: { onAttach: (file: File) => void }) {
  const [dicomNotice, setDicomNotice] = useState(false);

  if (dicomNotice) {
    return (
      <EmptyState title="DICOM viewing isn't available yet" body={DICOM_NOT_SUPPORTED_MESSAGE}>
        <label className="forest-button imaging-upload-label">
          <Upload size={15} /> Upload imaging report instead
          <input
            type="file"
            hidden
            accept=".pdf,.png,.jpg,.jpeg,.webp"
            onChange={(event) => handleReportFileSelect(event, onAttach, () => setDicomNotice(true))}
          />
        </label>
      </EmptyState>
    );
  }

  return (
    <EmptyState
      title="No report attached yet"
      body="Attach the radiology report for this study to extract and review its sections."
    >
      <label className="forest-button imaging-upload-label">
        <Upload size={15} /> Attach report
        <input
          type="file"
          hidden
          accept=".pdf,.png,.jpg,.jpeg,.webp"
          onChange={(event) => handleReportFileSelect(event, onAttach, () => setDicomNotice(true))}
        />
      </label>
    </EmptyState>
  );
}

export function ImagingListEmptyState() {
  return (
    <EmptyState title="No studies in this category yet" body="Add an imaging study to see it listed here." />
  );
}

export function ImagingHistoryEmptyState() {
  return (
    <EmptyState title="No imaging history yet" body="Studies you add will appear here in chronological order." />
  );
}

export function ImagingCompareEmptyState() {
  return (
    <EmptyState
      title="Not enough verified reports yet"
      body="Confirm the report sections on at least two studies to compare them."
    />
  );
}
