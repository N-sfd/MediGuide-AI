"use client";

import { useEffect } from "react";
import { LabTimeline } from "../workspace-views";
import { useWorkspaceContext } from "../_state/WorkspaceStateProvider";

export default function LabsPage() {
  const {
    labTests, selectedLabCode, setSelectedLabCode, labPoints, selectedLabPoint,
    setSelectedLabPoint, inspectDocument, exportLabPoints, addLabsToVisit,
    askAboutLabs, setConfirmDeleteObservationId, handleViewChange,
    loadLabs, loadLabSummary,
  } = useWorkspaceContext();

  // loadLabs/loadLabSummary are plain closures recreated every provider
  // render, not stable useCallback refs — only selectedLabCode belongs
  // in the dependency array.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void loadLabs(selectedLabCode); }, [selectedLabCode]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void loadLabSummary(); }, []);

  return (
    <LabTimeline
      tests={labTests}
      selectedCode={selectedLabCode}
      onSelectCode={(code) => { setSelectedLabCode(code); setSelectedLabPoint(null); }}
      points={labPoints}
      selectedPoint={selectedLabPoint}
      onSelectPoint={setSelectedLabPoint}
      onInspectDocument={(documentId, pageNumber, fieldId) => void inspectDocument(documentId, pageNumber, fieldId)}
      onExport={exportLabPoints}
      onAddToVisit={addLabsToVisit}
      onAskAbout={askAboutLabs}
      onRequestDeleteObservation={(observationId) => setConfirmDeleteObservationId(observationId)}
      onOpenDocuments={() => handleViewChange("documents")}
    />
  );
}
