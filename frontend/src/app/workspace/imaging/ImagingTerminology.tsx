import { useEffect, useId, useRef, useState } from "react";
import { BookOpen, Loader2, X } from "lucide-react";
import type { TermExplanation } from "./imaging-types";

export function ImagingTerminology({
  open,
  initialTerm,
  sourceExcerpt,
  answer,
  loading,
  onExplain,
  onClose,
}: {
  open: boolean;
  initialTerm: string;
  sourceExcerpt: string;
  answer: TermExplanation | null;
  loading: boolean;
  onExplain: (term: string) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const [term, setTerm] = useState(initialTerm);

  useEffect(() => {
    // Reset the editable term field whenever the drawer opens for a new term.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) setTerm(initialTerm);
  }, [open, initialTerm]);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
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
      <div
        className="drawer imaging-terminology-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="drawer-close" aria-label="Close" onClick={onClose}>
          <X size={18} />
        </button>
        <h2 id={titleId}>Understand this term</h2>

        <label className="imaging-visually-hidden" htmlFor="imaging-term-input">
          Term to explain
        </label>
        <div className="imaging-term-row">
          <input
            id="imaging-term-input"
            ref={inputRef}
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onExplain(term.trim());
            }}
            placeholder="e.g. joint effusion"
          />
          <button type="button" className="forest-button" disabled={!term.trim() || loading} onClick={() => onExplain(term.trim())}>
            {loading ? <Loader2 size={14} className="spin" /> : null} Explain
          </button>
        </div>

        {sourceExcerpt && (
          <div className="imaging-term-section">
            <p className="imaging-report-kicker">FROM YOUR REPORT</p>
            <blockquote className="imaging-term-excerpt">&ldquo;{sourceExcerpt}&rdquo;</blockquote>
          </div>
        )}

        {answer && (
          <div className="imaging-term-section">
            <p className="imaging-report-kicker">
              <BookOpen size={13} /> GENERAL EDUCATIONAL INFORMATION
            </p>
            <p className="imaging-term-answer-text">{answer.text}</p>
            <p className="imaging-note">
              This describes the terminology generally. It does not interpret your scan.
            </p>
            {answer.sources.length > 0 && (
              <div className="imaging-term-section">
                <p className="imaging-report-kicker">SOURCES</p>
                <ul className="imaging-term-sources">
                  {answer.sources.map((source, index) => (
                    <li key={index}>
                      {source.title}
                      {source.publisher ? ` — ${source.publisher}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
