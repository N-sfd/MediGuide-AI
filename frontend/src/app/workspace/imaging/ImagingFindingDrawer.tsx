"use client";

import { useEffect, useId, useRef } from "react";
import { BookOpen, FileText, Loader2, X } from "lucide-react";
import type { FindingExplanation, ImagingFinding } from "./imaging-types";

export function ImagingFindingDrawer({
  open,
  finding,
  explanation,
  loading,
  onClose,
  onExplain,
  onViewSource,
  onRetry,
}: {
  open: boolean;
  finding: ImagingFinding | null;
  explanation: FindingExplanation | null;
  loading: boolean;
  onClose: () => void;
  onExplain: () => void;
  onViewSource: () => void;
  onRetry: () => void;
}) {
  const titleId = useId();
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previouslyFocused.current?.focus();
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open && finding && !explanation && !loading) onExplain();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, finding?.finding_id]);

  if (!open || !finding) return null;

  return (
    <div className="drawer-backdrop" onClick={onClose} role="presentation">
      <aside
        className="drawer imaging-finding-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="drawer-close" aria-label="Close" onClick={onClose}>
          <X size={18} />
        </button>
        <p className="imaging-layer-label">Understand this finding</p>
        <h2 id={titleId}>{finding.summary_label}</h2>

        <section className="imaging-layer imaging-layer-report nested">
          <p className="imaging-layer-label">
            <FileText size={13} /> From your report
          </p>
          <blockquote>&ldquo;{finding.finding_text}&rdquo;</blockquote>
          <p className="imaging-source-attribution">
            Source · Page {finding.source_page} · {finding.verification_status === "confirmed" ? "Verified ✓" : finding.verification_status}
          </p>
          <button type="button" className="quiet-button" onClick={onViewSource}>
            View source
          </button>
        </section>

        <section className="imaging-layer imaging-layer-edu nested">
          <p className="imaging-layer-label">
            <BookOpen size={13} /> General health information
          </p>
          {loading ? (
            <p className="imaging-empty-note">
              <Loader2 size={14} className="spin" /> Loading educational explanation…
            </p>
          ) : explanation && !explanation.education_available ? (
            <div>
              <p>{explanation.answer_markdown || "Educational explanation is temporarily unavailable."}</p>
              <button type="button" className="quiet-button" onClick={onRetry}>
                Try again
              </button>
            </div>
          ) : explanation ? (
            <div className="imaging-explain-markdown">
              {explanation.answer_markdown.split("\n").map((line, index) => (
                <p key={`${index}-${line.slice(0, 12)}`}>{line || "\u00a0"}</p>
              ))}
              {explanation.sources.length > 0 ? (
                <div className="imaging-term-section">
                  <p className="imaging-layer-label">Sources</p>
                  <ul className="imaging-term-sources">
                    {explanation.sources.map((source) => (
                      <li key={source.citation_number}>
                        [{source.citation_number}] {source.title}
                        {source.publisher ? ` — ${source.publisher}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      </aside>
    </div>
  );
}
