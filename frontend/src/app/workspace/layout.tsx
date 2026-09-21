import type { ReactNode } from "react";
import { WorkspaceStateProvider } from "./_state/WorkspaceStateProvider";
import { WorkspaceShell } from "./_components/WorkspaceShell";
import "../workspace.css";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <WorkspaceStateProvider>
      <WorkspaceShell>{children}</WorkspaceShell>
    </WorkspaceStateProvider>
  );
}
