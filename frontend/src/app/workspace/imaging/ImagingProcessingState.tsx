import { ProcessingChecklist, type ProcessStageId } from "../polish-ui";

const BACKEND_STAGE_TO_CHECKLIST: Record<string, ProcessStageId> = {
  validating: "validate",
  reading: "read",
  waiting_for_service: "extract",
  extracting: "extract",
  saving: "review",
};

/**
 * Reuses the existing ProcessingChecklist (already used by Documents) —
 * its 5-stage set (upload/validate/read/extract/review) already matches
 * the imaging report pipeline's real stages. `progress` is polled from
 * GET /api/imaging/studies/{id}/report/status (see imaging-api.ts's
 * fetchReportStatus) while the upload+extract+save request is still in
 * flight, so unlike the single-request read this component used to do,
 * "waiting_for_service" and live retry-attempt counts are now real signals
 * from the backend's ProcessingJob row, not a fabricated animation.
 */
export function ImagingProcessingState({
  progress,
}: {
  progress: { stage: string; retryAttempt: number; retryMax: number } | null;
}) {
  const activeStage = progress ? BACKEND_STAGE_TO_CHECKLIST[progress.stage] ?? "read" : "read";
  const waiting = progress?.stage === "waiting_for_service";
  return (
    <ProcessingChecklist
      activeStage={activeStage}
      title="Processing imaging report"
      waitingMessage={waiting ? "Document processing is starting up." : undefined}
      attempt={waiting ? progress?.retryAttempt : undefined}
      maxAttempts={waiting ? progress?.retryMax : undefined}
    />
  );
}
