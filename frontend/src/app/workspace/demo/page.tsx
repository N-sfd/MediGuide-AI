"use client";

import { DemoMode } from "../workspace-views";
import { useWorkspaceContext } from "../_state/WorkspaceStateProvider";
import { DEMO_VOICE_QUESTION, DEMO_VISIT } from "../../../lib/demo-data";

export default function DemoPage() {
  const {
    runSyntheticDocumentDemo, loadDemoMedication, setQuestion, handleViewChange,
    setVisitFields, setVisitStep,
  } = useWorkspaceContext();

  return (
    <DemoMode
      onSyntheticPipeline={() => void runSyntheticDocumentDemo()}
      onSampleMedication={loadDemoMedication}
      onSampleVoice={() => { setQuestion(DEMO_VOICE_QUESTION); handleViewChange("conversation"); }}
      onSampleVisit={() => { setVisitFields({ ...DEMO_VISIT }); setVisitStep(4); handleViewChange("visit"); }}
    />
  );
}
