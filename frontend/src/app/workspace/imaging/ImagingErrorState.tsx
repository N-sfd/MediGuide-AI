import { useState } from "react";
import { RefreshCw, X } from "lucide-react";

/** A dismissible top-of-view error banner — used for load failures that
 * aren't tied to a specific retryable action (e.g. "could not load
 * studies"). */
export function ImagingErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="service-error" role="alert">
      <div>
        <strong>Something needs attention</strong>
        <p>{message}</p>
      </div>
      <button type="button" className="quiet-button" onClick={onDismiss}>
        <X size={14} /> Dismiss
      </button>
    </div>
  );
}

/** The processing-failure case: report intake failed, but the original
 * upload is still safe, and the user can retry without re-uploading. The
 * technical detail (never shown by default) only ever contains the safe
 * `message` from the standardized error envelope — the backend never
 * serializes `technical_detail` to the client in the first place. */
export function ImagingProcessingFailedState({
  message,
  onRetry,
  onViewReport,
}: {
  message: string;
  onRetry: () => void;
  onViewReport?: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);
  return (
    <div className="service-error" role="alert">
      <div>
        <strong>We couldn&rsquo;t finish reading this imaging report.</strong>
        <p>Your original report is still available.</p>
        <button
          type="button"
          className="imaging-technical-toggle"
          onClick={() => setShowDetails((value) => !value)}
        >
          Technical details {showDetails ? "▴" : "▾"}
        </button>
        {showDetails && <p className="imaging-technical-detail">{message}</p>}
      </div>
      <div className="service-error-actions">
        <button type="button" onClick={onRetry}>
          <RefreshCw size={14} /> Retry processing
        </button>
        {onViewReport && (
          <button type="button" className="quiet-button" onClick={onViewReport}>
            View report
          </button>
        )}
      </div>
    </div>
  );
}
