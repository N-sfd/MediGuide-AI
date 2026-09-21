"use client";

import { Suspense, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { DocumentsView } from "../DocumentsView";
import { useWorkspaceContext } from "../../_state/WorkspaceStateProvider";

// A stable, bookmarkable/shareable URL for a single document — direct links,
// refreshes, and cross-links (Labs source-page drill-down, Timeline, Ask
// citations, global search) all resolve here instead of only working via
// in-session state. ?page=&field= extend it to a specific source location.
function DocumentDetailPageContent() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const pageParam = Number(searchParams.get("page")) || 1;
  const fieldParam = searchParams.get("field") || undefined;
  const { docState, inspectDocument, setDocSelectedPage, setHighlightedFieldId } = useWorkspaceContext();

  useEffect(() => {
    if (docState?.document_id !== params.id) {
      // Document actually changed (or nothing loaded yet) — full fetch.
      void inspectDocument(params.id, pageParam, fieldParam);
      return;
    }
    // Same document already loaded — inspectDocument always re-fetches
    // unconditionally, so for a page/field-only change within the same
    // document, just move the page/highlight directly instead of
    // re-requesting GET /api/documents/v2/{id} for no reason.
    setDocSelectedPage(pageParam);
    setHighlightedFieldId(fieldParam || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id, pageParam, fieldParam]);

  return <DocumentsView />;
}

export default function DocumentDetailPage() {
  return (
    <Suspense fallback={null}>
      <DocumentDetailPageContent />
    </Suspense>
  );
}
