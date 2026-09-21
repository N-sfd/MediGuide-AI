"use client";

import { useParams } from "next/navigation";
import { ImagingWorkspace } from "../ImagingWorkspace";
import { useWorkspaceContext } from "../../_state/WorkspaceStateProvider";
import { API_URL } from "../../_state/workspace-shared";

// Path-based counterpart to /workspace/imaging?openStudy=:id (kept working
// too, for one release, so no in-flight bookmark breaks) — matches the
// /workspace/documents/:id pattern for a stable, bookmarkable study URL.
export default function ImagingStudyDetailPage() {
  const params = useParams<{ id: string }>();
  const { pushToast } = useWorkspaceContext();
  return <ImagingWorkspace apiUrl={API_URL} pushToast={pushToast} openStudyId={params.id} />;
}
