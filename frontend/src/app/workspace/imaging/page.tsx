"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ImagingWorkspace } from "./ImagingWorkspace";
import { useWorkspaceContext } from "../_state/WorkspaceStateProvider";
import { API_URL } from "../_state/workspace-shared";

function ImagingPageContent() {
  const { pushToast } = useWorkspaceContext();
  const searchParams = useSearchParams();
  const openStudyId = searchParams.get("openStudy");
  return <ImagingWorkspace apiUrl={API_URL} pushToast={pushToast} openStudyId={openStudyId} />;
}

export default function ImagingPage() {
  return (
    <Suspense fallback={null}>
      <ImagingPageContent />
    </Suspense>
  );
}
