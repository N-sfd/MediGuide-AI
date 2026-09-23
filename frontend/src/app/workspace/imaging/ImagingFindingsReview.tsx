"use client";

import { Check, X } from "lucide-react";
import type { ImagingFinding } from "./imaging-types";

function statusClass(status: string): string {
  if (status === "confirmed") return "reviewed";
  if (status === "rejected") return "rejected";
  if (status === "could_not_read") return "could-not-read";
  return "unreviewed";
}

function statusLabel(status: string): string {
  return status.replaceAll("_", " ");
}

/**
 * Human verification for structured findings.
 * Only confirmed/corrected findings feed Overview downstream.
 */
export function ImagingFindingsReview({
  findings,
  drafts,
  setDrafts,
  reviewedIds,
  setReviewedIds,
  confirming,
  onConfirm,
}: {
  findings: ImagingFinding[];
  drafts: Record<string, string>;
  setDrafts: (value: Record<string, string>) => void;
  reviewedIds: Set<string>;
  setReviewedIds: (value: Set<string>) => void;
  confirming: boolean;
  onConfirm: (updates: { finding_id: string; confirmed_text: string; verification_status: string }[]) => void;
}) {
  if (findings.length === 0) {
    return (
      <p className="imaging-empty-note">
        No structured findings were extracted from Impression/Findings yet. Confirm report sections above first, or
        re-upload a clearer text PDF.
      </p>
    );
  }

  function markReviewed(id: string) {
    if (reviewedIds.has(id)) return;
    const next = new Set(reviewedIds);
    next.add(id);
    setReviewedIds(next);
  }

  const pending = findings.filter((f) => f.verification_status === "unverified");
  const confirmedCount = findings.filter((f) => f.verification_status === "confirmed").length;
  const rejectedCount = findings.filter((f) => f.verification_status === "rejected").length;
  const reviewedPending = pending.filter((f) => reviewedIds.has(f.finding_id));
  const hasReview = reviewedPending.length > 0;

  function confirmReviewedBatch() {
    onConfirm(
      reviewedPending.map((f) => ({
        finding_id: f.finding_id,
        confirmed_text: drafts[f.finding_id] ?? f.confirmed_text ?? f.original_text,
        verification_status: "confirmed",
      })),
    );
  }

  function confirmAllPending() {
    onConfirm(
      pending.map((f) => ({
        finding_id: f.finding_id,
        confirmed_text: drafts[f.finding_id] ?? f.confirmed_text ?? f.original_text,
        verification_status: "confirmed",
      })),
    );
  }

  return (
    <div className="imaging-findings-review">
      <div className="imaging-findings-review-head">
        <div>
          <p className="imaging-layer-label">Structured findings · Human verification</p>
          <p className="imaging-review-progress" role="status">
            {confirmedCount} confirmed
            {rejectedCount ? ` · ${rejectedCount} rejected` : ""}
            {pending.length ? ` · ${pending.length} remaining` : " · all reviewed"}
          </p>
        </div>
        {pending.length > 0 ? (
          <button
            type="button"
            className="quiet-button"
            disabled={confirming}
            onClick={confirmAllPending}
            title="Confirm every remaining finding with the current text"
          >
            Confirm all remaining
          </button>
        ) : null}
      </div>

      <p className="imaging-findings-hint">
        Edit any wording that looks incomplete, then confirm or reject. Confirmed findings power Overview and visit
        questions.
      </p>

      {findings.map((finding) => {
        const text = drafts[finding.finding_id] ?? finding.confirmed_text ?? finding.original_text;
        const status = finding.verification_status;
        const locked = status === "confirmed" || status === "rejected" || status === "could_not_read";
        return (
          <article
            key={finding.finding_id}
            className={`imaging-finding-review-card imaging-finding-card-${statusClass(status)}`}
          >
            <header>
              <strong>{finding.summary_label || "Finding"}</strong>
              <span className={`imaging-section-status imaging-section-status-${statusClass(status)}`}>
                {statusLabel(status)}
              </span>
            </header>
            {finding.original_text && text !== finding.original_text ? (
              <div className="imaging-original-extraction">
                <small>Original extraction</small>
                <p>{finding.original_text}</p>
              </div>
            ) : null}
            <textarea
              value={text}
              rows={Math.min(8, Math.max(3, Math.ceil(text.length / 90)))}
              disabled={locked}
              onFocus={() => markReviewed(finding.finding_id)}
              onChange={(event) => setDrafts({ ...drafts, [finding.finding_id]: event.target.value })}
            />
            <div className="imaging-finding-review-actions">
              {!locked ? (
                <>
                  <button
                    type="button"
                    className="forest-button imaging-finding-confirm-one"
                    disabled={confirming}
                    onClick={() => {
                      markReviewed(finding.finding_id);
                      onConfirm([
                        { finding_id: finding.finding_id, confirmed_text: text, verification_status: "confirmed" },
                      ]);
                    }}
                  >
                    <Check size={14} /> Confirm
                  </button>
                  <button
                    type="button"
                    className="quiet-button"
                    disabled={confirming}
                    onClick={() =>
                      onConfirm([{ finding_id: finding.finding_id, confirmed_text: text, verification_status: "rejected" }])
                    }
                  >
                    <X size={14} /> Reject
                  </button>
                  <button
                    type="button"
                    className="quiet-button"
                    disabled={confirming}
                    onClick={() =>
                      onConfirm([
                        { finding_id: finding.finding_id, confirmed_text: text, verification_status: "could_not_read" },
                      ])
                    }
                  >
                    Could not read
                  </button>
                </>
              ) : null}
              <span className="imaging-source-line">Page {finding.source_page}</span>
            </div>
          </article>
        );
      })}

      {pending.length > 0 ? (
        <div className="imaging-findings-sticky-bar">
          <span>
            {reviewedPending.length} of {pending.length} marked for batch confirm
          </span>
          <button
            type="button"
            className="forest-button imaging-confirm-button"
            disabled={!hasReview || confirming}
            onClick={confirmReviewedBatch}
          >
            <Check size={14} /> Confirm reviewed findings
          </button>
        </div>
      ) : (
        <p className="imaging-findings-done" role="status">
          Findings review complete — open Overview for summary and visit questions.
        </p>
      )}
    </div>
  );
}
