"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import WorkspaceApp from "./WorkspaceApp";

function WorkspaceContent() {
  const searchParams = useSearchParams();
  const initialView = searchParams.get("view") || undefined;
  return <WorkspaceApp initialView={initialView} />;
}

export default function WorkspacePage() {
  return (
    <Suspense fallback={<div className="product-shell" />}>
      <WorkspaceContent />
    </Suspense>
  );
}
