import { Aperture, Check, Layers, Loader2, ScanLine, Sparkles, Upload, Waves } from "lucide-react";
import type { ChangeEvent } from "react";
import type { Modality, ModalitySummary } from "./imaging-types";
import { MODALITY_ORDER, MODALITY_LABELS, formatStudyDate } from "./imaging-types";
import { ImagingLandingEmptyState } from "./ImagingEmptyState";

// One distinct lucide icon per modality — a licensed, already-vendored
// dependency — rather than any external/scraped imagery.
const MODALITY_ICONS: Record<Modality, typeof ScanLine> = {
  xray: ScanLine,
  ct: Layers,
  mri: Aperture,
  ultrasound: Waves,
  pet_ct: Sparkles,
};

export function ImagingLanding({
  modalities,
  loading,
  showAddForm,
  setShowAddForm,
  newModality,
  setNewModality,
  newBodyRegion,
  setNewBodyRegion,
  newStudyDate,
  setNewStudyDate,
  newInstitution,
  setNewInstitution,
  onCreateStudy,
  onSelectModality,
  onOpenHistory,
  onOpenCompare,
}: {
  modalities: ModalitySummary[];
  loading: string;
  showAddForm: boolean;
  setShowAddForm: (value: boolean) => void;
  newModality: Modality;
  setNewModality: (value: Modality) => void;
  newBodyRegion: string;
  setNewBodyRegion: (value: string) => void;
  newStudyDate: string;
  setNewStudyDate: (value: string) => void;
  newInstitution: string;
  setNewInstitution: (value: string) => void;
  onCreateStudy: () => void;
  onSelectModality: (modality: Modality) => void;
  onOpenHistory: () => void;
  onOpenCompare: () => void;
}) {
  const noStudiesAtAll = modalities.length > 0 && modalities.every((row) => row.study_count === 0);

  function onModalityChange(event: ChangeEvent<HTMLSelectElement>) {
    setNewModality(event.target.value as Modality);
  }

  return (
    <div className="workflow-view">
      <p className="eyebrow">IMAGING</p>
      <h2>Imaging</h2>
      <p className="workflow-lead">
        Organize imaging studies and understand the reports that accompany them. MediGuide
        displays and explains report text — it does not read or diagnose the scan itself.
      </p>

      <div className="imaging-toolbar">
        <button type="button" className="forest-button" onClick={() => setShowAddForm(true)}>
          <Upload size={15} /> Add imaging study
        </button>
        <button type="button" className="quiet-button" onClick={onOpenHistory}>
          Imaging history
        </button>
        <button type="button" className="quiet-button" onClick={onOpenCompare}>
          Compare reports
        </button>
      </div>

      {showAddForm && (
        <div className="imaging-add-form">
          <label>
            Modality
            <select value={newModality} onChange={onModalityChange}>
              {MODALITY_ORDER.map((modality) => (
                <option key={modality} value={modality}>
                  {MODALITY_LABELS[modality]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Body region
            <input
              value={newBodyRegion}
              onChange={(event) => setNewBodyRegion(event.target.value)}
              placeholder="e.g. Right knee"
            />
          </label>
          <label>
            Study date
            <input type="date" value={newStudyDate} onChange={(event) => setNewStudyDate(event.target.value)} />
          </label>
          <label>
            Institution (optional)
            <input value={newInstitution} onChange={(event) => setNewInstitution(event.target.value)} />
          </label>
          <div className="imaging-add-form-actions">
            <button type="button" className="quiet-button" onClick={() => setShowAddForm(false)}>
              Cancel
            </button>
            <button type="button" className="forest-button" disabled={Boolean(loading)} onClick={onCreateStudy}>
              {loading ? <Loader2 size={14} className="spin" /> : <Check size={14} />} Create study
            </button>
          </div>
        </div>
      )}

      {noStudiesAtAll ? (
        <ImagingLandingEmptyState onAddStudy={() => setShowAddForm(true)} />
      ) : (
        <>
          <h3 className="imaging-section-title">Explore by modality</h3>
          <div className="system-grid imaging-modality-grid">
            {modalities.map((row) => {
              const Icon = MODALITY_ICONS[row.modality];
              return (
                <button
                  key={row.modality}
                  type="button"
                  className="system-card imaging-modality-card"
                  onClick={() => onSelectModality(row.modality)}
                >
                  <Icon size={22} aria-hidden="true" />
                  <div>
                    <strong>{row.label}</strong>
                    <small>
                      {row.study_count} {row.study_count === 1 ? "study" : "studies"}
                    </small>
                    {row.latest_study_date && <small>Latest: {formatStudyDate(row.latest_study_date)}</small>}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
