"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, FileText, FlaskConical, Pill, ScanLine, X } from "lucide-react";
import { fetchWithTimeout, parseApiError } from "../../lib/api-error";
import { EmptyState } from "./polish-ui";

type TimelineCategory = "imaging" | "laboratory" | "medication" | "document";

interface TimelineLink {
  type: "imaging_study" | "document" | "medication";
  id: string;
}

interface TimelineEntry {
  entry_id: string;
  date: string | null;
  category: TimelineCategory;
  title: string;
  subtitle: string;
  verification_label: string;
  verified: boolean;
  link: TimelineLink;
}

interface MedicationRecord {
  medication_id: string;
  medication_name: string;
  strength: string;
  form: string;
  instructions: string;
  quantity: string;
  prescriber_or_pharmacy: string;
  source: "upload" | "typed";
  other_visible_text: string;
}

const CATEGORY_ICONS: Record<TimelineCategory, typeof ScanLine> = {
  imaging: ScanLine,
  laboratory: FlaskConical,
  medication: Pill,
  document: FileText,
};

const CATEGORY_LABELS: Record<TimelineCategory, string> = {
  imaging: "Imaging",
  laboratory: "Laboratory",
  medication: "Medication",
  document: "Document",
};

const ACTION_LABELS: Record<TimelineCategory, string> = {
  imaging: "View study",
  laboratory: "View results",
  medication: "View medication",
  document: "View document",
};

function formatEntryDate(value: string | null): string {
  if (!value) return "Undated";
  try {
    return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
      month: "short",
      day: "2-digit",
    }).toUpperCase();
  } catch {
    return value;
  }
}

export function HealthTimeline({
  apiUrl,
  onOpenDocument,
  onOpenImagingStudy,
}: {
  apiUrl: string;
  onOpenDocument: (documentId: string) => void;
  onOpenImagingStudy: (studyId: string) => void;
}) {
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState("Loading your health timeline...");
  const [error, setError] = useState("");

  const [medicationDrawerId, setMedicationDrawerId] = useState<string | null>(null);
  const [medicationRecord, setMedicationRecord] = useState<MedicationRecord | null>(null);
  const [medicationLoading, setMedicationLoading] = useState(false);

  async function loadTimeline() {
    if (!apiUrl) return;
    setError("");
    setLoading("Loading your health timeline...");
    try {
      const response = await fetchWithTimeout(`${apiUrl}/api/timeline`);
      if (!response.ok) {
        const apiError = await parseApiError(response, "Could not load your health timeline.");
        throw new Error(apiError.message);
      }
      const data = await response.json();
      setEntries(data.entries || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your health timeline.");
    } finally {
      setLoading("");
    }
  }

  useEffect(() => {
    // Fetch-on-mount from the backend; not a derivable render-time value.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadTimeline();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiUrl]);

  async function openMedicationDrawer(medicationId: string) {
    setMedicationDrawerId(medicationId);
    setMedicationRecord(null);
    setMedicationLoading(true);
    try {
      const response = await fetchWithTimeout(`${apiUrl}/api/medications/v2/${medicationId}/record`);
      if (!response.ok) throw new Error("Could not load this medication record.");
      setMedicationRecord(await response.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load this medication record.");
      setMedicationDrawerId(null);
    } finally {
      setMedicationLoading(false);
    }
  }

  function handleAction(entry: TimelineEntry) {
    if (entry.link.type === "imaging_study") onOpenImagingStudy(entry.link.id);
    else if (entry.link.type === "document") onOpenDocument(entry.link.id);
    else if (entry.link.type === "medication") void openMedicationDrawer(entry.link.id);
  }

  const byYear = new Map<string, TimelineEntry[]>();
  for (const entry of entries) {
    const year = entry.date ? entry.date.slice(0, 4) : "Undated";
    byYear.set(year, [...(byYear.get(year) || []), entry]);
  }
  const years = [...byYear.keys()].sort((a, b) => b.localeCompare(a));

  return (
    <div className="workflow-view">
      <p className="eyebrow">HEALTH TIMELINE</p>
      <h2>Health Timeline</h2>
      <p className="workflow-lead">
        Everything you&rsquo;ve confirmed — labs, imaging, medications, and documents — in one
        chronological, traceable view. Every entry links back to its original source.
      </p>

      {error && (
        <div className="service-error" role="alert">
          <div>
            <strong>Something needs attention</strong>
            <p>{error}</p>
          </div>
          <button type="button" className="quiet-button" onClick={() => setError("")}>
            <X size={14} /> Dismiss
          </button>
        </div>
      )}

      {loading && !entries.length ? (
        <p className="imaging-empty-note">{loading}</p>
      ) : entries.length === 0 ? (
        <EmptyState
          title="Nothing confirmed yet"
          body="Once you confirm a lab report, imaging report, medication, or document, it will appear here in order."
        />
      ) : (
        years.map((year) => (
          <div key={year} className="imaging-history-year">
            <h3>{year}</h3>
            <div className="timeline-entries">
              {(byYear.get(year) || []).map((entry) => {
                const Icon = CATEGORY_ICONS[entry.category];
                return (
                  <div key={entry.entry_id} className="timeline-entry">
                    <div className="timeline-entry-date">{formatEntryDate(entry.date)}</div>
                    <div className="timeline-entry-body">
                      <div className="timeline-entry-category">
                        <Icon size={14} aria-hidden="true" /> {CATEGORY_LABELS[entry.category]}
                      </div>
                      <strong>{entry.title}</strong>
                      {entry.subtitle && <p className="timeline-entry-subtitle">{entry.subtitle}</p>}
                      <span className="lab-verified">
                        <Check size={13} /> {entry.verification_label}
                      </span>
                    </div>
                    <button type="button" className="quiet-button timeline-entry-action" onClick={() => handleAction(entry)}>
                      {ACTION_LABELS[entry.category]}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      <MedicationDrawer
        open={medicationDrawerId !== null}
        record={medicationRecord}
        loading={medicationLoading}
        onClose={() => setMedicationDrawerId(null)}
      />
    </div>
  );
}

function MedicationDrawer({
  open,
  record,
  loading,
  onClose,
}: {
  open: boolean;
  record: MedicationRecord | null;
  loading: boolean;
  onClose: () => void;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previouslyFocused.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="drawer-backdrop" onClick={onClose} role="presentation">
      <div className="drawer" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(event) => event.stopPropagation()}>
        <button ref={closeRef} type="button" className="drawer-close" aria-label="Close" onClick={onClose}>
          <X size={18} />
        </button>
        <h2 id={titleId}>Medication</h2>
        {loading && <p className="imaging-empty-note">Loading...</p>}
        {record && (
          <>
            <div className="imaging-original-extraction">
              <small>Medication name</small>
              <p>{record.medication_name || "Not recorded"}</p>
            </div>
            {record.strength && (
              <div className="imaging-original-extraction">
                <small>Strength</small>
                <p>{record.strength}</p>
              </div>
            )}
            {record.form && (
              <div className="imaging-original-extraction">
                <small>Form</small>
                <p>{record.form}</p>
              </div>
            )}
            {record.instructions && (
              <div className="imaging-original-extraction">
                <small>Directions for use</small>
                <p>{record.instructions}</p>
              </div>
            )}
            {record.quantity && (
              <div className="imaging-original-extraction">
                <small>Quantity / refills</small>
                <p>{record.quantity}</p>
              </div>
            )}
            {record.prescriber_or_pharmacy && (
              <div className="imaging-original-extraction">
                <small>Prescriber or pharmacy</small>
                <p>{record.prescriber_or_pharmacy}</p>
              </div>
            )}
            <p className="imaging-note">
              This is the information you confirmed at the time. The original label image is not
              kept long-term, so it isn&rsquo;t shown here.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
