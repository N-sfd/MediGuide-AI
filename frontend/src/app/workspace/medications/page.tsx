"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Medication } from "../workspace-views";
import { useWorkspaceContext } from "../_state/WorkspaceStateProvider";
import { API_URL } from "../_state/workspace-shared";

function MedicationsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    medState, medFields, medConfirmed, medReviewChecked, setMedReviewChecked,
    medInfo, medQuestion, setMedQuestion, medTypedText, setMedTypedText,
    selectedSource, setSelectedSource, medDragging, setMedDragging, medFileInput,
    onMedDrop, updateMedField, confirmMedication, getMedicationInfo,
    submitTypedMedication, loadDemoMedication, prepareVisitFromMedication,
    resetMedication, loadingStage, error,
  } = useWorkspaceContext();

  useEffect(() => {
    if (searchParams.get("action") !== "upload") return;
    router.replace("/workspace/medications");
    const timer = window.setTimeout(() => medFileInput.current?.click(), 300);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return (
    <Medication
      apiUrl={API_URL}
      medState={medState}
      medFields={medFields}
      medConfirmed={medConfirmed}
      medReviewChecked={medReviewChecked}
      setMedReviewChecked={setMedReviewChecked}
      medInfo={medInfo}
      medQuestion={medQuestion}
      setMedQuestion={setMedQuestion}
      medTypedText={medTypedText}
      setMedTypedText={setMedTypedText}
      selectedSource={selectedSource}
      setSelectedSource={setSelectedSource}
      dragging={medDragging}
      onUpload={() => medFileInput.current?.click()}
      onDrop={onMedDrop}
      onDragEnter={() => setMedDragging(true)}
      onDragLeave={() => setMedDragging(false)}
      onFieldChange={updateMedField}
      onConfirm={() => void confirmMedication()}
      onGetInfo={() => void getMedicationInfo()}
      onSubmitTyped={() => void submitTypedMedication(medTypedText)}
      onSample={loadDemoMedication}
      onPrepareVisit={prepareVisitFromMedication}
      onReset={resetMedication}
      loading={loadingStage}
      error={error}
    />
  );
}

export default function MedicationsPage() {
  return (
    <Suspense fallback={null}>
      <MedicationsPageContent />
    </Suspense>
  );
}
