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

// No action button here — the persistent toolbar above already has its own
// "Add imaging study" button; duplicating it here just puts two identically
// labeled buttons on screen at once for a first-time (zero-study) visit.
export function ImagingLandingEmptyState() {
  return (
    <EmptyState
      title="No imaging studies yet"
      body="Add a study and attach a radiology report PDF, or try one of the sample reports above to walk through extraction and verification."
    />
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
      body="Attach a text-based radiology PDF for the fastest read. Phone photos of reports also work, but vision reading can take longer."
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
      <p className="imaging-upload-tip">Accepted: PDF, PNG, JPG, WEBP · Prefer digital PDFs with selectable text</p>
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
