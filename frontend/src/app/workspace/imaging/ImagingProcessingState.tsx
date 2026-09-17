import { ProcessingChecklist } from "../polish-ui";

/**
 * Reuses the existing ProcessingChecklist (already used by Documents) —
 * its 5-stage set (upload/validate/read/extract/review) already matches
 * the imaging report pipeline's real stages. The upload+extract+save
 * sequence happens in a single request/response with no polling endpoint
 * (unlike Documents' separate upload/process/status calls), so there is no
 * real-time signal to distinguish "reading" from "extracting" from
 * "saving" mid-request — showing a fixed "read" stage for the whole wait
 * is the honest representation available today, not a fabricated
 * percentage or fake step-by-step animation.
 */
export function ImagingProcessingState() {
  return <ProcessingChecklist activeStage="read" title="Processing imaging report" />;
}
