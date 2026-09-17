"use client";

import { ChangeEvent, DragEvent, FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { Activity, ArrowUp, ArrowUpRight, BookOpen, Check, ChevronRight, Clipboard, FileText, FlaskConical, HelpCircle, Home as HomeIcon, Image as ImageIcon, Lock, Menu, Mic, Milestone, Paperclip, Pill, PlayCircle, Plus, RefreshCw, ScanLine, Settings, ShieldCheck, Sparkles, Stethoscope, Trash2, TrendingUp, UserRound, Volume2, X, ZoomIn } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { DEMO_CBC_FIELDS, DEMO_MEDICATION, DEMO_VOICE_QUESTION, DEMO_VISIT, EVALUATION_METRICS } from "../../lib/demo-data";
import { fetchWithTimeout, parseApiError } from "../../lib/api-error";
import { BrandLogo } from "../brand-logo";
import { ImagingWorkspace } from "./imaging/ImagingWorkspace";
import { HealthTimeline } from "./HealthTimeline";
import {
  ConfirmDialog,
  EmptyState,
  ProcessingChecklist,
  ToastStack,
  friendlyComponentStatus,
  friendlyHealthLabel,
  mapStatusToProcessStage,
  type ProcessStageId,
  type ToastItem,
} from "./polish-ui";
import "../workspace.css";

type Source = { number: number; title: string; publisher: string; published?: string; reviewed?: string; url?: string; passage?: string };
type LibrarySource = { id: string; title: string; publisher: string; url?: string; published?: string; reviewed?: string; type?: string };
type Message = { role: "user" | "assistant"; content: string };
type DocFieldStatus = "in_listed_range" | "outside_listed_range" | "flagged_high_on_report" | "flagged_low_on_report" | "not_applicable" | "unknown";
type DocFieldConfidence = "clearly_visible" | "needs_review" | "could_not_read";
type DocField = { field_id: string; label: string; value: string; unit: string; reference_range: string; status: DocFieldStatus; confidence: DocFieldConfidence; page_number: number; source_text: string; extraction_method?: string; user_edited: boolean };
type DocPage = { page_number: number; preview_url: string; text_available: boolean; extracted_field_count: number };
type DocState = { document_id: string; filename: string; page_count: number; status: string; pages: DocPage[]; fields: DocField[]; confirmed: boolean };
type DocSession = { document_id: string; filename: string; status: string; page_count: number; field_count: number; confirmed: boolean };
type DocUploadResult = { document_id: string; filename: string; content_type?: string; file_size?: number; status: string };
type DocEvidenceSource = { citation_number: number; title: string; publisher: string; source_url?: string; passage?: string };
type DocExplain = { document_id: string; answer_markdown: string; document_pages_cited: number[]; sources: DocEvidenceSource[]; limitations: string[] };
type HealthStatus = { status: string; detail: string };
type HealthResponse = { status: string; ready: number; total: number; statuses: Record<string, HealthStatus>; knowledge?: { active_chunks?: number; approved_sources?: number } };
type MedField = { key: string; label: string; value: string; confidence: DocFieldConfidence; source_text: string; user_edited: boolean };
type MedState = { medication_id: string; source: "upload" | "typed"; filename: string; preview_url: string; status: string; fields: MedField[]; other_visible_text: string; confirmed: boolean };
type MedInfo = { medication_id: string; answer_markdown: string; sources: DocEvidenceSource[]; limitations: string[] };
type LabTest = { test_code: string; display_name: string; observation_count: number; has_data: boolean };
type LabPoint = {
  observation_id: string;
  test_code: string;
  test_name: string;
  normalized_name?: string;
  value: number | null;
  value_text: string;
  extracted_value?: number | null;
  confirmed_value?: number | null;
  unit: string;
  report_date: string | null;
  collection_date?: string | null;
  document_id: string;
  document_name: string;
  page_number: number;
  source_page?: number;
  field_id: string;
  verification_state: string;
  verification_status?: string;
  confidence?: string;
  extraction_method?: string;
  range_status?: string;
  source_flag?: string;
  reference_text?: string;
  reference_range?: string;
  change_from_previous?: number | null;
  change_direction?: "up" | "down" | "unchanged" | null;
};
type SystemComponent = { name: string; key: string; status: string; detail: string };
type SystemStatus = { service: string; overall: string; components: SystemComponent[]; knowledge: { active_chunks?: number; approved_sources?: number } };
type View = "conversation" | "timeline" | "documents" | "labs" | "imaging" | "medication" | "visit" | "sources" | "system" | "evaluation" | "demo";
type AnswerStatus = "answered" | "withheld" | "emergency" | "no_evidence" | "error" | "";
type SseEvent =
  | { type: "stage"; stage: string }
  | { type: "sources"; sources: Source[] }
  | { type: "delta"; text: string }
  | { type: "done"; answer: string; sources: Source[]; status: AnswerStatus };

async function* readSseEvents(response: Response): AsyncGenerator<SseEvent> {
  const reader = response.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const line = frame.split("\n").find((part) => part.startsWith("data: "));
      if (!line) continue;
      const payload = line.slice(6);
      if (payload === "[DONE]") return;
      try { yield JSON.parse(payload) as SseEvent; } catch { /* ignore malformed frame */ }
    }
  }
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === "development" ? "http://127.0.0.1:8000" : "");
const API_CONFIGURATION_MESSAGE = "The deployed frontend has no AI service URL. Set NEXT_PUBLIC_API_URL to the HTTPS address of the FastAPI backend and redeploy.";
const quickActions = [
  ["Blood pressure", "Systolic, diastolic, and why it matters.", BookOpen, "What is blood pressure?"],
  ["Lab results", "Understand hemoglobin and CBC basics.", FileText, "What is hemoglobin in a CBC lab test?"],
  ["Medication labels", "Review antibiotic and label basics.", Stethoscope, "What should I understand about amoxicillin and medication labels?"],
] as const;

const topicSuggestions = [
  ["Blood pressure", "What is blood pressure?"],
  ["Lab results", "What is hemoglobin in a CBC lab test?"],
  ["Medication labels", "What should I understand about medication labels?"],
  ["Prepare for a visit", "How should I prepare for a healthcare appointment?"],
] as const;
const healthLabels: Record<string, string> = {
  fastapi: "MediGuide API",
  ollama: "Educational explanations",
  text_model: "Educational explanations",
  vision_model: "Document reading",
  embedding_model: "Educational sources",
  vector_store: "Educational sources",
  database: "Document storage",
  whisper: "Voice transcription",
  piper: "Voice playback",
  translation_model: "Translation",
};

function suggestClinicianQuestions(fields: DocField[], medFields: MedField[], labPoints: LabPoint[]) {
  const questions: string[] = [];
  for (const field of fields.filter((item) => item.label.toLowerCase() !== "report date" && item.value).slice(0, 4)) {
    questions.push(`Has my ${field.label} (${field.value}${field.unit ? ` ${field.unit}` : ""}) changed compared with previous results?`);
    if (field.reference_range) {
      questions.push(`The report lists ${field.reference_range} for ${field.label}. Should this be repeated or discussed?`);
    }
  }
  if (labPoints.length) questions.push("Are there trends over time I should ask about?");
  const medName = medFields.find((field) => field.key === "name")?.value;
  if (medName) questions.push(`Could ${medName} affect these lab values?`);
  if (!questions.length) {
    return "What do these results mean for me?\nShould any tests be repeated?\nWhat should I watch for before the next visit?";
  }
  return [...new Set(questions)].slice(0, 6).join("\n");
}

function downloadTextFile(filename: string, contents: string) {
  const blob = new Blob([contents], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, "\"\"")}"`).join(",")).join("\n");
  downloadTextFile(filename, csv);
}

const SETTINGS_STORAGE_KEY = "mediguide.workspace-settings";
const VISIT_STORAGE_KEY = "mediguide.visit-draft";

function readStoredSettings() {
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    return raw ? JSON.parse(raw) as { answerDetail?: "Concise" | "Standard" | "Detailed"; readingLevel?: "Standard" | "Plain"; language?: string } : {};
  } catch {
    return {};
  }
}

export default function WorkspaceApp({ initialView, initialAction }: { initialView?: string; initialAction?: string } = {}) {
  const router = useRouter();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const initialValidView = (initialView && ["conversation", "timeline", "documents", "labs", "imaging", "medication", "visit", "sources", "system", "demo", "evaluation"].includes(initialView) ? initialView : "documents") as View;
  const [view, setView] = useState<View>(initialValidView);
  const [pendingImagingStudyId, setPendingImagingStudyId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [answer, setAnswer] = useState("");
  const [answerStatus, setAnswerStatus] = useState<AnswerStatus>("");
  const [streaming, setStreaming] = useState(false);
  const [question, setQuestion] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [loadingStage, setLoadingStage] = useState("");
  const [error, setError] = useState("");
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthOpen, setHealthOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [pendingTranscript, setPendingTranscript] = useState("");
  const [transcriptReviewed, setTranscriptReviewed] = useState(false);
  const [selectedSource, setSelectedSource] = useState<number | null>(null);
  const [language, setLanguage] = useState("English");
  const [recording, setRecording] = useState(false);
  const [docState, setDocState] = useState<DocState | null>(null);
  const [docFields, setDocFields] = useState<DocField[]>([]);
  const [docConfirmed, setDocConfirmed] = useState(false);
  const [docReviewChecked, setDocReviewChecked] = useState(false);
  const [docSelectedPage, setDocSelectedPage] = useState(1);
  const [docExplain, setDocExplain] = useState<DocExplain | null>(null);
  const [docQuestion, setDocQuestion] = useState("");
  const [documentDragging, setDocumentDragging] = useState(false);
  const [medState, setMedState] = useState<MedState | null>(null);
  const [medFields, setMedFields] = useState<MedField[]>([]);
  const [medConfirmed, setMedConfirmed] = useState(false);
  const [medReviewChecked, setMedReviewChecked] = useState(false);
  const [medInfo, setMedInfo] = useState<MedInfo | null>(null);
  const [medQuestion, setMedQuestion] = useState("");
  const [medTypedText, setMedTypedText] = useState("");
  const [medDragging, setMedDragging] = useState(false);
  const [visitFields, setVisitFields] = useState<Record<string, string>>({});
  const [visitStep, setVisitStep] = useState(1);
  const [addConfirmedLabsHint, setAddConfirmedLabsHint] = useState("");
  const [demoGuide, setDemoGuide] = useState("");
  const [confirmedLabCodes, setConfirmedLabCodes] = useState<string[]>([]);
  const [docErrorKind, setDocErrorKind] = useState<"upload" | "extract" | "confirm" | "explain" | "sample" | "">("");
  const [pendingDocId, setPendingDocId] = useState<string | null>(null);
  const [highlightedFieldId, setHighlightedFieldId] = useState<string | null>(null);
  const [processStage, setProcessStage] = useState<ProcessStageId | null>(null);
  const [processFailed, setProcessFailed] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmDeleteObservationId, setConfirmDeleteObservationId] = useState<string | null>(null);
  const [confirmResetDocument, setConfirmResetDocument] = useState(false);
  const [sourceBreadcrumb, setSourceBreadcrumb] = useState("");
  const [previewZoom, setPreviewZoom] = useState(1);
  const [fieldReviewState, setFieldReviewState] = useState<Record<string, "unverified" | "confirmed" | "corrected" | "rejected">>({});
  const [labTests, setLabTests] = useState<LabTest[]>([]);
  const [selectedLabCode, setSelectedLabCode] = useState("hemoglobin_a1c");
  const [labPoints, setLabPoints] = useState<LabPoint[]>([]);
  const [labSummary, setLabSummary] = useState<LabPoint[]>([]);
  const [recentSessions, setRecentSessions] = useState<DocSession[]>([]);
  const [selectedLabPoint, setSelectedLabPoint] = useState<LabPoint | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [answerDetail, setAnswerDetail] = useState<"Concise" | "Standard" | "Detailed">("Standard");
  const [readingLevel, setReadingLevel] = useState<"Standard" | "Plain">("Standard");
  const [library, setLibrary] = useState<LibrarySource[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const medFileInput = useRef<HTMLInputElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  function pushToast(message: string, tone: ToastItem["tone"] = "info") {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((current) => [...current.slice(-3), { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, tone === "error" ? 8000 : 4200);
  }

  useEffect(() => { void checkHealth(); void loadLibrary(); }, []);
  useEffect(() => {
    // One-time hydration from localStorage/sessionStorage (external systems),
    // not a value derivable from props/state during render.
    /* eslint-disable react-hooks/set-state-in-effect */
    const stored = readStoredSettings();
    if (stored.answerDetail) setAnswerDetail(stored.answerDetail);
    if (stored.readingLevel) setReadingLevel(stored.readingLevel);
    if (stored.language) setLanguage(stored.language);
    try {
      const visitDraft = window.sessionStorage.getItem(VISIT_STORAGE_KEY);
      if (visitDraft) setVisitFields(JSON.parse(visitDraft) as Record<string, string>);
    } catch { /* ignore */ }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);
  useEffect(() => {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ answerDetail, readingLevel, language }));
  }, [answerDetail, readingLevel, language]);
  useEffect(() => {
    window.sessionStorage.setItem(VISIT_STORAGE_KEY, JSON.stringify(visitFields));
  }, [visitFields]);
  useEffect(() => {
    // Syncs an external navigation prop (initialView) into local dialog state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (initialView === "privacy") setPrivacyOpen(true);
  }, [initialView]);
  useEffect(() => {
    // Only relevant while a Health Timeline "View study" cross-link is
    // resolving; leaving Imaging any other way clears it, so a later plain
    // sidebar-nav visit starts at the modality browser, not the old study.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (view !== "imaging") setPendingImagingStudyId(null);
  }, [view]);
  useEffect(() => {
    if (initialAction !== "upload" || initialValidView !== "documents") return;
    const timer = window.setTimeout(() => fileInput.current?.click(), 300);
    return () => window.clearTimeout(timer);
  }, [initialAction, initialValidView]);
  useEffect(() => {
    if (initialAction !== "sample" || initialValidView !== "documents") return;
    const timer = window.setTimeout(() => {
      void runSyntheticDocumentDemo();
    }, 250);
    return () => window.clearTimeout(timer);
    // Portfolio one-click: landing CTA loads the three-date synthetic walkthrough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAction, initialValidView]);
  useEffect(() => {
    if (view === "labs") void loadLabs(selectedLabCode);
    if (view === "labs" || view === "visit") void loadLabSummary();
    if (view === "documents") void loadRecentSessions();
    if (view === "system") void loadSystemStatus();
  }, [view, selectedLabCode]);
  useEffect(() => {
    if (!mobileNavOpen) return;
    const closeOnEscape = (event: globalThis.KeyboardEvent) => { if (event.key === "Escape") setMobileNavOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileNavOpen]);

  async function checkHealth() {
    try { const response = await fetch(`${API_URL}/api/health`); if (!response.ok) throw new Error(); setHealth(await response.json()); }
    catch { setHealth({ status: "unavailable", ready: 0, total: 10, statuses: {} }); }
  }

  async function loadLibrary() {
    try { const response = await fetch(`${API_URL}/api/knowledge`); if (!response.ok) throw new Error(); const data = await response.json(); setLibrary(data.sources || []); }
    catch { setLibrary([]); }
  }

  async function loadLabs(testCode: string) {
    try {
      const [testsRes, timelineRes] = await Promise.all([
        fetch(`${API_URL}/api/labs/tests`),
        fetch(`${API_URL}/api/labs/timeline/${encodeURIComponent(testCode)}`),
      ]);
      if (testsRes.ok) {
        const data = await testsRes.json();
        setLabTests(data.tests || []);
      }
      if (timelineRes.ok) {
        const data = await timelineRes.json();
        setLabPoints(data.points || []);
      } else {
        setLabPoints([]);
      }
    } catch {
      setLabTests([]);
      setLabPoints([]);
    }
  }

  async function loadLabSummary() {
    try {
      const response = await fetch(`${API_URL}/api/labs/summary`);
      if (!response.ok) throw new Error();
      const data = await response.json();
      setLabSummary(data.points || []);
    } catch {
      setLabSummary([]);
    }
  }

  async function loadRecentSessions() {
    try {
      const response = await fetch(`${API_URL}/api/documents/v2/sessions`);
      if (!response.ok) throw new Error();
      const data = await response.json();
      setRecentSessions(data.sessions || []);
    } catch {
      setRecentSessions([]);
    }
  }

  async function loadSystemStatus() {
    try {
      const response = await fetch(`${API_URL}/api/system/status`);
      if (!response.ok) throw new Error();
      setSystemStatus(await response.json());
    } catch {
      setSystemStatus(null);
    }
  }

  async function sendQuestion(event?: FormEvent, preset?: string) {
    event?.preventDefault();
    const text = (preset ?? question).trim();
    if (!text || loadingStage) return;
    setView("conversation"); setQuestion(""); setError(""); setLoadingStage("Checking safety...");
    const nextHistory = [...messages, { role: "user" as const, content: text }];
    setMessages(nextHistory); setAnswer(""); setAnswerStatus(""); setSources([]);
    try {
      const response = await fetch(`${API_URL}/api/chat/stream`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text, history: messages, answer_detail: answerDetail, reading_level: readingLevel }) });
      if (!response.ok || !response.body) { const data = await response.json().catch(() => ({})); throw new Error(data.detail || "The local AI service is unavailable."); }
      let finalAnswer = ""; let finalSources: Source[] = []; let finalStatus: AnswerStatus = "answered";
      for await (const event of readSseEvents(response)) {
        if (event.type === "stage") setLoadingStage(event.stage + "...");
        else if (event.type === "sources") { setSources(event.sources); setLoadingStage("Writing a cited answer..."); }
        else if (event.type === "delta") { setStreaming(true); setLoadingStage(""); setAnswer((current) => current + event.text); }
        else if (event.type === "done") { finalAnswer = event.answer; finalSources = event.sources; finalStatus = event.status; }
      }
      setAnswer(finalAnswer || "No answer was returned."); setSources(finalSources); setAnswerStatus(finalStatus);
      setMessages([...nextHistory, { role: "assistant", content: finalAnswer || "" }]);
    } catch (err) {
      if (!API_URL) setError(API_CONFIGURATION_MESSAGE);
      else if (err instanceof Error && err.message && err.message !== "Failed to fetch") setError(err.message);
      else setError("MediGuide could not reach the local AI service.");
      setMessages(messages);
    }
    finally { setLoadingStage(""); setStreaming(false); }
  }

  async function postDocumentUpload(file: File): Promise<DocUploadResult> {
    if (!API_URL) {
      throw new Error("AI service URL is not configured.");
    }

    const formData = new FormData();
    formData.append("file", file);

    let response: Response;
    try {
      response = await fetch(`${API_URL}/api/documents/v2/upload`, {
        method: "POST",
        body: formData,
      });
    } catch {
      throw new Error(
        `Cannot reach the MediGuide API at ${API_URL}. Start FastAPI with: .\\.venv\\Scripts\\python.exe -m uvicorn api:app --host 127.0.0.1 --port 8000 --reload`,
      );
    }

    if (!response.ok) {
      const apiError = await parseApiError(response, "MediGuide could not upload the document.");
      throw new Error(apiError.message);
    }

    return response.json() as Promise<DocUploadResult>;
  }

  async function processDocument(documentId: string): Promise<DocState> {
    if (!API_URL) {
      throw new Error("AI service URL is not configured.");
    }

    const statusLabels: Record<string, string> = {
      uploaded: "Preparing page previews...",
      queued: "Queued for document processing...",
      rendering: "Preparing page previews...",
      extracting: "Reading document text...",
      review_required: "Preparing review...",
      failed: "Document processing failed",
    };

    const pollStatus = window.setInterval(async () => {
      try {
        const statusResponse = await fetch(`${API_URL}/api/documents/v2/${documentId}/status`);
        if (!statusResponse.ok) return;
        const status = (await statusResponse.json()) as { status?: string; filename?: string };
        const label = statusLabels[status.status || ""] || "Processing document...";
        setLoadingStage(label);
        setProcessStage(mapStatusToProcessStage(status.status || "", label));
      } catch {
        /* polling is best-effort */
      }
    }, 1200);
    const pollTimer = pollStatus;

    try {
      const response = await fetchWithTimeout(
        `${API_URL}/api/documents/v2/${documentId}/process`,
        { method: "POST" },
        90_000,
      );

      if (!response.ok) {
        const apiError = await parseApiError(response, "MediGuide could not read this document.");
        throw new Error(apiError.message);
      }

      return response.json() as Promise<DocState>;
    } finally {
      if (pollTimer) window.clearInterval(pollTimer);
    }
  }

  async function loadSampleLabReport(options?: { guided?: boolean }) {
    if (!API_URL) {
      setError(API_CONFIGURATION_MESSAGE);
      setView("documents");
      return;
    }
    try {
      setView("documents");
      setError("");
      setDocErrorKind("");
      if (options?.guided) {
        setDemoGuide("Step 1 of 4 — Verification: Review extracted lab information, then confirm. Synthetic Jan / Apr / Aug 2026 values only.");
      } else {
        setDemoGuide("");
      }
      setLoadingStage("Preparing synthetic reports...");
      const response = await fetchWithTimeout(`${API_URL}/api/documents/v2/sample/lab-report`);
      if (!response.ok) {
        const apiError = await parseApiError(response, "We couldn't prepare the synthetic reports.");
        throw new Error(apiError.message);
      }
      const blob = await response.blob();
      const file = new File([blob], "sample-lab-report.pdf", { type: "application/pdf" });
      setLoadingStage("");
      await uploadDocument(file);
      if (options?.guided) {
        setDemoGuide("Step 1 of 4 — Verification: Review extracted lab information on each page, then confirm. Next: Lab Timeline.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't prepare the synthetic reports.");
      setDocErrorKind("sample");
      setLoadingStage("");
    }
  }

  async function runSyntheticDocumentDemo() {
    await loadSampleLabReport({ guided: true });
  }

  async function uploadDocument(file: File) {
    setView("documents");
    setError("");
    setDocErrorKind("");
    setDocumentDragging(false);
    setDocState(null);
    setDocFields([]);
    setDocConfirmed(false);
    setDocReviewChecked(false);
    setDocExplain(null);
    setDocQuestion("");
    setAddConfirmedLabsHint("");
    setPendingDocId(null);
    setProcessFailed(false);
    setProcessStage("upload");
    setFieldReviewState({});
    setPreviewZoom(1);
    setSourceBreadcrumb("");

    let uploadedId: string | null = null;

    try {
      setLoadingStage("Uploading document...");
      setProcessStage("upload");
      const uploaded = await postDocumentUpload(file);
      uploadedId = uploaded.document_id;
      pushToast("Document uploaded", "success");

      setPendingDocId(uploaded.document_id);
      setDocState({
        document_id: uploaded.document_id,
        filename: uploaded.filename,
        page_count: 0,
        status: "uploaded",
        pages: [],
        fields: [],
        confirmed: false,
      });
      setLoadingStage("File validated · Preparing page previews...");
      setProcessStage("validate");

      const processed = await processDocument(uploaded.document_id);
      setLoadingStage("Reading document text...");
      setProcessStage("read");
      setDocState(processed);
      setDocFields(processed.fields || []);
      setDocSelectedPage(1);
      setProcessStage("extract");
      const initialReview: Record<string, "unverified" | "confirmed" | "corrected" | "rejected"> = {};
      (processed.fields || []).forEach((field) => {
        initialReview[field.field_id] = "unverified";
      });
      setFieldReviewState(initialReview);
      setPendingDocId(null);
      setProcessStage("review");
      setLoadingStage("");
      setProcessStage(null);
      setProcessFailed(false);
      pushToast("Extraction complete — review required", "success");
    } catch (err) {
      setProcessFailed(true);
      setDocErrorKind(uploadedId ? "extract" : "upload");
      if (!API_URL) {
        setError(API_CONFIGURATION_MESSAGE);
      } else if (err instanceof Error && err.message && err.message !== "Failed to fetch") {
        setError(err.message);
      } else if (uploadedId) {
        setError("Your original file is still available. MediGuide could not finish reading its contents.");
      } else {
        setError("MediGuide could not upload this file. The document has not been stored.");
      }
      setLoadingStage("");
      if (!uploadedId) setProcessStage(null);
    }
  }

  async function retryDocumentExtraction() {
    if (!pendingDocId && !docState?.document_id) return;
    const documentId = pendingDocId || docState!.document_id;
    setError("");
    setDocErrorKind("");
    setProcessFailed(false);
    setLoadingStage("Reading document text...");
    setProcessStage("read");
    try {
      const processed = await processDocument(documentId);
      setDocState(processed);
      setDocFields(processed.fields || []);
      setDocSelectedPage(1);
      const initialReview: Record<string, "unverified" | "confirmed" | "corrected" | "rejected"> = {};
      (processed.fields || []).forEach((field) => {
        initialReview[field.field_id] = "unverified";
      });
      setFieldReviewState(initialReview);
      setLoadingStage("");
      setProcessStage(null);
      pushToast("Extraction complete — review required", "success");
    } catch (err) {
      setProcessFailed(true);
      setDocErrorKind("extract");
      setError(
        err instanceof Error && err.message !== "Failed to fetch"
          ? err.message
          : "Your original file is still available. MediGuide could not finish reading its contents.",
      );
      setLoadingStage("");
    }
  }

  async function inspectDocument(documentId: string, pageNumber: number, fieldId?: string) {
    setError("");
    setDocErrorKind("");
    setHighlightedFieldId(fieldId || null);
    setPreviewZoom(1);
    if (demoGuide) {
      setDemoGuide("Step 3 of 4 — Source-page drill-down: The highlighted field is the lab value provenance chain. Optional next: Get AI explanation for approved-source citations.");
    }
    try {
      setLoadingStage("Opening source document...");
      const response = await fetch(`${API_URL}/api/documents/v2/${documentId}`);
      if (response.ok) {
        const data = (await response.json()) as DocState;
        setPendingDocId(data.document_id);
        setDocState(data);
        setDocFields(data.fields || []);
        setDocConfirmed(data.confirmed);
        setDocSelectedPage(pageNumber || 1);
        setDocExplain(null);
        setSourceBreadcrumb(`Documents / ${data.filename || "Document"} / Page ${pageNumber || 1}`);
        setView("documents");
        if (!data.fields?.length && data.status !== "confirmed") {
          setLoadingStage("Reading document text...");
          const processed = await processDocument(documentId);
          setDocState(processed);
          setDocFields(processed.fields || []);
          setDocSelectedPage(pageNumber || 1);
          setSourceBreadcrumb(`Documents / ${processed.filename || "Document"} / Page ${pageNumber || 1}`);
        }
      } else if (response.status === 404) {
        setError("This document session has expired. Upload the report again to review it in the workspace.");
        setView("documents");
      } else {
        throw new Error("Could not open this document.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open this document.");
      setView("documents");
    } finally {
      setLoadingStage("");
    }
  }

  function prepareVisitFromDocument() {
    const filename = docState?.filename || "my recent lab results";
    setVisitFields({
      ...visitFields,
      "Main concern": visitFields["Main concern"] || `Understanding ${filename} before my appointment`,
      "Questions for clinician": suggestClinicianQuestions(docFields, medFields, labSummary),
    });
    setVisitStep(3);
    handleViewChange("visit");
  }

  function prepareVisitFromMedication() {
    const name = medFields.find((field) => field.key === "name" || field.label.toLowerCase().includes("name"))?.value || "this medication";
    const strength = medFields.find((field) => field.key === "strength" || field.label.toLowerCase().includes("strength"))?.value || "";
    setVisitFields({
      ...visitFields,
      "Medications as entered": [name, strength].filter(Boolean).join(" "),
      "Questions for clinician": suggestClinicianQuestions(docFields, medFields, labSummary),
    });
    setVisitStep(2);
    handleViewChange("visit");
  }

  function addLabsToVisit() {
    const latest = labSummary.length ? labSummary : labPoints;
    if (!latest.length) {
      handleViewChange("visit");
      return;
    }
    setVisitFields({
      ...visitFields,
      "Main concern": visitFields["Main concern"] || "Understanding my recent lab results before my appointment",
      "Questions for clinician": suggestClinicianQuestions(docFields, medFields, latest),
    });
    setVisitStep(3);
    handleViewChange("visit");
  }

  function exportLabPoints() {
    const rows = [
      ["Test", "Value", "Unit", "Date", "Document", "Page", "Verification", "Change"],
      ...labPoints.map((point) => [
        point.test_name,
        point.value_text,
        point.unit,
        point.report_date || "",
        point.document_name,
        String(point.page_number),
        point.verification_state,
        point.change_from_previous == null ? "" : String(point.change_from_previous),
      ]),
    ];
    downloadCsv(`mediguide-${selectedLabCode}-timeline.csv`, rows);
  }

  function exportDocumentFields() {
    const rows = [
      ["Label", "Value", "Unit", "Reference range", "Status", "Page"],
      ...docFields.map((field) => [field.label, field.value, field.unit, field.reference_range, field.status, String(field.page_number)]),
    ];
    downloadCsv(`${docState?.filename || "document"}-extracted-fields.csv`, rows);
  }

  function askAboutDocument() {
    const lines = docFields.filter((field) => field.value).slice(0, 8).map((field) => `${field.label}: ${field.value} ${field.unit}`.trim());
    setQuestion(`Help me prepare questions about these confirmed document values:\n\n${lines.join("\n")}`);
    handleViewChange("conversation");
  }

  function suggestDocumentQuestions() {
    const suggested = suggestClinicianQuestions(docFields, medFields, labSummary);
    setDocQuestion(suggested);
  }

  function askAboutLabs() {
    const latest = labSummary.length ? labSummary : labPoints;
    const lines = latest.map((point) => `${point.test_name}: ${point.value_text} ${point.unit}${point.report_date ? ` (${point.report_date})` : ""}`);
    setQuestion(`Help me understand these verified lab observations educationally:\n\n${lines.join("\n")}`);
    handleViewChange("conversation");
  }

  function confirmTranscript() {
    if (!transcriptReviewed || !pendingTranscript.trim()) return;
    setQuestion(pendingTranscript.trim());
    setPendingTranscript("");
    setTranscriptReviewed(false);
  }

  async function deleteLabObservation(observationId: string) {
    try {
      const response = await fetch(`${API_URL}/api/labs/observations/${observationId}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Could not delete this observation.");
      setSelectedLabPoint(null);
      setConfirmDeleteObservationId(null);
      await loadLabs(selectedLabCode);
      await loadLabSummary();
      pushToast("Result removed from timeline", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete this observation.");
      pushToast("Could not delete this result", "error");
    }
  }

  function updateDocField(fieldId: string, patch: Partial<Pick<DocField, "value" | "unit" | "reference_range">>) {
    setDocFields((current) => current.map((field) => (field.field_id === fieldId ? { ...field, ...patch, user_edited: true } : field)));
    setFieldReviewState((current) => ({ ...current, [fieldId]: "corrected" }));
  }

  function openLabTimeline(testCode?: string) {
    if (testCode) setSelectedLabCode(testCode);
    setSelectedLabPoint(null);
    handleViewChange("labs");
    void loadLabs(testCode || selectedLabCode);
    void loadLabSummary();
  }

  async function confirmDocument() {
    if (!docState || !docReviewChecked || !docFields.length) return;
    setError(""); setDocErrorKind(""); setLoadingStage("Saving your reviewed values...");
    try {
      const response = await fetch(`${API_URL}/api/documents/v2/${docState.document_id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: docFields, reviewed_names_values_units_dates: true }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error?.message || data.detail || "Could not confirm this document.");
      setDocFields(data.fields || docFields); setDocConfirmed(true);
      pushToast("Results confirmed", "success");
      const labCount = data.persistence?.lab_observation_count ?? 0;
      const trackedCodes = (data.persistence?.tracked_test_codes as string[] | undefined) || [];
      setConfirmedLabCodes(trackedCodes);
      if (labCount > 0) {
        setAddConfirmedLabsHint(`${labCount} lab observation${labCount === 1 ? "" : "s"} saved to your lab timeline.`);
        if (trackedCodes.length) setSelectedLabCode(trackedCodes.includes("hemoglobin_a1c") ? "hemoglobin_a1c" : trackedCodes[0]);
        void loadLabs(trackedCodes.includes("hemoglobin_a1c") ? "hemoglobin_a1c" : trackedCodes[0] || selectedLabCode);
        void loadLabSummary();
        void loadRecentSessions();
        if (demoGuide) {
          setDemoGuide("Step 2 of 4 — Lab Timeline: Open Lab Timeline, click 6.7%, then View source page. Optional next: Get AI explanation for approved-source citations.");
        }
      } else {
        setAddConfirmedLabsHint("");
        setConfirmedLabCodes([]);
      }
      if (data.persistence && data.persistence.persisted === false) {
        setError("Values were confirmed in this session, but the lab timeline could not be updated. Check System status, then try confirming again.");
        setDocErrorKind("confirm");
      }
    } catch (err) {
      setDocErrorKind("confirm");
      if (!API_URL) setError(API_CONFIGURATION_MESSAGE);
      else if (err instanceof Error && err.message && err.message !== "Failed to fetch") setError(err.message);
      else setError("Document confirmation is unavailable right now. Check System status, then try again.");
    } finally {
      setLoadingStage("");
    }
  }

  async function explainDocument() {
    if (!docState || !docConfirmed) return;
    setError(""); setDocErrorKind(""); setDocExplain(null); setLoadingStage("Finding evidence and writing an explanation...");
    try {
      const response = await fetch(`${API_URL}/api/documents/v2/${docState.document_id}/explain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: docQuestion.trim() || undefined }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Could not generate an explanation.");
      setDocExplain(data);
      if (demoGuide) {
        setDemoGuide("Step 4 of 4 — Source Evidence: Citations in the explanation link to approved educational sources. Lab values still drill back to the original report page.");
      }
    } catch (err) {
      setDocErrorKind("explain");
      if (!API_URL) setError(API_CONFIGURATION_MESSAGE);
      else if (err instanceof Error && err.message && err.message !== "Failed to fetch") setError(err.message);
      else setError("Document explanation is unavailable right now. Check System status, then try again.");
    } finally {
      setLoadingStage("");
    }
  }

  function resetDocument() {
    setDocState(null); setDocFields([]); setDocConfirmed(false); setDocReviewChecked(false); setDocExplain(null); setDocQuestion(""); setDocSelectedPage(1); setError(""); setDocErrorKind(""); setAddConfirmedLabsHint(""); setConfirmedLabCodes([]); setPendingDocId(null); setHighlightedFieldId(null);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) { event.preventDefault(); setDocumentDragging(false); const file = event.dataTransfer.files[0]; if (file) void uploadDocument(file); }
  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    console.log("Selected file:", { name: file.name, type: file.type, size: file.size });
    void uploadDocument(file);
    event.target.value = "";
  }

  function resetMedication() {
    setMedState(null); setMedFields([]); setMedConfirmed(false); setMedReviewChecked(false); setMedInfo(null); setMedQuestion(""); setMedTypedText(""); setError("");
  }

  async function uploadMedication(file: File) {
    setView("medication"); setError(""); setMedDragging(false);
    resetMedication();
    setLoadingStage("Reading the medication label...");
    const form = new FormData(); form.append("file", file);
    try {
      const response = await fetch(`${API_URL}/api/medications/v2/upload`, { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Label analysis failed.");
      setMedState(data); setMedFields(data.fields || []);
    } catch (err) {
      if (!API_URL) setError(API_CONFIGURATION_MESSAGE);
      else if (err instanceof Error && err.message && err.message !== "Failed to fetch") setError(err.message);
      else setError("MediGuide could not read that label. Check the file and try again.");
    } finally {
      setLoadingStage("");
    }
  }

  async function submitTypedMedication(text: string) {
    if (!text.trim()) return;
    setView("medication"); setError("");
    setMedState(null); setMedFields([]); setMedConfirmed(false); setMedReviewChecked(false); setMedInfo(null); setMedQuestion("");
    setLoadingStage("Reading the medication label text...");
    try {
      const response = await fetch(`${API_URL}/api/medications/v2/text`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Label analysis failed.");
      setMedState(data); setMedFields(data.fields || []);
    } catch (err) {
      if (!API_URL) setError(API_CONFIGURATION_MESSAGE);
      else if (err instanceof Error && err.message && err.message !== "Failed to fetch") setError(err.message);
      else setError("MediGuide could not read that label text. Please try again.");
    } finally {
      setLoadingStage("");
    }
  }

  function updateMedField(key: string, value: string) {
    setMedFields((current) => current.map((field) => (field.key === key ? { ...field, value, user_edited: true } : field)));
  }

  async function confirmMedication() {
    if (!medState || !medReviewChecked || !medFields.length) return;
    setError(""); setLoadingStage("Saving your reviewed details...");
    try {
      const response = await fetch(`${API_URL}/api/medications/v2/${medState.medication_id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: medFields, reviewed_name_strength_instructions: true }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Could not confirm this medication.");
      setMedFields(data.fields || medFields); setMedConfirmed(true);
    } catch (err) {
      if (!API_URL) setError(API_CONFIGURATION_MESSAGE);
      else if (err instanceof Error && err.message && err.message !== "Failed to fetch") setError(err.message);
      else setError("MediGuide could not confirm this medication. Please try again.");
    } finally {
      setLoadingStage("");
    }
  }

  async function getMedicationInfo() {
    if (!medState || !medConfirmed) return;
    setError(""); setMedInfo(null); setLoadingStage("Finding evidence and writing educational information...");
    try {
      const response = await fetch(`${API_URL}/api/medications/v2/${medState.medication_id}/info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: medQuestion.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Could not generate medication information.");
      setMedInfo(data);
    } catch (err) {
      if (!API_URL) setError(API_CONFIGURATION_MESSAGE);
      else if (err instanceof Error && err.message && err.message !== "Failed to fetch") setError(err.message);
      else setError("MediGuide could not generate information for this medication.");
    } finally {
      setLoadingStage("");
    }
  }

  function onMedDrop(event: DragEvent<HTMLDivElement>) { event.preventDefault(); setMedDragging(false); const file = event.dataTransfer.files[0]; if (file) void uploadMedication(file); }
  function onMedFileChange(event: ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; if (file) void uploadMedication(file); }

  async function toggleVoice() {
    if (recording) { recorder.current?.stop(); setRecording(false); setLoadingStage("Creating transcript..."); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); const next = new MediaRecorder(stream); audioChunks.current = [];
      next.ondataavailable = (event) => audioChunks.current.push(event.data);
        next.onstop = async () => {
          stream.getTracks().forEach((track) => track.stop());
          const form = new FormData();
          form.append("file", new Blob(audioChunks.current, { type: "audio/webm" }), "question.webm");
          try {
            const response = await fetch(`${API_URL}/api/transcribe`, { method: "POST", body: form });
            const data = await response.json();
            if (!response.ok) throw new Error();
            setPendingTranscript(data.text || "");
            setTranscriptReviewed(false);
            setView("conversation");
          } catch {
            setError("MediGuide could not create a transcript. Your audio was not sent.");
          } finally {
            setLoadingStage("");
          }
        };
      recorder.current = next; next.start(); setRecording(true); setLoadingStage("Listening locally...");
    } catch { setError("Microphone access was not available. Your question has not been sent."); }
  }

  function handleComposerKey(event: KeyboardEvent<HTMLTextAreaElement>) { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendQuestion(); } }
  function clearSession() { setMessages([]); setAnswer(""); setAnswerStatus(""); setQuestion(""); setSources([]); resetDocument(); resetMedication(); setView("conversation"); }
  function retry() { const last = [...messages].reverse().find((item) => item.role === "user"); if (last) void sendQuestion(undefined, last.content); }
  function copyAnswer() { if (answer) void navigator.clipboard?.writeText(answer); }
  function readAnswer() { if (!answer) return; void fetch(`${API_URL}/api/speak`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: answer.replace(/[#*_\[\]]/g, "") }) }).then(async (response) => { if (!response.ok) throw new Error(); const audio = new Audio(URL.createObjectURL(await response.blob())); await audio.play(); }).catch(() => setError("Spoken output is unavailable right now.")); }
  async function translateAnswer(target: string) { if (!answer) return; setLoadingStage(`Translating to ${target}...`); try { const response = await fetch(`${API_URL}/api/translate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: answer, language: target }) }); const data = await response.json(); if (!response.ok) throw new Error(); setAnswer(data.text || answer); setLanguage(target); } catch { setError("MediGuide could not translate this answer right now."); } finally { setLoadingStage(""); } }
  function generateVisitSummary() { const summary = Object.entries(visitFields).filter(([, value]) => value.trim()).map(([key, value]) => `${key}: ${value}`).join("\n\n"); setQuestion(`Help me prepare questions for a healthcare professional using these patient-provided notes:\n\n${summary}`); setView("conversation"); }

  const handleViewChange = (nextView: View) => { setView(nextView); setMobileNavOpen(false); };

  function openDocumentPage(pageNumber: number) {
    setDocSelectedPage(pageNumber);
    handleViewChange("documents");
  }

  function retryDocumentAction() {
    if (docErrorKind === "extract") void retryDocumentExtraction();
    else if (docErrorKind === "confirm") void confirmDocument();
    else if (docErrorKind === "explain") void explainDocument();
    else if (docErrorKind === "sample") void loadSampleLabReport({ guided: demoGuide !== "" });
    else fileInput.current?.click();
  }

  function loadDemoCbc() {
    const pages = [{ page_number: 1, preview_url: "", text_available: true, extracted_field_count: DEMO_CBC_FIELDS.length }];
    setDocState({ document_id: "demo-cbc", filename: "Sample_CBC.pdf", page_count: 1, status: "extracted", pages, fields: [...DEMO_CBC_FIELDS], confirmed: false });
    setDocFields([...DEMO_CBC_FIELDS]); setDocConfirmed(false); setDocReviewChecked(false); setDocExplain(null); setDocQuestion(""); setDocSelectedPage(1); setAddConfirmedLabsHint(""); setError(""); setDocErrorKind("");
    handleViewChange("documents");
  }

  function loadDemoMedication() {
    const fields: MedField[] = [
      { key: "name", label: "Medication name", value: DEMO_MEDICATION.name, confidence: "clearly_visible", source_text: DEMO_MEDICATION.name, user_edited: false },
      { key: "strength", label: "Strength", value: DEMO_MEDICATION.strength, confidence: "clearly_visible", source_text: DEMO_MEDICATION.strength, user_edited: false },
      { key: "instructions", label: "Instructions", value: DEMO_MEDICATION.instructions, confidence: "clearly_visible", source_text: DEMO_MEDICATION.instructions, user_edited: false },
      { key: "warnings", label: "Warnings", value: DEMO_MEDICATION.warnings, confidence: "needs_review", source_text: DEMO_MEDICATION.warnings, user_edited: false },
    ];
    setMedState({ medication_id: "demo-med", source: "typed", filename: "Sample medication", preview_url: "", status: "extracted", fields, other_visible_text: "", confirmed: false });
    setMedFields(fields); setMedConfirmed(false); setMedReviewChecked(false); setMedInfo(null); setMedQuestion(""); setError("");
    handleViewChange("medication");
  }

  const docEvidenceSources: Source[] = (docExplain?.sources || []).map((source) => ({ number: source.citation_number, title: source.title, publisher: source.publisher, url: source.source_url, passage: source.passage }));
  const medEvidenceSources: Source[] = (medInfo?.sources || []).map((source) => ({ number: source.citation_number, title: source.title, publisher: source.publisher, url: source.source_url, passage: source.passage }));
  const evidenceSources = view === "documents" && docExplain ? docEvidenceSources : view === "medication" && medInfo ? medEvidenceSources : sources;
  const evidenceContext = view === "documents" && !docExplain ? "document-review" : view === "documents" && docExplain ? "explaining" : view === "medication" && medInfo ? "explaining" : sources.length ? "chat" : "idle";
  return <main className="product-shell workspace-enter"><header className="app-header"><button className="app-brand" onClick={() => router.push('/')} aria-label="MediGuide home"><BrandLogo variant="mark" className="brand-logo-header" /></button><button className="quiet-button header-home" type="button" onClick={() => router.push('/')}>Home</button><span className="header-context">Health Document Intelligence</span><div className="header-actions"><select className="language-select" value={language} onChange={(event) => void translateAnswer(event.target.value)} aria-label="Response language"><option>English</option><option>Spanish</option><option>French</option></select><button className="local-pill" onClick={() => setHealthOpen(true)}><span /> Service status</button><button className="icon-button" title="Help" aria-label="Help" onClick={() => setHelpOpen(true)}><HelpCircle size={18} /></button><button className="icon-button" title="Settings" aria-label="Settings" onClick={() => setSettingsOpen(true)}><Settings size={18} /></button><button className="profile-button" title="Privacy" aria-label="Privacy" onClick={() => setPrivacyOpen(true)}><UserRound size={17} /></button></div><button className="mobile-menu icon-button" title="Open navigation" aria-label="Open navigation" aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen(true)}><Menu size={20} /></button></header>{mobileNavOpen && <button className="mobile-nav-backdrop" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}<div className={mobileNavOpen ? "workspace-grid mobile-nav-visible" : "workspace-grid"}><Sidebar view={view} setView={handleViewChange} onNew={() => { clearSession(); setMobileNavOpen(false); }} onPrivacy={() => { setPrivacyOpen(true); setMobileNavOpen(false); }} onClose={() => setMobileNavOpen(false)} /><section className="main-panel">{view === "conversation" && <Conversation answer={answer} status={answerStatus} streaming={streaming} sources={sources} question={question} messages={messages} loading={loadingStage} error={error} selectedSource={selectedSource} setSelectedSource={setSelectedSource} onRetry={retry} onPreset={(prompt) => setQuestion(prompt)} onOpenView={handleViewChange} onOpenDocumentPage={openDocumentPage} onUpload={() => fileInput.current?.click()} onAction={(action) => { if (action === "copy") copyAnswer(); if (action === "listen") readAnswer(); if (action === "simple") void sendQuestion(undefined, `Explain this answer simply:\n\n${answer}`); if (action === "questions") { setQuestion("What questions should I ask my clinician about this?"); } }} />}{view === "documents" && <Documents apiUrl={API_URL} docState={docState} docFields={docFields} docConfirmed={docConfirmed} docReviewChecked={docReviewChecked} setDocReviewChecked={setDocReviewChecked} docSelectedPage={docSelectedPage} setDocSelectedPage={setDocSelectedPage} highlightedFieldId={highlightedFieldId} setHighlightedFieldId={setHighlightedFieldId} docExplain={docExplain} docQuestion={docQuestion} setDocQuestion={setDocQuestion} selectedSource={selectedSource} setSelectedSource={setSelectedSource} dragging={documentDragging} recentSessions={recentSessions} onOpenSession={(documentId) => void inspectDocument(documentId, 1)} onUpload={() => fileInput.current?.click()} onLoadSample={() => void loadSampleLabReport()} demoGuide={demoGuide} onOpenLabsFromDemo={() => { setDemoGuide("Step 2 of 4 — Lab Timeline: Click a measurement (try 6.7%), then View source page."); handleViewChange("labs"); }} onDrop={onDrop} onDragEnter={() => setDocumentDragging(true)} onDragLeave={() => setDocumentDragging(false)} onFieldChange={updateDocField} onConfirm={() => void confirmDocument()} onExplain={() => void explainDocument()} onSuggestQuestions={suggestDocumentQuestions} onPrepareVisit={prepareVisitFromDocument} onAskAbout={askAboutDocument} onExportFields={exportDocumentFields} onOpenLabs={() => openLabTimeline(confirmedLabCodes[0])} onReset={() => setConfirmResetDocument(true)} loading={loadingStage} error={error} errorKind={docErrorKind} labsHint={addConfirmedLabsHint} confirmedLabCodes={confirmedLabCodes} onRetry={retryDocumentAction} onSystem={() => handleViewChange("system")} onRemove={() => setConfirmResetDocument(true)} processStage={processStage} processFailed={processFailed} fieldReviewState={fieldReviewState} setFieldReviewState={setFieldReviewState} previewZoom={previewZoom} setPreviewZoom={setPreviewZoom} sourceBreadcrumb={sourceBreadcrumb} onClearBreadcrumb={() => setSourceBreadcrumb("")} onBackToTimeline={() => handleViewChange("labs")} />}{view === "labs" && <LabTimeline tests={labTests} selectedCode={selectedLabCode} onSelectCode={(code) => { setSelectedLabCode(code); setSelectedLabPoint(null); }} points={labPoints} selectedPoint={selectedLabPoint} onSelectPoint={setSelectedLabPoint} onInspectDocument={(documentId, pageNumber, fieldId) => void inspectDocument(documentId, pageNumber, fieldId)} onExport={exportLabPoints} onAddToVisit={addLabsToVisit} onAskAbout={askAboutLabs} onRequestDeleteObservation={(observationId) => setConfirmDeleteObservationId(observationId)} onOpenDocuments={() => handleViewChange("documents")} />}{view === "timeline" && <HealthTimeline apiUrl={API_URL} onOpenDocument={(documentId) => void inspectDocument(documentId, 1)} onOpenImagingStudy={(studyId) => { setPendingImagingStudyId(studyId); handleViewChange("imaging"); }} />}{view === "imaging" && <ImagingWorkspace apiUrl={API_URL} pushToast={pushToast} openStudyId={pendingImagingStudyId} />}{view === "medication" && <Medication apiUrl={API_URL} medState={medState} medFields={medFields} medConfirmed={medConfirmed} medReviewChecked={medReviewChecked} setMedReviewChecked={setMedReviewChecked} medInfo={medInfo} medQuestion={medQuestion} setMedQuestion={setMedQuestion} medTypedText={medTypedText} setMedTypedText={setMedTypedText} selectedSource={selectedSource} setSelectedSource={setSelectedSource} dragging={medDragging} onUpload={() => medFileInput.current?.click()} onDrop={onMedDrop} onDragEnter={() => setMedDragging(true)} onDragLeave={() => setMedDragging(false)} onFieldChange={updateMedField} onConfirm={() => void confirmMedication()} onGetInfo={() => void getMedicationInfo()} onSubmitTyped={() => void submitTypedMedication(medTypedText)} onSample={loadDemoMedication} onPrepareVisit={prepareVisitFromMedication} onReset={resetMedication} loading={loadingStage} error={error} />}{view === "visit" && <Visit fields={visitFields} setFields={setVisitFields} step={visitStep} setStep={setVisitStep} labPoints={labSummary.length ? labSummary : labPoints} medFields={medFields} onGenerate={generateVisitSummary} />}{view === "sources" && <Sources sources={sources} library={library} onSelect={setSelectedSource} />}{view === "demo" && <DemoMode onSyntheticPipeline={() => void runSyntheticDocumentDemo()} onSampleMedication={loadDemoMedication} onSampleVoice={() => { setQuestion(DEMO_VOICE_QUESTION); handleViewChange("conversation"); }} onSampleVisit={() => { setVisitFields({ ...DEMO_VISIT }); setVisitStep(4); handleViewChange("visit"); }} />}{view === "evaluation" && <EvaluationDashboard />}{view === "system" && <SystemStatusView status={systemStatus} health={health} onRetry={() => { void checkHealth(); void loadSystemStatus(); }} />}{view !== "documents" && view !== "medication" && view !== "visit" && view !== "labs" && view !== "imaging" && view !== "timeline" && view !== "system" && view !== "demo" && view !== "evaluation" && <>
          {pendingTranscript && <TranscriptReview text={pendingTranscript} setText={setPendingTranscript} reviewed={transcriptReviewed} setReviewed={setTranscriptReviewed} onConfirm={confirmTranscript} onDiscard={() => { setPendingTranscript(""); setTranscriptReviewed(false); }} />}
          <Composer question={question} setQuestion={setQuestion} onSubmit={sendQuestion} onKeyDown={handleComposerKey} onUpload={() => fileInput.current?.click()} onVoice={toggleVoice} recording={recording} loading={Boolean(loadingStage)} answerDetail={answerDetail} setAnswerDetail={setAnswerDetail} readingLevel={readingLevel} setReadingLevel={setReadingLevel} />
        </>}<input ref={fileInput} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,image/*" hidden onChange={onFileChange} /><input ref={medFileInput} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,image/*" hidden onChange={onMedFileChange} /></section><Evidence sources={evidenceSources} selected={selectedSource} onSelect={setSelectedSource} context={evidenceContext} onOpenSources={() => handleViewChange("sources")} /></div>
      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((current) => current.filter((item) => item.id !== id))} />
      <ConfirmDialog
        open={Boolean(confirmDeleteObservationId)}
        title="Delete this result?"
        body="This removes the timeline observation only. The source document stays available until you clear it separately."
        confirmLabel="Delete result"
        destructive
        onCancel={() => setConfirmDeleteObservationId(null)}
        onConfirm={() => { if (confirmDeleteObservationId) void deleteLabObservation(confirmDeleteObservationId); }}
      />
      <ConfirmDialog
        open={confirmResetDocument}
        title="Clear this document?"
        body="This will remove the uploaded document and associated extracted information from the current MediGuide session."
        confirmLabel="Delete document"
        destructive
        onCancel={() => setConfirmResetDocument(false)}
        onConfirm={() => { setConfirmResetDocument(false); resetDocument(); pushToast("Document cleared from session", "info"); }}
      />
      {privacyOpen && <Privacy onClose={() => setPrivacyOpen(false)} onClear={clearSession} />}{helpOpen && <HelpDrawer onClose={() => setHelpOpen(false)} onOpenView={(next) => { setHelpOpen(false); handleViewChange(next); }} />}{settingsOpen && <SettingsDrawer answerDetail={answerDetail} setAnswerDetail={setAnswerDetail} readingLevel={readingLevel} setReadingLevel={setReadingLevel} language={language} setLanguage={setLanguage} onClose={() => setSettingsOpen(false)} />}{healthOpen && <Health health={health} onClose={() => setHealthOpen(false)} onRetry={checkHealth} />}</main>;
}

/* Legacy landing markup retained for reference; PremiumLanding is the public entry point. */

function ServiceError({ title, message, onRetry, onSystem }: { title: string; message: string; onRetry?: () => void; onSystem?: () => void }) {
  return <div className="service-error"><Activity size={19} /><div><strong>{title}</strong><p>{message}</p></div><div className="service-error-actions">{onRetry && <button type="button" onClick={onRetry}><RefreshCw size={15} /> Retry</button>}{onSystem && <button type="button" onClick={onSystem}><Activity size={15} /> System status</button>}</div></div>;
}

function Sidebar({ view, setView, onNew, onPrivacy, onClose }: { view: View; setView: (view: View) => void; onNew: () => void; onPrivacy: () => void; onClose: () => void }) {
  const item = (target: View, label: string, Icon: LucideIcon) => (
    <button className={view === target ? "nav-item active" : "nav-item"} onClick={() => setView(target)}>
      <Icon size={17} />{label}
    </button>
  );
  return (
    <aside className="sidebar workspace-sidebar">
      <div className="mobile-sidebar-head">
        <span>Navigate</span>
        <button className="icon-button" title="Close navigation" aria-label="Close navigation" onClick={onClose}><X size={18} /></button>
      </div>
      <div className="sidebar-brand-block">
        <BrandLogo variant="wordmark" className="brand-logo-sidebar" />
      </div>
      <button className="new-conversation" onClick={onNew}><Plus size={17} /> New</button>
      <button className={view === "demo" ? "nav-item demo-nav-cta active" : "nav-item demo-nav-cta"} onClick={() => setView("demo")}>
        <PlayCircle size={17} /> Try synthetic data
      </button>
      <div className="sidebar-label">WORKSPACE</div>
      <nav>
        {item("timeline", "Health Timeline", Milestone)}
        {item("documents", "Documents", FileText)}
        {item("labs", "Lab Timeline", FlaskConical)}
        {item("imaging", "Imaging", ScanLine)}
        {item("medication", "Medications", Pill)}
        {item("visit", "Visit Preparation", Stethoscope)}
        {item("conversation", "Ask MediGuide", HomeIcon)}
      </nav>
      <div className="sidebar-label knowledge-label">KNOWLEDGE</div>
      <nav>
        {item("sources", "Sources", BookOpen)}
      </nav>
      <div className="sidebar-label knowledge-label">SYSTEM</div>
      <nav>
        <button className="nav-item" onClick={onPrivacy}><ShieldCheck size={17} /> Privacy</button>
        {item("system", "System Status", Activity)}
      </nav>
      <div className="sidebar-footer">
        <span className="status-dot" />
        <div>
          <strong>Document → Source</strong>
          <small>Verify, timeline, then trace</small>
        </div>
      </div>
    </aside>
  );
}

function Conversation({ answer, status, streaming, sources, messages, loading, error, selectedSource, setSelectedSource, onRetry, onPreset, onOpenView, onOpenDocumentPage, onUpload, onAction }: { answer: string; status: AnswerStatus; streaming: boolean; sources: Source[]; question: string; messages: Message[]; loading: string; error: string; selectedSource: number | null; setSelectedSource: (value: number | null) => void; onRetry: () => void; onPreset: (prompt: string) => void; onOpenView: (view: View) => void; onOpenDocumentPage: (page: number) => void; onUpload: () => void; onAction: (action: "copy" | "listen" | "simple" | "questions") => void }) {
  const lastQuestion = [...messages].reverse().find((item) => item.role === "user");
  const empty = !answer && !loading && !lastQuestion;
  return <div className="conversation-view">
    <div className="conversation-header">
      <div>
        <p className="eyebrow">EDUCATIONAL SUPPORT</p>
        <h2>{answer ? "Your health question, clarified." : "What can I help you understand today?"}</h2>
        {!answer && <p>Ask a health question, review a document, use your voice, or prepare for an appointment — in one workspace.</p>}
      </div>
      <div className="conversation-meta">
        <span className="response-count">{messages.filter((message) => message.role === "user").length} session {messages.filter((message) => message.role === "user").length === 1 ? "question" : "questions"}</span>
        <span className="care-mode"><ShieldCheck size={13} /> Educational support</span>
      </div>
    </div>
    {empty && <div className="capability-rail" aria-label="Workspace capabilities">
      <button type="button" onClick={() => { onPreset("What is diabetes in plain language?"); document.querySelector<HTMLTextAreaElement>(".composer textarea")?.focus(); }}>
        <span className="quick-icon"><BookOpen size={18} /></span>
        <strong>Ask with evidence</strong>
        <small>Try a topic in the approved knowledge base</small>
      </button>
      <button type="button" onClick={() => { onOpenView("documents"); onUpload(); }}>
        <span className="quick-icon"><FileText size={18} /></span>
        <strong>Review a document</strong>
        <small>Verify values before you reason</small>
      </button>
      <button type="button" onClick={() => document.querySelector<HTMLButtonElement>(".composer .voice-trigger")?.click()}>
        <span className="quick-icon"><Mic size={18} /></span>
        <strong>Speak, then confirm</strong>
        <small>Transcript review before sending</small>
      </button>
      <button type="button" onClick={() => onOpenView("visit")}>
        <span className="quick-icon"><Stethoscope size={18} /></span>
        <strong>Prepare for a visit</strong>
        <small>Turn notes into useful questions</small>
      </button>
    </div>}
    {empty && <p className="covered-topics">Demo topics include blood pressure, cholesterol, diabetes, CBC lab tests, medication labels, antibiotics, fever, allergies, and appointment preparation — plus the approved CDC/NIH sources already in the knowledge base.</p>}
    {empty && <div className="topic-chip-row" aria-label="Suggested topics">
      {topicSuggestions.map(([label, prompt]) => (
        <button type="button" key={label} onClick={() => { onPreset(prompt); void (document.querySelector<HTMLTextAreaElement>(".composer textarea")?.focus()); }}>
          {label}
        </button>
      ))}
    </div>}
    {empty && <div className="quick-actions">{quickActions.map(([title, description, Icon, prompt]) => <button key={title} onClick={() => { onPreset(prompt); document.querySelector<HTMLTextAreaElement>(".composer textarea")?.focus(); }}><span className="quick-icon"><Icon size={18} /></span><span><strong>{title}</strong><small>{description}</small></span><ChevronRight size={17} /></button>)}</div>}
    {lastQuestion && <div className="user-question"><span>You asked</span><p>{lastQuestion.content}</p></div>}
    {error && <ServiceError title="Could not reach MediGuide" message={error} onRetry={onRetry} onSystem={() => onOpenView("system")} />}
    {loading && <div className="processing"><Sparkles size={17} /><span>{loading}</span><i /><i /><i /></div>}
    {answer && <Answer answer={answer} status={status} streaming={streaming} sources={sources} selectedSource={selectedSource} setSelectedSource={setSelectedSource} onAction={onAction} onPreset={onPreset} onOpenView={onOpenView} onOpenDocumentPage={onOpenDocumentPage} />}
  </div>;
}

function Answer({ answer, status, streaming, sources, selectedSource, setSelectedSource, onAction, onPreset, onOpenView, onOpenDocumentPage }: { answer: string; status: AnswerStatus; streaming: boolean; sources: Source[]; selectedSource: number | null; setSelectedSource: (value: number | null) => void; onAction: (action: "copy" | "listen" | "simple" | "questions") => void; onPreset: (prompt: string) => void; onOpenView: (view: View) => void; onOpenDocumentPage: (page: number) => void }) {
  const body = answer.split("\n\n---\n")[0];

  if (status === "emergency") {
    return <article className="answer-document emergency-evidence">
      <div className="answer-kicker"><span><Activity size={14} /> MEDIGUIDE</span><small>Emergency signal detected</small></div>
      <div className="limited-evidence-body"><h3>This may be a medical emergency.</h3><p>{body}</p></div>
    </article>;
  }

  if (status === "no_evidence") {
    return <article className="answer-document limited-evidence">
      <div className="answer-kicker"><span><ShieldCheck size={14} /> MEDIGUIDE</span><small>Safety check</small></div>
      <div className="limited-evidence-body">
        <h3>Limited trusted information available</h3>
        <p>MediGuide couldn’t find enough approved source material to answer this question confidently.</p>
        <ul>
          <li>Ask a more specific question</li>
          <li>Review one of the available topics</li>
          <li>Add a trusted source to the knowledge base</li>
        </ul>
        <div className="topic-chip-row">
          {topicSuggestions.map(([label, prompt]) => (
            <button type="button" key={label} onClick={() => {
              if (label === "Prepare for a visit") onOpenView("visit");
              else onPreset(prompt);
            }}>{label}</button>
          ))}
        </div>
      </div>
    </article>;
  }

  if (status === "withheld" || status === "error") {
    return <article className="answer-document withheld-evidence">
      <div className="answer-kicker"><span><ShieldCheck size={14} /> MEDIGUIDE</span><small>{status === "withheld" ? "Answer withheld" : "Service error"}</small></div>
      <div className="limited-evidence-body"><h3>{status === "withheld" ? "This answer could not be safely shown." : "Something went wrong."}</h3><p>{body}</p></div>
    </article>;
  }

  const lines = body.split("\n");
  const renderPart = (part: string, key: string) => {
    const pageMatch = /^\[D(\d+)\]$/.exec(part);
    if (pageMatch) {
      const page = Number(pageMatch[1]);
      return <button type="button" className="doc-citation" onClick={() => onOpenDocumentPage(page)} key={key}>[D{page}]</button>;
    }
    const numbers = /^\[\d+(?:,\s*\d+)*\]$/.test(part) ? part.match(/\d+/g) : null;
    if (!numbers) return part.replace(/^#+\s*/, "");
    return numbers.map((num, index) => (
      <button className={selectedSource === Number(num) ? "citation selected" : "citation"} onClick={() => setSelectedSource(Number(num))} key={`${key}-${index}`}>[{num}]</button>
    ));
  };
  return <article className="answer-document"><div className="answer-kicker"><span><Sparkles size={14} /> MEDIGUIDE</span><small>{streaming ? "Writing..." : "Evidence checked"}</small></div><div className="answer-content">{lines.map((line, index) => { const heading = line.startsWith("#"); const parts = line.split(/(\[D\d+\]|\[\d+(?:,\s*\d+)*\])/g); return <p className={heading ? "answer-heading" : ""} key={index}>{parts.map((part, partIndex) => renderPart(part, `${index}-${partIndex}`))}</p>; })}{streaming && <span className="streaming-cursor" aria-hidden />}</div>{!streaming && <div className="response-actions"><button onClick={() => onAction("copy")}><Clipboard size={14} /> Copy</button><button onClick={() => onAction("listen")}><Volume2 size={14} /> Listen</button><button onClick={() => onAction("simple")}><Sparkles size={14} /> Explain simply</button><button onClick={() => onAction("questions")}><Stethoscope size={14} /> Questions for clinician</button><button onClick={() => setSelectedSource(sources.length ? sources[0].number : null)}><BookOpen size={14} /> Show sources</button></div>}<p className="answer-safety-note"><ShieldCheck size={13} /> General educational information, not a diagnosis or personalized treatment recommendation.</p></article>;
}

function Composer({ question, setQuestion, onSubmit, onKeyDown, onUpload, onVoice, recording, loading, answerDetail, setAnswerDetail, readingLevel, setReadingLevel }: { question: string; setQuestion: (value: string) => void; onSubmit: (event?: FormEvent) => void; onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void; onUpload: () => void; onVoice: () => void; recording: boolean; loading: boolean; answerDetail: "Concise" | "Standard" | "Detailed"; setAnswerDetail: (value: "Concise" | "Standard" | "Detailed") => void; readingLevel: "Standard" | "Plain"; setReadingLevel: (value: "Standard" | "Plain") => void }) {
  return <form className="composer workspace-composer" onSubmit={onSubmit} onDragOver={(event) => event.preventDefault()}>
    <div className="composer-tools">
      <button type="button" onClick={onUpload}><Paperclip size={15} /> Document</button>
      <button type="button" className={recording ? "recording voice-trigger" : "voice-trigger"} onClick={onVoice}><Mic size={15} /> {recording ? "Listening locally" : "Voice"}</button>
      <select className="answer-style-select" value={answerDetail} onChange={(event) => setAnswerDetail(event.target.value as "Concise" | "Standard" | "Detailed")} aria-label="Answer detail">
        <option>Concise</option><option>Standard</option><option>Detailed</option>
      </select>
      <select className="answer-style-select" value={readingLevel} onChange={(event) => setReadingLevel(event.target.value as "Standard" | "Plain")} aria-label="Reading level">
        <option>Standard</option><option>Plain</option>
      </select>
      <span className="composer-privacy"><ShieldCheck size={13} /> Private session</span>
    </div>
    <textarea value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={onKeyDown} placeholder="Ask a health question, review a document, or prepare for a visit…" rows={3} />
    <div className="composer-footer">
      <div>
        <span>Enter to send · Shift + Enter for a new line</span>
      </div>
      <button className="send-button" disabled={loading || !question.trim()} aria-label="Send"><ArrowUp size={20} /></button>
    </div>
  </form>;
}

function Evidence({ sources, selected, onSelect, context = "idle", onOpenSources }: { sources: Source[]; selected: number | null; onSelect: (value: number | null) => void; context?: "idle" | "document-review" | "explaining" | "chat"; onOpenSources?: () => void }) {
  const showKnowledgeNote = context === "explaining" || context === "chat";
  const isExplanation = context === "explaining" || context === "chat";
  const emptyTitle = context === "document-review" ? "Document review in progress" : "Citations appear beside answers";
  const emptyBody = context === "document-review"
    ? "Review extracted values first. Approved sources appear after you confirm and request an explanation."
    : "Trusted evidence used in your answer will appear here.";
  const selectedSource = sources.find((source) => source.number === selected);

  return <aside className="evidence workspace-evidence">
    <div className="evidence-top">
      <div>
        <p className="eyebrow">{isExplanation ? "EXPLANATION PROVENANCE" : "SOURCE EVIDENCE"}</p>
        <h3>{isExplanation ? "Approved knowledge sources" : "Sources & context"}</h3>
      </div>
      <button className="icon-button" title="Browse approved sources" onClick={onOpenSources}><BookOpen size={17} /></button>
    </div>
    {isExplanation && sources.length > 0 && (
      <p className="provenance-chain-note">Plain-language statement → Citation → Approved knowledge source → Source/version</p>
    )}
    {sources.length ? <>
      <div className="support-level"><span>Evidence support</span><strong>{sources.length > 2 ? "STRONG" : sources.length === 2 ? "PARTIAL" : "LIMITED"}</strong></div>
      {sources.map((source) => <button className={selected === source.number ? "source-card selected" : "source-card"} key={source.number} onClick={() => onSelect(source.number)}><span className="source-number">[{source.number}]</span><span><strong>{source.publisher}</strong><b>{source.title}</b><small>{source.reviewed ? `Reviewed ${source.reviewed}` : "Approved knowledge source"}</small><em>{source.url ? "Open source" : "Relevant passage available"} <ArrowUpRight size={12} /></em></span></button>)}
      {selectedSource?.passage && <div className="evidence-passage"><p className="eyebrow">PASSAGE</p><p>{selectedSource.passage}</p></div>}
      {selectedSource?.url && <a className="quiet-button" href={selectedSource.url} target="_blank" rel="noreferrer">Open publisher page <ArrowUpRight size={14} /></a>}
    </> : <div className="evidence-empty">
      <BookOpen size={22} />
      <strong>{emptyTitle}</strong>
      <p>{emptyBody}</p>
      {context !== "document-review" && <ul className="evidence-promise">
        <li><Check size={13} /> Cited answers</li>
        <li><Check size={13} /> Local retrieval</li>
        <li><Check size={13} /> Passage context</li>
      </ul>}
      {onOpenSources && <button type="button" className="quiet-button" onClick={onOpenSources}>Browse knowledge base</button>}
    </div>}
    {showKnowledgeNote && <div className="evidence-note"><ShieldCheck size={16} /><span>Explanation provenance is separate from lab-value provenance — citations support education, not the numeric extraction.</span></div>}
  </aside>;
}

const DOC_STATUS_LABELS: Record<DocFieldStatus, string> = {
  in_listed_range: "",
  outside_listed_range: "",
  flagged_high_on_report: "Flagged high on this report",
  flagged_low_on_report: "Flagged low on this report",
  not_applicable: "",
  unknown: "",
};
const DOC_CONFIDENCE_LABELS: Record<DocFieldConfidence, string> = { clearly_visible: "Clearly visible", needs_review: "Needs review", could_not_read: "Could not read" };

function Documents({
  apiUrl, docState, docFields, docConfirmed, docReviewChecked, setDocReviewChecked,
  docSelectedPage, setDocSelectedPage, highlightedFieldId, setHighlightedFieldId,
  docExplain, docQuestion, setDocQuestion,
  selectedSource, setSelectedSource,
  dragging, recentSessions, onOpenSession, onUpload, onLoadSample, demoGuide, onOpenLabsFromDemo, onDrop, onDragEnter, onDragLeave, onFieldChange, onConfirm, onExplain, onSuggestQuestions, onPrepareVisit, onAskAbout, onExportFields, onOpenLabs, onReset,
  loading, error, errorKind, labsHint, confirmedLabCodes, onRetry, onSystem, onRemove,
  processStage, processFailed, fieldReviewState, setFieldReviewState, previewZoom, setPreviewZoom, sourceBreadcrumb, onClearBreadcrumb, onBackToTimeline,
}: {
  apiUrl: string;
  docState: DocState | null;
  docFields: DocField[];
  docConfirmed: boolean;
  docReviewChecked: boolean;
  setDocReviewChecked: (value: boolean) => void;
  docSelectedPage: number;
  setDocSelectedPage: (value: number) => void;
  highlightedFieldId: string | null;
  setHighlightedFieldId: (value: string | null) => void;
  docExplain: DocExplain | null;
  docQuestion: string;
  setDocQuestion: (value: string) => void;
  selectedSource: number | null;
  setSelectedSource: (value: number | null) => void;
  dragging: boolean;
  recentSessions: DocSession[];
  onOpenSession: (documentId: string) => void;
  onUpload: () => void;
  onLoadSample: () => void;
  demoGuide: string;
  onOpenLabsFromDemo: () => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnter: () => void;
  onDragLeave: () => void;
  onFieldChange: (fieldId: string, patch: Partial<Pick<DocField, "value" | "unit" | "reference_range">>) => void;
  onConfirm: () => void;
  onExplain: () => void;
  onSuggestQuestions: () => void;
  onPrepareVisit: () => void;
  onAskAbout: () => void;
  onExportFields: () => void;
  onOpenLabs: () => void;
  onReset: () => void;
  loading: string;
  error: string;
  errorKind: "upload" | "extract" | "confirm" | "explain" | "sample" | "";
  labsHint: string;
  confirmedLabCodes: string[];
  onRetry: () => void;
  onSystem: () => void;
  onRemove: () => void;
  processStage: ProcessStageId | null;
  processFailed: boolean;
  fieldReviewState: Record<string, "unverified" | "confirmed" | "corrected" | "rejected">;
  setFieldReviewState: (value: Record<string, "unverified" | "confirmed" | "corrected" | "rejected"> | ((prev: Record<string, "unverified" | "confirmed" | "corrected" | "rejected">) => Record<string, "unverified" | "confirmed" | "corrected" | "rejected">)) => void;
  previewZoom: number;
  setPreviewZoom: (value: number) => void;
  sourceBreadcrumb: string;
  onClearBreadcrumb: () => void;
  onBackToTimeline: () => void;
}) {
  const uploadErrorTitle = errorKind === "extract"
    ? "We couldn't finish reading this document"
    : errorKind === "confirm"
      ? "Could not save reviewed values"
      : errorKind === "explain"
        ? "Educational explanation unavailable"
        : errorKind === "sample"
          ? "We couldn't prepare the synthetic reports"
          : "Document upload failed";
  const uploadErrorMessage = errorKind === "sample"
    ? `${error || "We couldn't prepare the synthetic reports."} No personal documents were affected.`
    : error || (errorKind === "extract"
      ? "Your original file is still available."
      : "MediGuide could not upload this file. The document has not been stored.");
  const reviewedCount = docFields.filter((field) => fieldReviewState[field.field_id] && fieldReviewState[field.field_id] !== "unverified").length;

  if (!docState) {
    return <div className="workflow-view">
      <div className="workflow-heading-row">
        <div>
          <p className="eyebrow">DOCUMENTS</p>
          <h2>Documents</h2>
          <p className="workflow-lead">Upload, review, and trace information from your health documents.</p>
        </div>
        <div className="heading-actions">
          <button className="forest-button" type="button" onClick={onUpload}><Plus size={15} /> Upload document</button>
          <button className="quiet-button" type="button" onClick={onLoadSample}>Try synthetic report</button>
        </div>
      </div>
      {!loading && !error && recentSessions.length === 0 && (
        <EmptyState
          title="No documents yet"
          body="Upload a lab report or explore MediGuide with synthetic data."
        >
          <button className="forest-button" type="button" onClick={onUpload}>Upload document</button>
          <button className="quiet-button" type="button" onClick={onLoadSample}>Try synthetic report</button>
        </EmptyState>
      )}
      {!loading && <div className={dragging ? "upload-zone is-dragging" : "upload-zone"} onDrop={onDrop} onDragEnter={(event) => { event.preventDefault(); onDragEnter(); }} onDragOver={(event) => event.preventDefault()} onDragLeave={onDragLeave}>
        <span className="upload-art"><FileText size={25} /><span><ImageIcon size={14} /></span></span>
        <strong>Drop a PDF or image here</strong>
        <span>Lab reports and medication labels · Multi-page supported</span>
        <div className="upload-actions">
          <button className="forest-button" type="button" onClick={onUpload}>Choose file <Paperclip size={16} /></button>
          <button className="quiet-button" type="button" onClick={onLoadSample}>Try synthetic report</button>
        </div>
      </div>}
      {demoGuide && <p className="demo-guide-banner">{demoGuide}</p>}
      {(loading || processStage) && <ProcessingChecklist activeStage={processStage || mapStatusToProcessStage("", loading)} failed={processFailed} />}
      {loading && !processStage && <div className="processing large"><Sparkles size={18} /> {loading}<i /><i /><i /></div>}
      {error && <ServiceError title={uploadErrorTitle} message={uploadErrorMessage} onRetry={onRetry} onSystem={onSystem} />}
      {errorKind === "extract" && error && <div className="explain-actions"><button type="button" className="quiet-button" onClick={onRemove}>Remove document</button></div>}
      {!loading && recentSessions.length > 0 && <div className="document-list">
        <p className="eyebrow">RECENT DOCUMENTS</p>
        <div className="document-table-wrap">
          <table className="document-table">
            <thead>
              <tr>
                <th>Document</th>
                <th>Pages</th>
                <th>Extracted</th>
                <th>Verification</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {recentSessions.map((session) => (
                <tr key={session.document_id}>
                  <td>
                    <button type="button" className="document-table-name" onClick={() => onOpenSession(session.document_id)}>
                      <FileText size={15} />
                      <strong>{session.filename}</strong>
                    </button>
                  </td>
                  <td>{session.page_count || "—"}</td>
                  <td>{session.field_count}</td>
                  <td>{session.confirmed ? "Verified" : "Needs review"}</td>
                  <td><span className={session.confirmed ? "status-chip confirmed" : "status-chip"}>{session.confirmed ? "Ready" : session.status.replaceAll("_", " ")}</span></td>
                  <td><button type="button" className="quiet-button" onClick={() => onOpenSession(session.document_id)}>Open</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>}
    </div>;
  }

  const visibleFields = docFields.filter((field) => field.page_number === docSelectedPage);
  const activePreview = docState.pages.find((page) => page.page_number === docSelectedPage) || docState.pages[0];

  if ((loading || processStage) && !docFields.length) {
    return <div className="workflow-view doc-intel-view">
      <div className="workflow-heading-row">
        <div>
          <p className="eyebrow">DOCUMENTS</p>
          <h2>{docState.filename}</h2>
          <p className="workflow-lead">Processing your document while keeping the original file available.</p>
        </div>
      </div>
      <ProcessingChecklist activeStage={processStage || mapStatusToProcessStage(docState.status, loading)} failed={processFailed} />
      {error && <ServiceError title={uploadErrorTitle} message={uploadErrorMessage} onRetry={onRetry} onSystem={onSystem} />}
      {error && (
        <div className="explain-actions">
          <button type="button" className="quiet-button" onClick={onRetry}>Retry processing</button>
          <button type="button" className="quiet-button" onClick={onRemove}>Remove document</button>
        </div>
      )}
    </div>;
  }

  return <div className="workflow-view doc-intel-view">
    <div className="workflow-heading-row">
      <div>
        <p className="eyebrow">DOCUMENT REVIEW</p>
        <h2>{docState.filename}</h2>
        <p className="workflow-lead">{docState.page_count} page{docState.page_count === 1 ? "" : "s"} · {docConfirmed ? "Confirmed by you" : "Information found in your report — review before confirming"}</p>
      </div>
      <div className="heading-actions">
        {docFields.length > 0 && <button className="quiet-button" onClick={onExportFields}><Clipboard size={14} /> Export fields</button>}
        <button className="quiet-button" onClick={onReset}><Trash2 size={14} /> Delete document</button>
      </div>
    </div>

    {sourceBreadcrumb && (
      <div className="source-breadcrumb" aria-label="Source navigation">
        <span>{sourceBreadcrumb}</span>
        <button type="button" className="quiet-button" onClick={() => { onClearBreadcrumb(); onBackToTimeline(); }}>← Back to Hemoglobin A1C</button>
      </div>
    )}

    {error && (
      <div className="doc-error-recovery">
        <ServiceError title={uploadErrorTitle} message={uploadErrorMessage} onRetry={onRetry} onSystem={onSystem} />
        <div className="explain-actions">
          <button type="button" className="quiet-button" onClick={onRetry}>Retry processing</button>
          <button type="button" className="quiet-button" onClick={onRemove}>Remove document</button>
        </div>
      </div>
    )}
    {(loading || processStage) && <ProcessingChecklist activeStage={processStage || mapStatusToProcessStage(docState.status, loading)} failed={processFailed} />}
    {demoGuide && <p className="demo-guide-banner">{demoGuide}{docConfirmed ? <>{" "}<button type="button" className="quiet-button" onClick={onOpenLabsFromDemo}>Open Lab Timeline</button></> : null}</p>}
    {labsHint && <div className="labs-persist-hint-row">
      <p className="labs-persist-hint"><FlaskConical size={14} /> {labsHint}</p>
      {confirmedLabCodes.length > 0 && <button type="button" className="quiet-button" onClick={onOpenLabs}><TrendingUp size={14} /> View on lab timeline</button>}
    </div>}

    {docState.page_count >= 1 && <div className="page-nav-bar" aria-label="Page navigation">
      <button type="button" className="quiet-button" disabled={docSelectedPage <= 1} onClick={() => setDocSelectedPage(Math.max(1, docSelectedPage - 1))}>Previous</button>
      <span>Page {docSelectedPage} of {docState.page_count}</span>
      <button type="button" className="quiet-button" disabled={docSelectedPage >= docState.page_count} onClick={() => setDocSelectedPage(Math.min(docState.page_count, docSelectedPage + 1))}>Next</button>
      <button type="button" className="quiet-button" onClick={() => setPreviewZoom(1)}><ZoomIn size={14} /> Fit width</button>
      <button type="button" className="quiet-button" onClick={() => setPreviewZoom(Math.min(1.6, previewZoom + 0.15))}>Zoom in</button>
      <button type="button" className="quiet-button" onClick={() => setPreviewZoom(Math.max(0.8, previewZoom - 0.15))}>Zoom out</button>
    </div>}

    <div className="extraction-grid doc-review-grid">
      <div className="document-preview doc-page-preview">
        <p className="panel-kicker">ORIGINAL REPORT · PAGE {docSelectedPage}</p>
        {activePreview?.preview_url ? <img src={`${apiUrl}${activePreview.preview_url}`} alt={`Page ${docSelectedPage} preview`} style={{ transform: `scale(${previewZoom})`, transformOrigin: "top center" }} /> : <div className="doc-preview-placeholder"><FileText size={38} /><span>Page {docSelectedPage} preview</span></div>}
        <small>Check names, values, units, dates, and reference ranges against the source page</small>
      </div>

      <div className="extracted-fields doc-fields">
        <p className="eyebrow">{docConfirmed ? "CONFIRMED" : "VERIFICATION"} · PAGE {docSelectedPage}</p>
        <h3 className="doc-fields-heading">Extracted lab information</h3>
        <p className="doc-fields-support">Information found in your report — confirm before it enters the timeline</p>
        {!docConfirmed && docFields.length > 0 && <p className="review-progress">{reviewedCount} of {docFields.length} reviewed</p>}
        {visibleFields.length === 0 && <p className="doc-fields-empty">No information was found on this page.</p>}
        {visibleFields.map((field) => (
          <div
            key={field.field_id}
            className={`doc-field-row status-${field.status}${highlightedFieldId === field.field_id ? " field-highlighted" : ""}`}
            onFocus={() => setHighlightedFieldId(field.field_id)}
          >
            <div className="doc-field-label">
              <strong>{field.label}</strong>
              <span className={`confidence-pill confidence-${field.confidence}`}>{DOC_CONFIDENCE_LABELS[field.confidence]}</span>
              <span className="status-chip">{fieldReviewState[field.field_id] === "corrected" ? "Corrected" : fieldReviewState[field.field_id] === "rejected" ? "Rejected" : fieldReviewState[field.field_id] === "confirmed" || docConfirmed ? "Confirmed" : "Unverified"}</span>
              {(field.status === "flagged_high_on_report" || field.status === "flagged_low_on_report") && DOC_STATUS_LABELS[field.status] ? (
                <span className={`status-pill status-pill-${field.status}`}>{DOC_STATUS_LABELS[field.status]}</span>
              ) : null}
            </div>
            <div className="doc-field-inputs">
              <label>Value<input value={field.value} readOnly={docConfirmed} onChange={(event) => onFieldChange(field.field_id, { value: event.target.value })} /></label>
              <label>Unit<input value={field.unit} readOnly={docConfirmed} onChange={(event) => onFieldChange(field.field_id, { unit: event.target.value })} /></label>
              <label>Reference range<input value={field.reference_range} readOnly={docConfirmed} onChange={(event) => onFieldChange(field.field_id, { reference_range: event.target.value })} /></label>
            </div>
            {!docConfirmed && (
              <div className="field-review-actions">
                <button type="button" className="quiet-button" onClick={() => setFieldReviewState((current) => ({ ...current, [field.field_id]: "confirmed" }))}>Confirm</button>
                <button type="button" className="quiet-button" onClick={() => setHighlightedFieldId(field.field_id)}>Edit</button>
                <button type="button" className="quiet-button" onClick={() => setFieldReviewState((current) => ({ ...current, [field.field_id]: "rejected" }))}>Reject</button>
              </div>
            )}
          </div>
        ))}

        {!docConfirmed && <div className="confirm-gate">
          <label className="confirm"><input type="checkbox" checked={docReviewChecked} onChange={(event) => setDocReviewChecked(event.target.checked)} /> I reviewed the names, values, units, dates, and reference ranges above.</label>
          <button className="forest-button" disabled={!docReviewChecked || Boolean(loading)} onClick={onConfirm}>Confirm reviewed items <Check size={16} /></button>
        </div>}

        {docConfirmed && !docExplain && <div className="explain-gate">
          <label>Ask a question about this document (optional)<textarea rows={2} value={docQuestion} onChange={(event) => setDocQuestion(event.target.value)} placeholder="Explain the confirmed information in plain language and suggest questions for a qualified healthcare professional." /></label>
          <div className="explain-actions">
            <button className="quiet-button" type="button" onClick={onOpenLabs}><FlaskConical size={15} /> Open lab timeline</button>
            <button className="quiet-button" type="button" onClick={onPrepareVisit}><Stethoscope size={15} /> Prepare visit questions</button>
            <button className="quiet-button" type="button" onClick={onAskAbout}><Sparkles size={15} /> Ask about these values</button>
            <button className="quiet-button" type="button" onClick={onSuggestQuestions}>Suggest questions</button>
            <button className="forest-button" disabled={Boolean(loading)} onClick={onExplain}>Understand this result <ArrowUpRight size={16} /></button>
          </div>
        </div>}
        {docConfirmed && docExplain && <div className="explain-actions">
          <button className="quiet-button" type="button" onClick={onOpenLabs}><FlaskConical size={15} /> Open lab timeline</button>
          <button className="quiet-button" type="button" onClick={onPrepareVisit}><Stethoscope size={15} /> Prepare visit questions</button>
          <button className="quiet-button" type="button" onClick={onAskAbout}><Sparkles size={15} /> Ask about these values</button>
        </div>}
      </div>
    </div>

    {loading && !processStage && <div className="processing"><Sparkles size={17} /><span>{loading}</span><i /><i /><i /></div>}

    {docExplain && <DocExplainCard explain={docExplain} selectedSource={selectedSource} setSelectedSource={setSelectedSource} onJumpToPage={setDocSelectedPage} />}
  </div>;
}

function DocExplainCard({ explain, selectedSource, setSelectedSource, onJumpToPage }: { explain: DocExplain; selectedSource: number | null; setSelectedSource: (value: number | null) => void; onJumpToPage: (page: number) => void }) {
  const lines = explain.answer_markdown.split("\n");
  const renderPart = (part: string, key: string) => {
    const pageMatch = /^\[D(\d+)\]$/.exec(part);
    if (pageMatch) {
      const page = Number(pageMatch[1]);
      return <button className="doc-citation" onClick={() => onJumpToPage(page)} key={key}>[D{page}]</button>;
    }
    const numbers = /^\[\d+(?:,\s*\d+)*\]$/.test(part) ? part.match(/\d+/g) : null;
    if (!numbers) return part.replace(/^#+\s*/, "");
    return numbers.map((num, index) => (
      <button className={selectedSource === Number(num) ? "citation selected" : "citation"} onClick={() => setSelectedSource(Number(num))} key={`${key}-${index}`}>[{num}]</button>
    ));
  };
  return <article className="answer-document doc-explain-card">
    <div className="answer-kicker"><span><Sparkles size={14} /> MEDIGUIDE</span><small>Educational context</small></div>
    <p className="eyebrow explain-provenance-label">GROUNDED EXPLANATION</p>
    <div className="explain-split-note">
      <strong>What your document says</strong> stays separate from <strong>general educational information</strong>.
    </div>
    <div className="answer-content">
      {lines.map((line, index) => {
        const heading = line.startsWith("#");
        const parts = line.split(/(\[D\d+\]|\[\d+(?:,\s*\d+)*\])/g);
        return <p className={heading ? "answer-heading" : ""} key={index}>{parts.map((part, partIndex) => renderPart(part, `${index}-${partIndex}`))}</p>;
      })}
    </div>
    {explain.sources.length > 0 && (
      <div className="explain-provenance-list">
        <p className="eyebrow">SOURCES</p>
        <ul>
          {explain.sources.map((source) => (
            <li key={source.citation_number}>
              <strong>[{source.citation_number}]</strong> {source.publisher} — {source.title}
            </li>
          ))}
        </ul>
      </div>
    )}
    {explain.limitations.length > 0 && <div className="doc-limitations"><p className="eyebrow">LIMITATIONS</p><ul>{explain.limitations.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
    <p className="answer-safety-note"><ShieldCheck size={13} /> General educational information, not a diagnosis or personalized treatment recommendation.</p>
  </article>;
}

function Medication({
  apiUrl, medState, medFields, medConfirmed, medReviewChecked, setMedReviewChecked,
  medInfo, medQuestion, setMedQuestion, medTypedText, setMedTypedText,
  selectedSource, setSelectedSource,
  dragging, onUpload, onDrop, onDragEnter, onDragLeave, onFieldChange, onConfirm, onGetInfo, onSubmitTyped, onSample, onPrepareVisit, onReset,
  loading, error,
}: {
  apiUrl: string;
  medState: MedState | null;
  medFields: MedField[];
  medConfirmed: boolean;
  medReviewChecked: boolean;
  setMedReviewChecked: (value: boolean) => void;
  medInfo: MedInfo | null;
  medQuestion: string;
  setMedQuestion: (value: string) => void;
  medTypedText: string;
  setMedTypedText: (value: string) => void;
  selectedSource: number | null;
  setSelectedSource: (value: number | null) => void;
  dragging: boolean;
  onUpload: () => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnter: () => void;
  onDragLeave: () => void;
  onFieldChange: (key: string, value: string) => void;
  onConfirm: () => void;
  onGetInfo: () => void;
  onSubmitTyped: () => void;
  onSample: () => void;
  onPrepareVisit: () => void;
  onReset: () => void;
  loading: string;
  error: string;
}) {
  if (!medState) {
    return <div className="workflow-view">
      <div className="workflow-heading-row">
        <div><p className="eyebrow">MEDICATION WORKSPACE</p><h2>Understand a medication label.</h2><p className="workflow-lead">Upload a photo of a label, or type what is printed on it — review the extracted name, strength, and instructions before MediGuide adds educational information.</p></div>
        <span className="workflow-badge"><ShieldCheck size={14} /> Human review first</span>
      </div>
      {!loading && <div className={dragging ? "upload-zone is-dragging" : "upload-zone"} onDrop={onDrop} onDragEnter={(event) => { event.preventDefault(); onDragEnter(); }} onDragOver={(event) => event.preventDefault()} onDragLeave={onDragLeave}>
        <span className="upload-art"><Pill size={25} /><span><ImageIcon size={14} /></span></span>
        <strong>Upload a medication label</strong>
        <span>Drop a photo or PDF here, or choose a file</span>
        <small>PDF, PNG, JPG, WEBP · Temporary session file</small>
        <div className="upload-actions">
          <button className="forest-button" onClick={onUpload}>Choose file <Paperclip size={16} /></button>
          <button className="quiet-button" type="button" onClick={onSample}>Try sample Amoxicillin label</button>
        </div>
      </div>}
      {!loading && <div className="med-type-alt">
        <p className="eyebrow">OR TYPE THE LABEL</p>
        <textarea rows={3} value={medTypedText} onChange={(event) => setMedTypedText(event.target.value)} placeholder="e.g. Amoxicillin 500 mg capsules — Take 1 capsule by mouth three times daily for 10 days" />
        <button className="quiet-button" disabled={!medTypedText.trim()} onClick={onSubmitTyped}>Extract from typed text <ArrowUpRight size={16} /></button>
      </div>}
      {loading && <div className="processing large"><Sparkles size={18} /> {loading}<i /><i /><i /></div>}
      {error && <div className="service-error"><Activity size={19} /><div><strong>{error}</strong><p>Nothing has been added.</p></div></div>}
    </div>;
  }

  return <div className="workflow-view doc-intel-view">
    <div className="workflow-heading-row">
      <div><p className="eyebrow">MEDICATION WORKSPACE</p><h2>{medState.filename || "Typed label"}</h2><p className="workflow-lead">{medConfirmed ? "Confirmed by you" : "Review each detail before confirming"}</p></div>
      <button className="quiet-button" onClick={onReset}><RefreshCw size={14} /> Start over</button>
    </div>

    {error && <div className="service-error"><Activity size={19} /><div><strong>{error}</strong><p>Try again below.</p></div></div>}

    <div className="extraction-grid doc-review-grid">
      <div className="document-preview doc-page-preview">
        {medState.source === "upload" ? <img src={`${apiUrl}${medState.preview_url}`} alt="Label preview" /> : <Pill size={38} />}
        <small>Check the medication name, strength, and directions</small>
      </div>

      <div className="extracted-fields doc-fields">
        <p className="eyebrow">EXTRACTED DETAILS</p>
        {medFields.map((field) => (
          <div key={field.key} className="doc-field-row">
            <div className="doc-field-label">
              <strong>{field.label}</strong>
              <span className={`confidence-pill confidence-${field.confidence}`}>{DOC_CONFIDENCE_LABELS[field.confidence]}</span>
            </div>
            <div className="doc-field-inputs">
              <label>Value<input value={field.value} readOnly={medConfirmed} onChange={(event) => onFieldChange(field.key, event.target.value)} /></label>
            </div>
          </div>
        ))}
        {medState.other_visible_text && <p className="doc-fields-empty">Other visible text: {medState.other_visible_text}</p>}

        {!medConfirmed && <div className="confirm-gate">
          <label className="confirm"><input type="checkbox" checked={medReviewChecked} onChange={(event) => setMedReviewChecked(event.target.checked)} /> I reviewed the medication name, strength, and instructions above.</label>
          <button className="forest-button" disabled={!medReviewChecked || Boolean(loading)} onClick={onConfirm}>Confirm reviewed details <Check size={16} /></button>
        </div>}

        {medConfirmed && !medInfo && <div className="explain-gate">
          <label>Ask a question about this medication (optional)<textarea rows={2} value={medQuestion} onChange={(event) => setMedQuestion(event.target.value)} placeholder="What should I know about this medication?" /></label>
          <div className="explain-actions">
            <button className="quiet-button" type="button" onClick={onPrepareVisit}><Stethoscope size={15} /> Add to visit prep</button>
            <button className="forest-button" disabled={Boolean(loading)} onClick={onGetInfo}>Get educational information <ArrowUpRight size={16} /></button>
          </div>
        </div>}
        {medConfirmed && medInfo && <div className="explain-actions">
          <button className="quiet-button" type="button" onClick={onPrepareVisit}><Stethoscope size={15} /> Add to visit prep</button>
        </div>}
      </div>
    </div>

    {loading && <div className="processing"><Sparkles size={17} /><span>{loading}</span><i /><i /><i /></div>}

    {medInfo && <MedInfoCard info={medInfo} selectedSource={selectedSource} setSelectedSource={setSelectedSource} />}
  </div>;
}

function MedInfoCard({ info, selectedSource, setSelectedSource }: { info: MedInfo; selectedSource: number | null; setSelectedSource: (value: number | null) => void }) {
  const lines = info.answer_markdown.split("\n");
  const renderPart = (part: string, key: string) => {
    const numbers = /^\[\d+(?:,\s*\d+)*\]$/.test(part) ? part.match(/\d+/g) : null;
    if (!numbers) return part.replace(/^#+\s*/, "");
    return numbers.map((num, index) => (
      <button className={selectedSource === Number(num) ? "citation selected" : "citation"} onClick={() => setSelectedSource(Number(num))} key={`${key}-${index}`}>[{num}]</button>
    ));
  };
  return <article className="answer-document doc-explain-card">
    <div className="answer-kicker"><span><Sparkles size={14} /> MEDIGUIDE</span><small>Medication information</small></div>
    <div className="answer-content">
      {lines.map((line, index) => {
        const heading = line.startsWith("#");
        const parts = line.split(/(\[\d+(?:,\s*\d+)*\])/g);
        return <p className={heading ? "answer-heading" : ""} key={index}>{parts.map((part, partIndex) => renderPart(part, `${index}-${partIndex}`))}</p>;
      })}
    </div>
    {info.limitations.length > 0 && <div className="doc-limitations"><p className="eyebrow">LIMITATIONS</p><ul>{info.limitations.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
    <p className="answer-safety-note"><ShieldCheck size={13} /> General educational information, not personalized dosing guidance. Confirm with a pharmacist or clinician.</p>
  </article>;
}

function buildVisitSummaryText(fields: Record<string, string>, includeLabs: boolean, includeMeds: boolean, labPoints: LabPoint[], medFields: MedField[]) {
  const lines: string[] = ["Patient-Provided Visit Preparation Summary", ""];
  const order = ["Main concern", "Symptoms", "Onset", "Duration", "Frequency", "Severity", "Triggers", "Relieving factors", "Medications as entered", "Questions for clinician"];
  for (const key of order) {
    const value = (fields[key] || "").trim();
    if (value) lines.push(`${key}: ${value}`, "");
  }
  if (includeLabs && labPoints.length) {
    lines.push("Verified labs summary (patient-confirmed):");
    for (const point of labPoints.slice(0, 8)) {
      lines.push(`- ${point.test_name}: ${point.value_text} ${point.unit}${point.report_date ? ` (${point.report_date})` : ""}`);
    }
    lines.push("");
  }
  if (includeMeds) {
    const medNotes = medFields.filter((field) => field.value.trim()).map((field) => `${field.label}: ${field.value}`).join("; ");
    const fromVisit = (fields["Medications as entered"] || "").trim();
    if (medNotes || fromVisit) {
      lines.push("Medication notes:", medNotes || fromVisit, "");
    }
  }
  lines.push("This is patient-provided preparation material for discussion with a clinician — not a clinical note or diagnosis.");
  return lines.join("\n").trim();
}

function Visit({ fields, setFields, step, setStep, labPoints, medFields, onGenerate }: { fields: Record<string, string>; setFields: (value: Record<string, string>) => void; step: number; setStep: (value: number) => void; labPoints: LabPoint[]; medFields: MedField[]; onGenerate: () => void }) {
  const [includeLabs, setIncludeLabs] = useState(true);
  const [includeMeds, setIncludeMeds] = useState(true);
  const [summary, setSummary] = useState("");

  useEffect(() => {
    // Regenerates the editable draft when entering step 4 or its inputs
    // change; user edits to the textarea itself are not overwritten otherwise.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (step === 4) setSummary(buildVisitSummaryText(fields, includeLabs, includeMeds, labPoints, medFields));
  }, [step, fields, includeLabs, includeMeds, labPoints, medFields]);

  const setField = (key: string, value: string) => setFields({ ...fields, [key]: value });
  const steps = ["Concern", "Timeline", "Questions", "Summary"];

  return <div className="workflow-view visit-wizard">
    <p className="eyebrow">VISIT PREPARATION</p>
    <h2>Make the visit count.</h2>
    <p className="workflow-lead">Organize patient-provided information into a clear visit preparation summary.</p>
    <div className="visit-wizard-steps" aria-label="Visit preparation steps">
      <div className="visit-step-pills">
        {steps.map((label, index) => (
          <button type="button" key={label} className={step === index + 1 ? "visit-step-pill active" : "visit-step-pill"} onClick={() => setStep(index + 1)}>
            <span>{index + 1}</span>{label}
          </button>
        ))}
      </div>
    </div>

    {step === 1 && <div className="visit-form">
      <label>Main concern<textarea rows={3} value={fields["Main concern"] || ""} onChange={(event) => setField("Main concern", event.target.value)} placeholder="What do you most want to discuss?" /></label>
      <label>Symptoms<textarea rows={3} value={fields.Symptoms || ""} onChange={(event) => setField("Symptoms", event.target.value)} placeholder="Describe symptoms in your own words..." /></label>
    </div>}

    {step === 2 && <div className="visit-form">
      {(["Onset", "Duration", "Frequency", "Severity", "Triggers", "Relieving factors", "Medications as entered"] as const).map((name) => (
        <label key={name}>{name}<textarea rows={2} value={fields[name] || ""} onChange={(event) => setField(name, event.target.value)} placeholder={`Add ${name.toLowerCase()}...`} /></label>
      ))}
    </div>}

    {step === 3 && <div className="visit-form">
      <label>Questions for clinician<textarea rows={5} value={fields["Questions for clinician"] || ""} onChange={(event) => setField("Questions for clinician", event.target.value)} placeholder="List questions you want to ask..." /></label>
      <button type="button" className="quiet-button" onClick={() => setField("Questions for clinician", suggestClinicianQuestions([], medFields, labPoints))}>Suggest from labs &amp; medications</button>
    </div>}

    {step === 4 && <div className="visit-form visit-summary-step">
      <label>Patient-Provided Visit Preparation Summary<textarea rows={12} value={summary} onChange={(event) => setSummary(event.target.value)} /></label>
      <label className="confirm"><input type="checkbox" checked={includeLabs} onChange={(event) => setIncludeLabs(event.target.checked)} /> Include verified labs summary</label>
      <label className="confirm"><input type="checkbox" checked={includeMeds} onChange={(event) => setIncludeMeds(event.target.checked)} /> Include medication notes</label>
      <div className="visit-summary-actions">
        <button type="button" className="quiet-button" onClick={() => void navigator.clipboard?.writeText(summary)}><Clipboard size={14} /> Copy</button>
        <button type="button" className="quiet-button" onClick={() => window.print()}>Print</button>
        <button type="button" className="quiet-button" onClick={() => downloadTextFile("mediguide-visit-prep.txt", summary)}><ArrowUpRight size={14} /> Download summary</button>
        <button type="button" className="forest-button" onClick={onGenerate}>Continue in conversation <ArrowUpRight size={16} /></button>
      </div>
    </div>}

    <p className="patient-note"><ShieldCheck size={16} /> Patient-provided information — not a clinical note or diagnosis.</p>
    <div className="visit-nav">
      <button type="button" className="quiet-button" disabled={step <= 1} onClick={() => setStep(step - 1)}>Back</button>
      {step < 4 ? <button type="button" className="forest-button" onClick={() => setStep(step + 1)}>Next</button> : null}
    </div>
  </div>;
}

function DemoMode({ onSyntheticPipeline, onSampleMedication, onSampleVoice, onSampleVisit }: { onSyntheticPipeline: () => void; onSampleMedication: () => void; onSampleVoice: () => void; onSampleVisit: () => void }) {
  return <div className="workflow-view">
    <p className="eyebrow">DEMO MODE</p>
    <h2>Try with synthetic data.</h2>
    <p className="workflow-lead">One click loads a three-date synthetic lab report (January, April, August). No personal medical information is required.</p>
    <button type="button" className="forest-button demo-hero-cta" onClick={onSyntheticPipeline}>
      <PlayCircle size={18} /> Try with synthetic data
    </button>
    <p className="demo-pipeline-caption">Walkthrough: extraction → verification → lab timeline → explanation → source-page drill-down</p>
    <div className="demo-grid demo-secondary-grid">
      <button type="button" className="demo-card" onClick={onSampleMedication}>
        <span className="quick-icon"><Pill size={18} /></span>
        <strong>Sample medication label</strong>
        <small>Supporting workflow — Amoxicillin educational review.</small>
      </button>
      <button type="button" className="demo-card" onClick={onSampleVoice}>
        <span className="quick-icon"><Mic size={18} /></span>
        <strong>Sample Ask MediGuide question</strong>
        <small>Supporting conversation with a synthetic CBC question.</small>
      </button>
      <button type="button" className="demo-card" onClick={onSampleVisit}>
        <span className="quick-icon"><Stethoscope size={18} /></span>
        <strong>Sample visit preparation</strong>
        <small>Supporting appointment notes and clinician questions.</small>
      </button>
    </div>
  </div>;
}

function EvaluationDashboard() {
  const [unlocked, setUnlocked] = useState(false);
  if (!unlocked) {
    return <div className="workflow-view">
      <p className="eyebrow">EVALUATION</p>
      <h2>Engineering evaluation</h2>
      <p className="workflow-lead">Synthetic test metrics for portfolio review. Protected from casual browsing.</p>
      <div className="eval-gate">
        <Lock size={18} />
        <p>Unlock to view synthetic evaluation results.</p>
        <button type="button" className="forest-button" onClick={() => setUnlocked(true)}>Unlock for portfolio demo</button>
      </div>
    </div>;
  }
  return <div className="workflow-view">
    <div className="eval-banner"><Lock size={14} /> Engineering evaluation (synthetic tests — no patient data)</div>
    <p className="eyebrow">EVALUATION</p>
    <h2>Safety &amp; quality metrics</h2>
    <p className="workflow-lead">Results from synthetic regression suites used in engineering review.</p>
    <table className="eval-table">
      <thead><tr><th>Check</th><th>Result</th><th>Metric</th></tr></thead>
      <tbody>
        {EVALUATION_METRICS.map((row) => {
          const passed = row.passed == null || row.total == null ? null : row.passed === row.total;
          return <tr key={row.name}>
            <td>{row.name}</td>
            <td>{passed == null ? "—" : passed ? "Pass" : "Fail"}</td>
            <td>{row.metric}{row.passed != null && row.total != null ? ` (${row.passed}/${row.total})` : ""}</td>
          </tr>;
        })}
      </tbody>
    </table>
  </div>;
}

function reportFlagLabel(status?: string) {
  if (status === "flagged_high_on_report") return "Flagged high on this report";
  if (status === "flagged_low_on_report") return "Flagged low on this report";
  return "";
}

function confidenceLabel(confidence?: string) {
  if (confidence === "clearly_visible") return "Clearly visible";
  if (confidence === "needs_review") return "Needs review";
  if (confidence === "could_not_read") return "Could not read";
  return "";
}

function formatCollectionDate(value?: string | null) {
  if (!value) return "Not listed";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function LabTimeline({
  tests, selectedCode, onSelectCode, points, selectedPoint, onSelectPoint, onInspectDocument, onExport, onAddToVisit, onAskAbout, onRequestDeleteObservation, onOpenDocuments,
}: {
  tests: LabTest[];
  selectedCode: string;
  onSelectCode: (code: string) => void;
  points: LabPoint[];
  selectedPoint: LabPoint | null;
  onSelectPoint: (point: LabPoint | null) => void;
  onInspectDocument: (documentId: string, pageNumber: number, fieldId?: string) => void;
  onExport: () => void;
  onAddToVisit: () => void;
  onAskAbout: () => void;
  onRequestDeleteObservation: (observationId: string) => void;
  onOpenDocuments: () => void;
}) {
  const maxValue = Math.max(...points.map((point) => point.value ?? 0), 1);
  const activeTest = (tests.find((test) => test.test_code === selectedCode)?.display_name) || selectedCode;
  const selectedDate = selectedPoint?.collection_date || selectedPoint?.report_date;
  const selectedPage = selectedPoint?.source_page || selectedPoint?.page_number || 1;
  const selectedReference = selectedPoint?.reference_range || selectedPoint?.reference_text;
  const selectedVerification = selectedPoint?.verification_status || selectedPoint?.verification_state;
  const reportFlag = reportFlagLabel(selectedPoint?.range_status);
  const uniqueDocuments = new Set(points.map((point) => point.document_id)).size;
  const extractionConfidence = confidenceLabel(selectedPoint?.confidence);
  const latest = points.length ? points[points.length - 1] : null;

  return <div className="workflow-view lab-timeline-view">
    <div className="workflow-heading-row">
      <div>
        <p className="eyebrow">LAB TIMELINE</p>
        <h2>Lab Timeline</h2>
        <p className="workflow-lead">Explore verified measurements across reports.</p>
      </div>
      <div className="heading-actions">
        <label className="timeline-control">
          <span className="sr-only">Test selector</span>
          <select value={selectedCode} onChange={(event) => onSelectCode(event.target.value)} aria-label="Test selector">
            {(tests.length ? tests : [{ test_code: "hemoglobin_a1c", display_name: "Hemoglobin A1C", observation_count: 0, has_data: false }]).map((test) => (
              <option key={test.test_code} value={test.test_code}>{test.display_name}</option>
            ))}
          </select>
        </label>
        <button type="button" className="quiet-button" onClick={onAskAbout} disabled={!points.length}><Sparkles size={14} /> Understand this result</button>
        <button type="button" className="quiet-button" onClick={onAddToVisit}><Stethoscope size={14} /> Add to visit prep</button>
        <button type="button" className="quiet-button" onClick={onExport} disabled={!points.length}><Clipboard size={14} /> Export CSV</button>
      </div>
    </div>

    {latest && (
      <div className="latest-result-card">
        <p className="panel-kicker">Latest verified result · {activeTest}</p>
        <p className="lab-result-value">{latest.value_text} {latest.unit}</p>
        <p className="lab-result-date">{formatCollectionDate(latest.collection_date || latest.report_date)}</p>
        {reportFlagLabel(latest.range_status) ? <p className="lab-range-flag">{reportFlagLabel(latest.range_status)}</p> : null}
        {(latest.reference_range || latest.reference_text) ? <p className="latest-ref">Printed reference range: {latest.reference_range || latest.reference_text}</p> : null}
      </div>
    )}

    <div className="lab-chart-panel">
      {points.length ? (
        <div className="lab-chart" role="list" aria-label={`${activeTest} timeline`}>
          {points.map((point) => {
            const height = Math.max(12, ((point.value ?? 0) / maxValue) * 100);
            return <button type="button" key={point.observation_id} className={selectedPoint?.observation_id === point.observation_id ? "lab-point selected" : "lab-point"} style={{ height: `${height}%` }} onClick={() => onSelectPoint(point)} role="listitem" title={`${point.value_text} ${point.unit}`}>
              <span className="lab-point-dot" />
              <strong>{point.value_text}</strong>
              <small>{formatCollectionDate(point.collection_date || point.report_date)}</small>
            </button>;
          })}
        </div>
      ) : (
        <EmptyState
          title="No verified measurements yet"
          body="Verified measurements will appear here after document review."
        >
          <button type="button" className="forest-button" onClick={onOpenDocuments}>Review documents</button>
        </EmptyState>
      )}
    </div>
    {points.length > 0 && <p className="lab-timeline-summary">{points.length} verified measurement{points.length === 1 ? "" : "s"} · {uniqueDocuments} source report{uniqueDocuments === 1 ? "" : "s"}</p>}
    {points.length > 0 && <table className="lab-table">
      <caption className="sr-only">{activeTest} verified measurements</caption>
      <thead><tr><th>Date</th><th>Result</th><th>Report flag</th><th>Source</th></tr></thead>
      <tbody>
        {points.map((point) => (
          <tr key={point.observation_id} className={selectedPoint?.observation_id === point.observation_id ? "selected" : ""} onClick={() => onSelectPoint(point)}>
            <td>{formatCollectionDate(point.collection_date || point.report_date)}</td>
            <td>{point.value_text} {point.unit}</td>
            <td>{point.source_flag === "H" ? "High" : point.source_flag === "L" ? "Low" : reportFlagLabel(point.range_status) || "—"}</td>
            <td>{point.document_name}</td>
          </tr>
        ))}
      </tbody>
    </table>}
    {selectedPoint && <div className="drawer-backdrop lab-result-drawer-backdrop" onClick={() => onSelectPoint(null)}>
      <aside className="drawer lab-result-drawer" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Lab value provenance">
        <button className="drawer-close" type="button" onClick={() => onSelectPoint(null)} aria-label="Close"><X size={18} /></button>
        <p className="eyebrow">LAB VALUE PROVENANCE</p>
        <h2>{selectedPoint.test_name}</h2>
        <p className="lab-result-value">{selectedPoint.value_text} {selectedPoint.unit}</p>
        <p className="lab-result-date">{formatCollectionDate(selectedDate)}</p>
        {reportFlag ? <p className="lab-range-flag">{reportFlag}</p> : null}
        <p className="panel-kicker">REPORT INFORMATION</p>
        <dl>
          <div><dt>Printed reference range</dt><dd>{selectedReference || "Not listed on report"}</dd></div>
          <div><dt>Report flag</dt><dd>{selectedPoint.source_flag === "H" ? "High" : selectedPoint.source_flag === "L" ? "Low" : reportFlag || "None listed"}</dd></div>
        </dl>
        <p className="panel-kicker">VERIFICATION</p>
        <dl>
          <div><dt>Status</dt><dd>{selectedVerification === "confirmed" || selectedVerification === "human_verified" ? "✓ Confirmed" : (selectedVerification || "Unknown")}</dd></div>
          {extractionConfidence ? <div><dt>Extraction quality</dt><dd>{extractionConfidence} <small className="confidence-note">(extraction only — not medical correctness)</small></dd></div> : null}
        </dl>
        <p className="panel-kicker">SOURCE</p>
        <dl>
          <div><dt>Document</dt><dd>{selectedPoint.document_name}</dd></div>
          <div><dt>Page</dt><dd>{selectedPage}</dd></div>
          {selectedPoint.extracted_value != null && <div><dt>Extracted value</dt><dd>{selectedPoint.extracted_value}</dd></div>}
          {selectedPoint.confirmed_value != null && <div><dt>Confirmed value</dt><dd>{selectedPoint.confirmed_value}</dd></div>}
        </dl>
        <div className="lab-point-actions">
          <button type="button" className="forest-button" onClick={() => onInspectDocument(selectedPoint.document_id, selectedPage, selectedPoint.field_id)}>
            <FileText size={14} /> View source page
          </button>
          <button type="button" className="quiet-button" onClick={onAskAbout}><Sparkles size={14} /> Understand this result</button>
          <button type="button" className="quiet-button" onClick={() => onInspectDocument(selectedPoint.document_id, selectedPage)}>View document</button>
          <button type="button" className="quiet-button destructive-action" onClick={() => onRequestDeleteObservation(selectedPoint.observation_id)}>
            <Trash2 size={14} /> Delete result
          </button>
          <p className="lab-delete-note">Removes this timeline observation only. The source document stays available until you clear it separately.</p>
        </div>
      </aside>
    </div>}
  </div>;
}

function SystemStatusView({ status, health, onRetry }: { status: SystemStatus | null; health: HealthResponse | null; onRetry: () => void }) {
  const raw = status?.components || Object.entries(health?.statuses || {}).map(([key, value]) => ({ name: friendlyHealthLabel(key, healthLabels[key] || key), key, status: value.status, detail: value.detail }));
  const byLabel = new Map<string, { name: string; key: string; status: string; detail: string }>();
  for (const component of raw) {
    const name = friendlyHealthLabel(component.key, component.name);
    const existing = byLabel.get(name);
    const rank = (s: string) => (s === "ready" ? 2 : s === "degraded" ? 1 : 0);
    if (!existing || rank(component.status) < rank(existing.status)) {
      byLabel.set(name, { ...component, name });
    }
  }
  const preferred = ["Document processing", "Document preview", "Educational explanations", "Voice transcription", "Voice playback"];
  const components = preferred.map((name) => byLabel.get(name) || { name, key: name, status: "ready", detail: "Service status" });
  const limited = components.some((component) => friendlyComponentStatus(component.status, component.detail) === "Limited" || friendlyComponentStatus(component.status, component.detail) === "Unavailable");
  return <div className="workflow-view system-status-view">
    <p className="eyebrow">SYSTEM</p>
    <h2>System Status</h2>
    <p className="workflow-lead">Service availability for document processing and educational features. Documents and verified information remain accessible when explanations are limited.</p>
    {limited && <p className="system-limited-note">Some educational explanations may be temporarily unavailable. Your documents and verified information remain accessible.</p>}
    <div className="system-grid">
      {components.map((component) => {
        const label = friendlyComponentStatus(component.status, component.detail);
        return (
          <div key={component.key} className="system-card">
            <span className={label === "Available" ? "status-dot" : label === "Limited" ? "status-dot limited" : "status-dot off"} aria-hidden />
            <div>
              <strong>{component.name}</strong>
              <em className="system-health-label">{label}</em>
            </div>
          </div>
        );
      })}
    </div>
    <button className="forest-button" onClick={onRetry}><RefreshCw size={15} /> Refresh status</button>
  </div>;
}

function Sources({ sources, library, onSelect }: { sources: Source[]; library: LibrarySource[]; onSelect: (value: number) => void }) {
  const [query, setQuery] = useState("");
  const filtered = library.filter((source) => {
    const haystack = `${source.publisher} ${source.title}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });
  if (sources.length) {
    return <div className="workflow-view"><p className="eyebrow">EXPLANATION PROVENANCE</p><h2>Cited sources.</h2><p className="workflow-lead">Plain-language statement → Citation → Approved knowledge source → Source/version</p><div className="source-list">{sources.map((source) => <button key={source.number} onClick={() => onSelect(source.number)}><span>[{source.number}]</span><div><strong>{source.publisher}</strong><b>{source.title}</b><small>{source.reviewed || "Approved source"}</small></div><ChevronRight size={17} /></button>)}</div></div>;
  }
  return <div className="workflow-view"><p className="eyebrow">SOURCE EVIDENCE</p><h2>Approved sources.</h2><p className="workflow-lead">Trusted local retrieval keeps educational explanations grounded. Lab values use a separate provenance chain back to the original report page.</p><input className="source-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search publishers or titles..." aria-label="Search approved sources" /><div className="source-list">{filtered.length ? filtered.map((source) => <a key={source.id} href={source.url || undefined} target={source.url ? "_blank" : undefined} rel={source.url ? "noreferrer" : undefined} className={source.url ? "" : "no-link"}><span><BookOpen size={15} /></span><div><strong>{source.publisher}</strong><b>{source.title}</b><small>{source.reviewed ? `Reviewed ${source.reviewed}` : "Approved source"}</small></div>{source.url && <ArrowUpRight size={16} />}</a>) : <div className="empty-panel"><BookOpen size={23} /><p>{library.length ? "No sources match that search." : "The knowledge base is still loading."}</p></div>}</div></div>;
}

function Privacy({ onClose, onClear }: { onClose: () => void; onClear: () => void }) {
  return <div className="drawer-backdrop" onClick={onClose}><aside className="drawer" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Privacy">
    <button className="drawer-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
    <p className="eyebrow">PRIVACY</p>
    <h2>Privacy-conscious processing.</h2>
    <p>MediGuide is an educational prototype. Session uploads and temporary files are designed to stay under user control.</p>
    <ul>
      <li><Check size={16} /> User-controlled uploads</li>
      <li><Check size={16} /> Clear-session controls</li>
      <li><Check size={16} /> Document deletion from the current session</li>
      <li><Check size={16} /> Educational use only</li>
      <li><Check size={16} /> No advertising profile</li>
    </ul>
    <div className="drawer-warning"><strong>Public demo mode</strong><span>Do not enter identifying health information.</span></div>
    <button className="drawer-action" onClick={onClear}><Trash2 size={16} /> Clear session</button>
    <button className="drawer-action secondary" onClick={() => { try { window.sessionStorage.removeItem(VISIT_STORAGE_KEY); } catch { /* ignore */ } onClear(); }}><RefreshCw size={16} /> Clear temporary session data</button>
  </aside></div>;
}

function HelpDrawer({ onClose, onOpenView }: { onClose: () => void; onOpenView: (view: View) => void }) {
  return <div className="drawer-backdrop" onClick={onClose}><aside className="drawer" onClick={(event) => event.stopPropagation()}>
    <button className="drawer-close" onClick={onClose}><X size={18} /></button>
    <p className="eyebrow">HELP</p>
    <h2>How MediGuide works.</h2>
    <p>Primary pipeline: Documents → Verification → Lab Timeline → Grounded Explanation → Source Evidence.</p>
    <ul className="help-steps">
      <li><button type="button" onClick={() => onOpenView("demo")}><PlayCircle size={15} /> Demo Mode</button> Try with synthetic data — three-date report, no personal information.</li>
      <li><button type="button" onClick={() => onOpenView("documents")}><FileText size={15} /> Documents</button> Upload → extract → confirm values → optional explanation.</li>
      <li><button type="button" onClick={() => onOpenView("labs")}><FlaskConical size={15} /> Lab Timeline</button> Click a measurement for lab-value provenance, then View source page.</li>
      <li><button type="button" onClick={() => onOpenView("sources")}><BookOpen size={15} /> Source Evidence</button> Approved educational sources that support explanations.</li>
    </ul>
    <p className="patient-note"><ShieldCheck size={16} /> MediGuide does not autonomously diagnose conditions, prescribe treatment, or replace professional medical care.</p>
  </aside></div>;
}

function SettingsDrawer({ answerDetail, setAnswerDetail, readingLevel, setReadingLevel, language, setLanguage, onClose }: { answerDetail: "Concise" | "Standard" | "Detailed"; setAnswerDetail: (value: "Concise" | "Standard" | "Detailed") => void; readingLevel: "Standard" | "Plain"; setReadingLevel: (value: "Standard" | "Plain") => void; language: string; setLanguage: (value: string) => void; onClose: () => void }) {
  return <div className="drawer-backdrop" onClick={onClose}><aside className="drawer" onClick={(event) => event.stopPropagation()}>
    <button className="drawer-close" onClick={onClose}><X size={18} /></button>
    <p className="eyebrow">SETTINGS</p>
    <h2>Answer preferences.</h2>
    <label>Answer detail<select value={answerDetail} onChange={(event) => setAnswerDetail(event.target.value as "Concise" | "Standard" | "Detailed")}><option>Concise</option><option>Standard</option><option>Detailed</option></select></label>
    <label>Reading level<select value={readingLevel} onChange={(event) => setReadingLevel(event.target.value as "Standard" | "Plain")}><option>Standard</option><option>Plain</option></select></label>
    <label>Preferred language<select value={language} onChange={(event) => setLanguage(event.target.value)}><option>English</option><option>Spanish</option><option>French</option></select></label>
    <p className="workflow-lead">These stay on this device only.</p>
    <button className="drawer-action" onClick={onClose}>Done</button>
  </aside></div>;
}

function TranscriptReview({ text, setText, reviewed, setReviewed, onConfirm, onDiscard }: { text: string; setText: (value: string) => void; reviewed: boolean; setReviewed: (value: boolean) => void; onConfirm: () => void; onDiscard: () => void }) {
  return <div className="transcript-review">
    <p className="eyebrow">VOICE TRANSCRIPT</p>
    <strong>Review before sending.</strong>
    <textarea rows={3} value={text} onChange={(event) => setText(event.target.value)} />
    <label className="confirm"><input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} /> I reviewed this transcript</label>
    <div className="explain-actions">
      <button type="button" className="quiet-button" onClick={onDiscard}>Discard</button>
      <button type="button" className="forest-button" disabled={!reviewed || !text.trim()} onClick={onConfirm}>Use in question <Check size={15} /></button>
    </div>
  </div>;
}

function Health({ health, onClose, onRetry }: { health: HealthResponse | null; onClose: () => void; onRetry: () => void }) { return <div className="drawer-backdrop" onClick={onClose}><aside className="drawer health-drawer" onClick={(event) => event.stopPropagation()}><button className="drawer-close" onClick={onClose}><X size={18} /></button><p className="eyebrow">SYSTEM STATUS</p><h2>{health?.status === "ok" ? "All systems ready." : "Some services need attention."}</h2><p>{health ? `${health.ready} of ${health.total} services ready.` : "Checking the local AI service..."}</p><div className="health-list">{Object.entries(health?.statuses || {}).map(([key, value]) => <div key={key}><span className={value.status === "ready" ? "status-dot" : "status-dot off"} /><strong>{healthLabels[key] || key}</strong><small>{value.detail}</small></div>)}</div><button className="drawer-action" onClick={onRetry}><RefreshCw size={16} /> Check again</button></aside></div>; }
