"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Check, Circle, X } from "lucide-react";

export type ToastTone = "success" | "info" | "error";

export type ToastItem = {
  id: string;
  message: string;
  tone: ToastTone;
};

export function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  if (!toasts.length) return null;
  return (
    <div className="toast-stack" aria-live="polite" aria-relevant="additions">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast-item toast-${toast.tone}`} role="status">
          <span>{toast.message}</span>
          <button type="button" className="toast-dismiss" aria-label="Dismiss" onClick={() => onDismiss(toast.id)}>
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="drawer-backdrop confirm-backdrop" onClick={onCancel} role="presentation">
      <div
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId}>{title}</h2>
        <p>{body}</p>
        <div className="confirm-dialog-actions">
          <button type="button" className="quiet-button" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={destructive ? "forest-button destructive-confirm" : "forest-button"}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export type ProcessStageId = "upload" | "validate" | "read" | "extract" | "review";

const PROCESS_STAGES: { id: ProcessStageId; label: string }[] = [
  { id: "upload", label: "Upload complete" },
  { id: "validate", label: "File validated" },
  { id: "read", label: "Reading document" },
  { id: "extract", label: "Extracting information" },
  { id: "review", label: "Preparing review" },
];

export function ProcessingChecklist({
  activeStage,
  failed = false,
  title = "Processing your document",
}: {
  activeStage: ProcessStageId | null;
  failed?: boolean;
  title?: string;
}) {
  if (!activeStage) return null;
  const order = PROCESS_STAGES.map((stage) => stage.id);
  const activeIndex = order.indexOf(activeStage);

  return (
    <div className="process-checklist" role="status" aria-live="polite">
      <strong>{failed ? "We couldn't finish reading this document." : title}</strong>
      <ol>
        {PROCESS_STAGES.map((stage, index) => {
          const done = !failed && index < activeIndex;
          const current = index === activeIndex;
          return (
            <li key={stage.id} className={done ? "done" : current ? (failed ? "failed" : "current") : "pending"}>
              {done ? <Check size={14} /> : current && failed ? <X size={14} /> : <Circle size={14} />}
              <span>{stage.label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function EmptyState({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state-panel">
      <strong>{title}</strong>
      <p>{body}</p>
      {children ? <div className="empty-state-actions">{children}</div> : null}
    </div>
  );
}

export function mapStatusToProcessStage(status: string, loading: string): ProcessStageId | null {
  const lower = `${status} ${loading}`.toLowerCase();
  if (!loading && !status) return null;
  if (lower.includes("upload")) return "upload";
  if (lower.includes("valid") || lower.includes("preparing page") || lower.includes("queued")) return "validate";
  if (lower.includes("render") || lower.includes("reading") || lower.includes("scanned")) return "read";
  if (lower.includes("extract")) return "extract";
  if (lower.includes("review") || lower.includes("complete")) return "review";
  if (loading) return "read";
  return null;
}

export const FRIENDLY_HEALTH_LABELS: Record<string, string> = {
  fastapi: "Document processing",
  ollama: "Educational explanations",
  text_model: "Educational explanations",
  vision_model: "Document preview",
  embedding_model: "Educational explanations",
  vector_store: "Educational explanations",
  database: "Document processing",
  whisper: "Voice transcription",
  piper: "Voice playback",
  translation_model: "Translation",
  n8n: "Document processing",
  document_processing: "Document processing",
  document_preview: "Document preview",
};

export function friendlyHealthLabel(key: string, fallback?: string) {
  return FRIENDLY_HEALTH_LABELS[key] || fallback || key;
}

export function friendlyComponentStatus(status: string, detail = "") {
  if (status === "ready") return "Available";
  if ((detail || "").toLowerCase().includes("degraded") || status === "degraded") return "Limited";
  return "Unavailable";
}
