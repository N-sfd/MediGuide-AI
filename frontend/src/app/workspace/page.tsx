"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { VIEW_TO_PATH, type View } from "./_state/workspace-shared";

// Back-compat for bookmarked/old links using the pre-routing `/workspace?view=X&action=Y`
// shape. New navigation goes straight to `/workspace/<segment>` and never hits this.
function WorkspaceRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const view = searchParams.get("view") as View | null;
    const action = searchParams.get("action");
    const path = (view && VIEW_TO_PATH[view]) || "home";
    const query = action ? `?action=${encodeURIComponent(action)}` : "";
    router.replace(`/workspace/${path}${query}`);
  }, [router, searchParams]);

  return <div className="product-shell" />;
}

export default function WorkspacePage() {
  return (
    <Suspense fallback={<div className="product-shell" />}>
      <WorkspaceRedirect />
    </Suspense>
  );
}
