"use client";

import { Check } from "lucide-react";
import type { ImagingFinding } from "./imaging-types";

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
  const actionable = findings.filter((f) => f.verification_status === "unverified" || f.verification_status === "confirmed");
  if (findings.length === 0) {
    return <p className="imaging-empty-note">No structured findings were extracted from Impression/Findings yet.</p>;
  }

  function markReviewed(id: string) {
    if (reviewedIds.has(id)) return;
    const next = new Set(reviewedIds);
    next.add(id);
    setReviewedIds(next);
  }

  const pending = findings.filter((f) => f.verification_status === "unverified");
  const hasReview = pending.some((f) => reviewedIds.has(f.finding_id));

  return (
    <div className="imaging-findings-review">
      <p className="imaging-layer-label">Structured findings · Human verification</p>
      <p className="imaging-review-progress" role="status">
        {findings.filter((f) => f.verification_status === "confirmed").length} confirmed · {pending.length} unverified
      </p>

      {findings.map((finding) => {
        const text = drafts[finding.finding_id] ?? finding.confirmed_text ?? finding.original_text;
        const confirmed = finding.verification_status === "confirmed";
        return (
          <article key={finding.finding_id} className="imaging-finding-review-card">
            <header>
              <strong>{finding.summary_label}</strong>
              <span className={`imaging-section-status imaging-section-status-${confirmed ? "reviewed" : "unreviewed"}`}>
                {finding.verification_status.replaceAll("_", " ")}
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
              disabled={confirmed || finding.verification_status === "rejected"}
              onFocus={() => markReviewed(finding.finding_id)}
              onChange={(event) => setDrafts({ ...drafts, [finding.finding_id]: event.target.value })}
            />
            <div className="imaging-finding-review-actions">
              {!confirmed && finding.verification_status !== "rejected" ? (
                <>
                  <button
                    type="button"
                    className="quiet-button"
                    onClick={() => {
                      markReviewed(finding.finding_id);
                      onConfirm([{ finding_id: finding.finding_id, confirmed_text: text, verification_status: "confirmed" }]);
                    }}
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    className="quiet-button"
                    onClick={() =>
                      onConfirm([{ finding_id: finding.finding_id, confirmed_text: text, verification_status: "rejected" }])
                    }
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    className="quiet-button"
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
        <button
          type="button"
          className="forest-button imaging-confirm-button"
          disabled={!hasReview || confirming}
          onClick={() =>
            onConfirm(
              actionable
                .filter((f) => reviewedIds.has(f.finding_id) && f.verification_status === "unverified")
                .map((f) => ({
                  finding_id: f.finding_id,
                  confirmed_text: drafts[f.finding_id] ?? f.confirmed_text,
                  verification_status: "confirmed",
                })),
            )
          }
        >
          <Check size={14} /> Confirm reviewed findings
        </button>
      ) : null}
    </div>
  );
}
