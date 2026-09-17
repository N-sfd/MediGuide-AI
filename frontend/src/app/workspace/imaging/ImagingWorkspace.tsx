"use client";

import { useEffect, useState } from "react";
import { ConfirmDialog, type ToastTone } from "../polish-ui";
import type {
  CompareBucket,
  ImagingStudy,
  ImagingView,
  Modality,
  ModalitySummary,
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
  const [view, setView] = useState<ImagingView>("landing");
  const [modalities, setModalities] = useState<ModalitySummary[]>([]);
  const [studies, setStudies] = useState<ImagingStudy[]>([]);
  const [allStudies, setAllStudies] = useState<ImagingStudy[]>([]);
  const [selectedModality, setSelectedModality] = useState<Modality | null>(null);
  const [selectedStudy, setSelectedStudy] = useState<ImagingStudy | null>(null);
  const [sections, setSections] = useState<ReportSection[]>([]);
  const [editedSections, setEditedSections] = useState<Record<string, string>>({});
  const [reviewedTypes, setReviewedTypes] = useState<Set<string>>(new Set());
  const [selectedPage, setSelectedPage] = useState(1);
  const [viewerExpanded, setViewerExpanded] = useState(false);
  const [transientStatus, setTransientStatus] = useState<"processing" | "failed" | null>(null);
  const [processingError, setProcessingError] = useState("");
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

  async function openStudy(study: ImagingStudy, page = 1) {
    setError("");
    setSelectedStudy(study);
    setSelectedPage(page);
    setViewerExpanded(false);
    setReviewedTypes(new Set());
    setEditedSections({});
    setTransientStatus(null);
    setProcessingError("");
    setView("detail");
    if (study.report_document_id) {
      await loadSections(study.study_id);
    } else {
      setSections([]);
    }
  }

  async function loadSections(studyId: string) {
    try {
      const data = await imagingApi.fetchSections(apiUrl, studyId);
      setSections(data.sections || []);
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

  async function uploadReport(file: File) {
    if (!selectedStudy) return;
    setLastUploadFile(file);
    setTransientStatus("processing");
    setProcessingError("");
    try {
      await imagingApi.uploadReport(apiUrl, selectedStudy.study_id, file);
      pushToast("Report extracted — review required", "success");
      setTransientStatus(null);
      await loadSections(selectedStudy.study_id);
      await loadModalities();
      const refreshed = await imagingApi.fetchStudy(apiUrl, selectedStudy.study_id);
      setSelectedStudy(refreshed);
    } catch (err) {
      setTransientStatus("failed");
      setProcessingError(err instanceof Error ? err.message : "MediGuide could not read this imaging report.");
    }
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
      const data = await imagingApi.confirmSections(apiUrl, selectedStudy.study_id, payload);
      setSections(data.sections || []);
      setSelectedStudy({ ...selectedStudy, verification_status: "verified" });
      pushToast("Report information verified", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not confirm this report.");
    } finally {
      setConfirming(false);
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
          editedSections={editedSections}
          setEditedSections={setEditedSections}
          reviewedTypes={reviewedTypes}
          setReviewedTypes={setReviewedTypes}
          selectedPage={selectedPage}
          setSelectedPage={setSelectedPage}
          viewerExpanded={viewerExpanded}
          setViewerExpanded={setViewerExpanded}
          transientStatus={transientStatus}
          processingError={processingError}
          confirming={confirming}
          onBack={() => setView(selectedModality ? "list" : "landing")}
          onOpenHistory={() => void openHistory()}
          onOpenCompare={() => void openCompare(selectedStudy)}
          onUploadReport={(file) => void uploadReport(file)}
          onRetryUpload={retryUpload}
          onConfirm={() => void confirmSections()}
          onRequestDelete={requestDeleteSelected}
          onOpenTerminology={openTerminology}
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
