"use client";

import { useEffect } from "react";
import { SystemStatusView } from "../workspace-views";
import { useWorkspaceContext } from "../_state/WorkspaceStateProvider";

export default function SystemPage() {
  const { systemStatus, health, checkHealth, loadSystemStatus } = useWorkspaceContext();

  // loadSystemStatus is a plain closure recreated every provider render,
  // not a stable useCallback ref — must run once on mount only.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void loadSystemStatus(); }, []);

  return (
    <SystemStatusView
      status={systemStatus}
      health={health}
      onRetry={() => { void checkHealth(); void loadSystemStatus(); }}
    />
  );
}
