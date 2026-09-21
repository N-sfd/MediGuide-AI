"use client";

import { Suspense } from "react";
import { HealthTimeline } from "../HealthTimeline";
import { useWorkspaceContext } from "../_state/WorkspaceStateProvider";
import { API_URL } from "../_state/workspace-shared";

function TimelinePageContent() {
  const { router, inspectDocument } = useWorkspaceContext();
  return (
    <HealthTimeline
      apiUrl={API_URL}
      onOpenDocument={(documentId, pageNumber, fieldId) => void inspectDocument(documentId, pageNumber || 1, fieldId)}
      onOpenImagingStudy={(studyId) => router.push(`/workspace/imaging/${studyId}`)}
    />
  );
}

export default function TimelinePage() {
  return (
    <Suspense fallback={null}>
      <TimelinePageContent />
    </Suspense>
  );
}
