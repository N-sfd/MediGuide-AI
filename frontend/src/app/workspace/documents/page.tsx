"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DocumentsView } from "./DocumentsView";
import { useWorkspaceContext } from "../_state/WorkspaceStateProvider";

function DocumentsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loadRecentSessions, fileInput, runSyntheticDocumentDemo } = useWorkspaceContext();

  // `loadRecentSessions` is a plain closure recreated every provider
  // render, not a stable useCallback — depending on it here would
  // refetch on every render instead of once per page visit.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void loadRecentSessions(); }, []);

  useEffect(() => {
    const action = searchParams.get("action");
    if (!action) return;
    router.replace("/workspace/documents");
    if (action === "upload") {
      const timer = window.setTimeout(() => fileInput.current?.click(), 300);
      return () => window.clearTimeout(timer);
    }
    if (action === "sample") {
      const timer = window.setTimeout(() => void runSyntheticDocumentDemo(), 250);
      return () => window.clearTimeout(timer);
    }
    // Portfolio one-click: landing CTA loads the three-date synthetic walkthrough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return <DocumentsView />;
}

export default function DocumentsPage() {
  return (
    <Suspense fallback={null}>
      <DocumentsPageContent />
    </Suspense>
  );
}
