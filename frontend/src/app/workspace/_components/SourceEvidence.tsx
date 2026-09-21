"use client";

import type { LucideIcon } from "lucide-react";
import { ArrowUpRight, FileText, FlaskConical, Pill, ScanLine } from "lucide-react";
import { StatusChip, type StatusTone } from "../polish-ui";

export type SourceEvidenceType = "imaging" | "laboratory" | "medication" | "document" | "imaging_section";

export interface SourceEvidenceOpenPayload {
  type: SourceEvidenceType;
  documentId: string | null;
  pageNumber: number | null;
  fieldId: string | null;
  route: string;
}

export interface SourceEvidenceProps {
  type: SourceEvidenceType;
  title: string;
  date?: string | null;
  documentId: string | null;
  pageNumber: number | null;
  // Optional extension beyond the base spec — lets a single measurement
  // row (not just the whole lab-report entry) deep-link precisely, since
  // an entry-level page_number degrades to null for a multi-page report.
  fieldId?: string | null;
  verificationStatus: string;
  route: string;
  compact?: boolean;
  onOpen: (evidence: SourceEvidenceOpenPayload) => void;
}

const TYPE_ICONS: Record<SourceEvidenceType, LucideIcon> = {
  imaging: ScanLine,
  imaging_section: ScanLine,
  laboratory: FlaskConical,
  medication: Pill,
  document: FileText,
};

// Deliberately not Intl's default "August 12, 2026" (comma before year) —
// matches the accessible-label spec's exact form, "August 12 2026". The
// short "AUG 12" rail date elsewhere (HealthTimeline's formatEntryDate) is
// a separate formatter serving a different, space-constrained context.
function formatLongDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  const month = parsed.toLocaleDateString(undefined, { month: "long" });
  return `${month} ${parsed.getDate()} ${parsed.getFullYear()}`;
}

function buildAriaLabel(title: string, date: string | null | undefined, pageNumber: number | null): string {
  const parts = [title];
  const longDate = formatLongDate(date);
  if (longDate) parts.push(longDate);
  if (pageNumber) parts.push(`page ${pageNumber}`);
  return `View source: ${parts.join(", ")}`;
}

function verificationTone(status: string): StatusTone {
  const lowered = status.toLowerCase();
  if (lowered === "verified" || lowered === "confirmed") return "success";
  if (lowered === "unverified" || lowered === "needs_review") return "warning";
  return "neutral";
}

/**
 * Reusable "points back to its record" primitive. `onOpen` is a callback,
 * not internal navigation — the caller decides whether opening means
 * router.push(route), inspectDocument(documentId, pageNumber), or (for a
 * medication result, which has no dedicated detail route) opening the
 * existing medication drawer in place.
 */
export function SourceEvidence({
  type,
  title,
  date,
  documentId,
  pageNumber,
  fieldId = null,
  verificationStatus,
  route,
  compact = false,
  onOpen,
}: SourceEvidenceProps) {
  const Icon = TYPE_ICONS[type];
  const label = buildAriaLabel(title, date, pageNumber);
  const handleOpen = () => onOpen({ type, documentId, pageNumber, fieldId, route });

  if (compact) {
    return (
      <button type="button" className="source-evidence-compact" aria-label={label} onClick={handleOpen}>
        <Icon size={14} />
        <span className="source-evidence-compact-text">
          {title}
          {pageNumber ? ` · Page ${pageNumber}` : ""}
        </span>
        <ArrowUpRight size={12} />
      </button>
    );
  }

  return (
    <div className="source-evidence">
      <p className="eyebrow">SOURCE EVIDENCE</p>
      <div className="source-evidence-body">
        <Icon size={18} className="source-evidence-icon" aria-hidden="true" />
        <div className="source-evidence-meta">
          <strong>{title}{date ? ` — ${formatLongDate(date)}` : ""}</strong>
          {pageNumber ? <small>Page {pageNumber}</small> : null}
        </div>
        <StatusChip label={verificationStatus} tone={verificationTone(verificationStatus)} />
      </div>
      <button type="button" className="quiet-button" aria-label={label} onClick={handleOpen}>
        View source <ArrowUpRight size={14} />
      </button>
    </div>
  );
}
