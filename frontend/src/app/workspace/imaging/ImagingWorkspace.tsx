"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog, type ToastTone } from "../polish-ui";
import type {
  CompareBucket,
  FindingExplanation,
  ImagingFinding,
  ImagingSample,
  ImagingStudy,
  ImagingView,
  Modality,
  ModalitySummary,
  ReportGap,
  ReportSection,
  TermExplanation,
} from "./imaging-types";
import * as imagingApi from "./imaging-api";
import { ImagingLanding } from "./ImagingLanding";
import { ImagingStudyList } from "./ImagingStudyList";
import { ImagingStudyDetail } from "./ImagingStudyDetail";
import { ImagingHistory } from "./ImagingHistory";
import { ImagingCompare } from "./ImagingCompare";
import { ImagingTerminology } from "./ImagingTerminology";
import { ImagingErrorBanner } from "./ImagingErrorState";

export function ImagingWorkspace({
  apiUrl,
  pushToast,
  openStudyId,
}: {
  apiUrl: string;
  pushToast: (message: string, tone?: ToastTone) => void;
  /** Set by the Health Timeline's "View study" cross-link — jumps straight
   * to that study's detail view on mount, bypassing the modality browser. */
  openStudyId?: string | null;
}) {
  const router = useRouter();
  const [view, setView] = useState<ImagingView>("landing");
  const [modalities, setModalities] = useState<ModalitySummary[]>([]);
  const [studies, setStudies] = useState<ImagingStudy[]>([]);
  const [allStudies, setAllStudies] = useState<ImagingStudy[]>([]);
  const [selectedModality, setSelectedModality] = useState<Modality | null>(null);
  const [selectedStudy, setSelectedStudy] = useState<ImagingStudy | null>(null);
  const [sections, setSections] = useState<ReportSection[]>([]);
  const [findings, setFindings] = useState<ImagingFinding[]>([]);
  const [gaps, setGaps] = useState<ReportGap[]>([]);
  const [boundary, setBoundary] = useState(
    "MediGuide explains the radiologist's report. It does not independently diagnose the scan.",
  );
  const [editedSections, setEditedSections] = useState<Record<string, string>>({});
  const [reviewedTypes, setReviewedTypes] = useState<Set<string>>(new Set());
  const [findingDrafts, setFindingDrafts] = useState<Record<string, string>>({});
  const [reviewedFindingIds, setReviewedFindingIds] = useState<Set<string>>(new Set());
  const [confirmingFindings, setConfirmingFindings] = useState(false);
  const [findingExplanation, setFindingExplanation] = useState<FindingExplanation | null>(null);
  const [findingExplainLoading, setFindingExplainLoading] = useState(false);
  const [selectedPage, setSelectedPage] = useState(1);
  const [viewerExpanded, setViewerExpanded] = useState(false);
  const [transientStatus, setTransientStatus] = useState<"processing" | "failed" | null>(null);
  const [processingError, setProcessingError] = useState("");
  const [processingProgress, setProcessingProgress] = useState<{
    stage: string;
    retryAttempt: number;
    retryMax: number;
  } | null>(null);
  const [lastUploadFile, setLastUploadFile] = useState<File | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ImagingStudy | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newModality, setNewModality] = useState<Modality>("mri");
  const [newBodyRegion, setNewBodyRegion] = useState("");
  const [newStudyDate, setNewStudyDate] = useState("");
  const [newInstitution, setNewInstitution] = useState("");

  const [historyStudies, setHistoryStudies] = useState<ImagingStudy[]>([]);
  const [historyModalityFilter, setHistoryModalityFilter] = useState("");
  const [historyRegionFilter, setHistoryRegionFilter] = useState("");

  const [compareCandidates, setCompareCandidates] = useState<ImagingStudy[]>([]);
  const [compareA, setCompareA] = useState("");
  const [compareB, setCompareB] = useState("");
  const [compareSameModalityOnly, setCompareSameModalityOnly] = useState(true);
  const [compareResult, setCompareResult] = useState<CompareBucket[] | null>(null);

  const [terminologyOpen, setTerminologyOpen] = useState(false);
  const [terminologyTerm, setTerminologyTerm] = useState("");
  const [terminologyExcerpt, setTerminologyExcerpt] = useState("");
  const [terminologyAnswer, setTerminologyAnswer] = useState<TermExplanation | null>(null);
  const [terminologyLoading, setTerminologyLoading] = useState(false);

  async function loadModalities() {
    if (!apiUrl) return;
    try {
      const data = await imagingApi.fetchModalities(apiUrl);
      setModalities(data.modalities || []);
    } catch {
      setError("Could not load imaging categories.");
    }
  }

  useEffect(() => {
    // Fetch-on-mount from the backend; not a derivable render-time value.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadModalities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiUrl]);

  useEffect(() => {
    if (!openStudyId) return;
    imagingApi
      .fetchStudy(apiUrl, openStudyId)
      .then((study) => openStudy(study))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not open this study."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openStudyId]);

  async function loadStudies(modality: Modality) {
    setError("");
    setLoading("Loading studies...");
    try {
      const data = await imagingApi.fetchStudies(apiUrl, { modality });
      setStudies(data.studies || []);
      setSelectedModality(modality);
      setView("list");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load studies.");
    } finally {
      setLoading("");
    }
  }

  async function loadFindings(studyId: string) {
    try {
      const data = await imagingApi.fetchFindings(apiUrl, studyId);
      setFindings(data.findings || []);
      setGaps(data.gaps || []);
      if (data.boundary) setBoundary(data.boundary);
      const confirmed = (data.findings || []).filter((f) => f.verification_status === "confirmed").map((f) => f.finding_id);
      if (confirmed.length) setReviewedFindingIds(new Set(confirmed));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load findings.");
    }
  }

  async function openStudy(study: ImagingStudy, page = 1) {
    setError("");
    setSelectedStudy(study);
    setSelectedPage(page);
    setViewerExpanded(false);
    setReviewedTypes(new Set());
    setEditedSections({});
    setFindingDrafts({});
    setReviewedFindingIds(new Set());
    setFindingExplanation(null);
    setTransientStatus(null);
    setProcessingError("");
    setView("detail");
    if (study.report_document_id) {
      await loadSections(study.study_id);
      await loadFindings(study.study_id);
    } else {
      setSections([]);
      setFindings([]);
      setGaps([]);
    }
  }

  async function loadSections(studyId: string) {
    try {
      const data = await imagingApi.fetchSections(apiUrl, studyId);
      const fetched = data.sections || [];
      setSections(fetched);
      // Sections already confirmed on the backend (e.g. reopening a
      // partially-verified study) start out "reviewed" too, so progress and
      // the Confirm button reflect real prior confirmation, not a reset.
      const confirmedTypes = fetched.filter((s) => s.verification_status === "confirmed").map((s) => s.section_type);
      if (confirmedTypes.length > 0) setReviewedTypes(new Set(confirmedTypes));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load report sections.");
    }
  }

  async function createStudy() {
    if (!apiUrl) return;
    setError("");
    setLoading("Creating study...");
    try {
      const study = await imagingApi.createStudy(apiUrl, {
        modality: newModality,
        body_region: newBodyRegion,
        study_date: newStudyDate || null,
        institution: newInstitution,
      });
      pushToast("Imaging study created", "success");
      setShowAddForm(false);
      setNewBodyRegion("");
      setNewStudyDate("");
      setNewInstitution("");
      await loadModalities();
      await openStudy(study);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create this study.");
    } finally {
      setLoading("");
    }
  }

  async function trySampleReport(sample: ImagingSample) {
    if (!apiUrl) return;
    setError("");
    setLoading(`Preparing ${sample.modality_label} sample…`);
    try {
      const study = await imagingApi.createStudy(apiUrl, {
        modality: sample.modality,
        body_region: sample.body_region,
        study_date: new Date().toISOString().slice(0, 10),
        institution: "MediGuide synthetic demo",
        study_description: sample.title,
      });
      await loadModalities();
      await openStudy(study);
      setLoading("");
      const file = await imagingApi.downloadImagingSample(apiUrl, sample.slug, sample.filename);
      await uploadReport(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load this sample report.");
      setLoading("");
    }
  }

  async function uploadReport(file: File) {
    if (!selectedStudy) return;
    const studyId = selectedStudy.study_id;
    setLastUploadFile(file);
    setTransientStatus("processing");
    setProcessingError("");
    setProcessingProgress(null);

    // Polls a study_id-keyed status route rather than waiting on the
    // upload response itself — that single request only returns once
    // extraction finishes (success or failure), so this is the only way to
    // show live stage/retry progress while it's still in flight.
    const pollTimer = window.setInterval(async () => {
      const status = await imagingApi.fetchReportStatus(apiUrl, studyId);
      if (status && status.stage) {
        setProcessingProgress({
          stage: status.stage,
          retryAttempt: status.retry_attempt,
          retryMax: status.retry_max,
        });
      }
    }, 1200);

    try {
      await imagingApi.uploadReport(apiUrl, studyId, file);
      pushToast("Report extracted — review required", "success");
      setTransientStatus(null);
      await loadSections(studyId);
      await loadFindings(studyId);
      await loadModalities();
      const refreshed = await imagingApi.fetchStudy(apiUrl, studyId);
      setSelectedStudy(refreshed);
    } catch (err) {
      setTransientStatus("failed");
      setProcessingError(err instanceof Error ? err.message : "MediGuide could not read this imaging report.");
    } finally {
      window.clearInterval(pollTimer);
      setProcessingProgress(null);
    }
  }

  // Dismisses a failed re-upload attempt and falls back to whatever report
  // this study already had before that attempt — the upload endpoint never
  // touches the study's existing report_document_id/sections until
  // extraction fully succeeds, so the prior report is always still there.
  function viewExistingReport() {
    setTransientStatus(null);
    setProcessingError("");
  }

  function retryUpload() {
    if (lastUploadFile) void uploadReport(lastUploadFile);
  }

  async function confirmSections() {
    if (!selectedStudy) return;
    setConfirming(true);
    setError("");
    try {
      const payload = Object.entries(editedSections).map(([section_type, text]) => ({ section_type, text }));
      const data = await imagingApi.confirmSections(apiUrl, selectedStudy.study_id, payload, Array.from(reviewedTypes));
      setSections(data.sections || []);
      setSelectedStudy({ ...selectedStudy, verification_status: data.verification_status as ImagingStudy["verification_status"] });
      await loadFindings(selectedStudy.study_id);
      pushToast(
        data.verification_status === "verified" ? "Report information verified" : "Reviewed sections confirmed",
        "success",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not confirm this report.");
    } finally {
      setConfirming(false);
    }
  }

  async function confirmFindingUpdates(
    updates: { finding_id: string; confirmed_text: string; verification_status: string }[],
  ) {
    if (!selectedStudy || updates.length === 0) return;
    setConfirmingFindings(true);
    setError("");
    try {
      const data = await imagingApi.confirmFindings(apiUrl, selectedStudy.study_id, updates);
      setFindings(data.findings || []);
      pushToast("Findings updated", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not confirm these findings.");
    } finally {
      setConfirmingFindings(false);
    }
  }

  async function explainFinding(finding: ImagingFinding) {
    setFindingExplainLoading(true);
    setFindingExplanation(null);
    try {
      const data = await imagingApi.explainFinding(apiUrl, finding.finding_id);
      setFindingExplanation(data);
    } catch (err) {
      setFindingExplanation({
        finding,
        record_provenance: {
          finding_id: finding.finding_id,
          finding_text: finding.finding_text,
          section: finding.section,
          source_document_id: finding.source_document_id,
          source_page: finding.source_page,
          verification_status: finding.verification_status,
        },
        answer_markdown: err instanceof Error ? err.message : "Educational explanation is temporarily unavailable.",
        sources: [],
        education_available: false,
        unavailable_reason: "model_unavailable",
      });
    } finally {
      setFindingExplainLoading(false);
    }
  }

  function requestDeleteSelected() {
    if (selectedStudy) setDeleteTarget(selectedStudy);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const studyId = deleteTarget.study_id;
    setDeleteTarget(null);
    try {
      await imagingApi.deleteStudy(apiUrl, studyId);
      pushToast("Imaging study deleted", "info");
      setView("landing");
      setSelectedStudy(null);
      await loadModalities();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete this study.");
    }
  }

  async function openHistory() {
    setError("");
    setLoading("Loading imaging history...");
    try {
      const data = await imagingApi.fetchStudies(apiUrl, {
        modality: historyModalityFilter || undefined,
        body_region: historyRegionFilter || undefined,
      });
      setHistoryStudies(data.studies || []);
      setView("history");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load imaging history.");
    } finally {
      setLoading("");
    }
  }

  async function openCompare(presetStudy?: ImagingStudy) {
    setError("");
    setCompareResult(null);
    setLoading("Loading verified studies...");
    try {
      const data = await imagingApi.fetchStudies(apiUrl);
      setAllStudies(data.studies || []);
      const verified = (data.studies || []).filter(
        (study: ImagingStudy) => study.verification_status === "verified" && study.report_document_id,
      );
      setCompareCandidates(verified);
      if (presetStudy) {
        setCompareA(presetStudy.study_id);
        setCompareB("");
      }
      setView("compare");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load studies to compare.");
    } finally {
      setLoading("");
    }
  }

  async function runCompare() {
    if (!compareA || !compareB) return;
    setError("");
    setLoading("Comparing reports...");
    try {
      const studyA = compareCandidates.find((study) => study.study_id === compareA);
      const studyB = compareCandidates.find((study) => study.study_id === compareB);
      if (!studyA?.report_document_id || !studyB?.report_document_id) return;
      const data = await imagingApi.compareReports(apiUrl, studyA.report_document_id, studyB.report_document_id);
      setCompareResult(data.comparisons);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not compare these reports.");
    } finally {
      setLoading("");
    }
  }

  async function viewCompareSource(documentId: string, pageNumber: number | null) {
    const study = allStudies.find((s) => s.report_document_id === documentId);
    if (!study) return;
    await openStudy(study, pageNumber || 1);
    setViewerExpanded(true);
  }

  function openTerminology(term: string, sourceExcerpt: string) {
    setTerminologyTerm(term);
    setTerminologyExcerpt(sourceExcerpt);
    setTerminologyAnswer(null);
    setTerminologyOpen(true);
  }

  async function explainTerm(term: string) {
    if (!term) return;
    setTerminologyLoading(true);
    try {
      const data = await imagingApi.explainTerm(apiUrl, term, selectedStudy?.modality);
      setTerminologyAnswer({
        text: data.answer_markdown,
        sourceExcerpt: terminologyExcerpt,
        sources: data.sources || [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not explain this term right now.");
    } finally {
      setTerminologyLoading(false);
    }
  }

  const filteredStudies = studies.filter((study) => {
    if (!search.trim()) return true;
    const haystack = `${study.body_region} ${study.study_description} ${study.study_date || ""}`.toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  });

  return (
    <div className="imaging-view">
      {error && <ImagingErrorBanner message={error} onDismiss={() => setError("")} />}

      {view === "landing" && (
        <ImagingLanding
          apiUrl={apiUrl}
          modalities={modalities}
          loading={loading}
          showAddForm={showAddForm}
          setShowAddForm={setShowAddForm}
          newModality={newModality}
          setNewModality={setNewModality}
          newBodyRegion={newBodyRegion}
          setNewBodyRegion={setNewBodyRegion}
          newStudyDate={newStudyDate}
          setNewStudyDate={setNewStudyDate}
          newInstitution={newInstitution}
          setNewInstitution={setNewInstitution}
          onCreateStudy={() => void createStudy()}
          onSelectModality={(modality) => void loadStudies(modality)}
          onOpenHistory={() => void openHistory()}
          onOpenCompare={() => void openCompare()}
          onTrySample={(sample) => void trySampleReport(sample)}
        />
      )}

      {view === "list" && selectedModality && (
        <ImagingStudyList
          modality={selectedModality}
          studies={filteredStudies}
          search={search}
          setSearch={setSearch}
          onBack={() => setView("landing")}
          onOpenStudy={(study) => void openStudy(study)}
        />
      )}

      {view === "detail" && selectedStudy && (
        <ImagingStudyDetail
          apiUrl={apiUrl}
          study={selectedStudy}
          sections={sections}
          findings={findings}
          gaps={gaps}
          boundary={boundary}
          editedSections={editedSections}
          setEditedSections={setEditedSections}
          reviewedTypes={reviewedTypes}
          setReviewedTypes={setReviewedTypes}
          findingDrafts={findingDrafts}
          setFindingDrafts={setFindingDrafts}
          reviewedFindingIds={reviewedFindingIds}
          setReviewedFindingIds={setReviewedFindingIds}
          selectedPage={selectedPage}
          setSelectedPage={setSelectedPage}
          viewerExpanded={viewerExpanded}
          setViewerExpanded={setViewerExpanded}
          transientStatus={transientStatus}
          processingError={processingError}
          processingProgress={processingProgress}
          confirming={confirming}
          confirmingFindings={confirmingFindings}
          onBack={() => setView(selectedModality ? "list" : "landing")}
          onOpenHistory={() => void openHistory()}
          onOpenCompare={() => void openCompare(selectedStudy)}
          onUploadReport={(file) => void uploadReport(file)}
          onRetryUpload={retryUpload}
          onViewExistingReport={viewExistingReport}
          onConfirm={() => void confirmSections()}
          onConfirmFindings={(updates) => void confirmFindingUpdates(updates)}
          onExplainFinding={(finding) => void explainFinding(finding)}
          findingExplanation={findingExplanation}
          findingExplainLoading={findingExplainLoading}
          onRequestDelete={requestDeleteSelected}
          onOpenTerminology={openTerminology}
          onAddToVisit={() => {
            pushToast("Added to Visit Preparation", "success");
            router.push("/workspace/visit");
          }}
          onOpenSourceDocument={(documentId, page) => {
            router.push(`/workspace/documents/${documentId}?page=${page}`);
          }}
        />
      )}

      {view === "history" && (
        <ImagingHistory
          studies={historyStudies}
          modalityFilter={historyModalityFilter}
          setModalityFilter={setHistoryModalityFilter}
          regionFilter={historyRegionFilter}
          setRegionFilter={setHistoryRegionFilter}
          onApplyFilters={() => void openHistory()}
          onBack={() => setView("landing")}
          onOpenStudy={(study) => void openStudy(study)}
          onCompareStudy={(study) => void openCompare(study)}
        />
      )}

      {view === "compare" && (
        <ImagingCompare
          candidates={compareCandidates}
          compareA={compareA}
          setCompareA={setCompareA}
          compareB={compareB}
          setCompareB={setCompareB}
          sameModalityOnly={compareSameModalityOnly}
          setSameModalityOnly={setCompareSameModalityOnly}
          result={compareResult}
          onRunCompare={() => void runCompare()}
          onBack={() => setView("landing")}
          onViewSource={(documentId, page) => void viewCompareSource(documentId, page)}
        />
      )}

      <ImagingTerminology
        open={terminologyOpen}
        initialTerm={terminologyTerm}
        sourceExcerpt={terminologyExcerpt}
        answer={terminologyAnswer}
        loading={terminologyLoading}
        onExplain={(term) => void explainTerm(term)}
        onClose={() => setTerminologyOpen(false)}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete imaging study?"
        body="This removes the study from your Imaging workspace. The uploaded source document will remain stored."
        confirmLabel="Delete study"
        destructive
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
