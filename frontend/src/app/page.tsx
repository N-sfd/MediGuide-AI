"use client";

import { ChangeEvent, DragEvent, FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { Activity, ArrowUp, ArrowUpRight, BookOpen, Check, ChevronRight, Clipboard, FileText, HelpCircle, Home as HomeIcon, Image as ImageIcon, Menu, Mic, Paperclip, Pill, Plus, RefreshCw, Settings, ShieldCheck, Sparkles, Stethoscope, Trash2, TrendingUp, UserRound, Volume2, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PremiumLanding } from "./premium-landing";
import "./workspace.css";

type Source = { number: number; title: string; publisher: string; published?: string; reviewed?: string; url?: string };
type LibrarySource = { id: string; title: string; publisher: string; url?: string; published?: string; reviewed?: string; type?: string };
type Message = { role: "user" | "assistant"; content: string };
type DocFieldStatus = "in_listed_range" | "outside_listed_range" | "not_applicable" | "unknown";
type DocFieldConfidence = "clearly_visible" | "needs_review" | "could_not_read";
type DocField = { field_id: string; label: string; value: string; unit: string; reference_range: string; status: DocFieldStatus; confidence: DocFieldConfidence; page_number: number; source_text: string; user_edited: boolean };
type DocPage = { page_number: number; preview_url: string; text_available: boolean; extracted_field_count: number };
type DocState = { document_id: string; filename: string; page_count: number; status: string; pages: DocPage[]; fields: DocField[]; confirmed: boolean };
type DocEvidenceSource = { citation_number: number; title: string; publisher: string; source_url?: string; passage?: string };
type DocExplain = { document_id: string; answer_markdown: string; document_pages_cited: number[]; sources: DocEvidenceSource[]; limitations: string[] };
type HealthStatus = { status: string; detail: string };
type HealthResponse = { status: string; ready: number; total: number; statuses: Record<string, HealthStatus>; knowledge?: { active_chunks?: number; approved_sources?: number } };
type MedField = { key: string; label: string; value: string; confidence: DocFieldConfidence; source_text: string; user_edited: boolean };
type MedState = { medication_id: string; source: "upload" | "typed"; filename: string; preview_url: string; status: string; fields: MedField[]; other_visible_text: string; confirmed: boolean };
type MedInfo = { medication_id: string; answer_markdown: string; sources: DocEvidenceSource[]; limitations: string[] };
type LabTest = { test_code: string; display_name: string; observation_count: number; has_data: boolean };
type LabPoint = { observation_id: string; test_code: string; test_name: string; value: number | null; value_text: string; unit: string; report_date: string | null; document_id: string; document_name: string; page_number: number; field_id: string; verification_state: string; reference_text?: string };
type SystemComponent = { name: string; key: string; status: string; detail: string };
type SystemStatus = { service: string; overall: string; components: SystemComponent[]; knowledge: { active_chunks?: number; approved_sources?: number } };
type View = "conversation" | "documents" | "labs" | "medication" | "visit" | "sources" | "system";
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
const healthLabels: Record<string, string> = { fastapi: "API", ollama: "Ollama", text_model: "Text model", vision_model: "Vision model", embedding_model: "Embedding model", vector_store: "ChromaDB", database: "Database", whisper: "Whisper", piper: "Piper", translation_model: "Translation model" };

export default function Home() {
  const [workspace, setWorkspace] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [view, setView] = useState<View>("conversation");
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
  const [labTests, setLabTests] = useState<LabTest[]>([]);
  const [selectedLabCode, setSelectedLabCode] = useState("hemoglobin");
  const [labPoints, setLabPoints] = useState<LabPoint[]>([]);
  const [selectedLabPoint, setSelectedLabPoint] = useState<LabPoint | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [answerDetail, setAnswerDetail] = useState<"Concise" | "Standard" | "Detailed">("Standard");
  const [readingLevel, setReadingLevel] = useState<"Standard" | "Plain">("Standard");
  const [library, setLibrary] = useState<LibrarySource[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const medFileInput = useRef<HTMLInputElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  useEffect(() => { if (workspace) { void checkHealth(); void loadLibrary(); } }, [workspace]);
  useEffect(() => {
    if (!workspace) return;
    if (view === "labs") void loadLabs(selectedLabCode);
    if (view === "system") void loadSystemStatus();
  }, [workspace, view, selectedLabCode]);
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
    setWorkspace(true); setView("conversation"); setQuestion(""); setError(""); setLoadingStage("Checking safety...");
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

  async function uploadDocument(file: File) {
    setView("documents"); setError(""); setDocumentDragging(false);
    setDocState(null); setDocFields([]); setDocConfirmed(false); setDocReviewChecked(false); setDocExplain(null); setDocQuestion("");
    setLoadingStage("Reading and extracting the document...");
    const form = new FormData(); form.append("file", file);
    try {
      const response = await fetch(`${API_URL}/api/documents/v2/upload`, { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Document analysis failed.");
      setDocState(data); setDocFields(data.fields || []); setDocSelectedPage(1);
    } catch (err) {
      if (!API_URL) setError(API_CONFIGURATION_MESSAGE);
      else if (err instanceof Error && err.message && err.message !== "Failed to fetch") setError(err.message);
      else setError("MediGuide could not read that document. Check the file and try again.");
    } finally {
      setLoadingStage("");
    }
  }

  function updateDocField(fieldId: string, patch: Partial<Pick<DocField, "value" | "unit" | "reference_range">>) {
    setDocFields((current) => current.map((field) => (field.field_id === fieldId ? { ...field, ...patch, user_edited: true } : field)));
  }

  async function confirmDocument() {
    if (!docState || !docReviewChecked || !docFields.length) return;
    setError(""); setLoadingStage("Saving your reviewed values...");
    try {
      const response = await fetch(`${API_URL}/api/documents/v2/${docState.document_id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: docFields, reviewed_names_values_units_dates: true }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Could not confirm this document.");
      setDocFields(data.fields || docFields); setDocConfirmed(true);
    } catch (err) {
      if (!API_URL) setError(API_CONFIGURATION_MESSAGE);
      else if (err instanceof Error && err.message && err.message !== "Failed to fetch") setError(err.message);
      else setError("MediGuide could not confirm this document. Please try again.");
    } finally {
      setLoadingStage("");
    }
  }

  async function explainDocument() {
    if (!docState || !docConfirmed) return;
    setError(""); setDocExplain(null); setLoadingStage("Finding evidence and writing an explanation...");
    try {
      const response = await fetch(`${API_URL}/api/documents/v2/${docState.document_id}/explain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: docQuestion.trim() || undefined }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Could not generate an explanation.");
      setDocExplain(data);
    } catch (err) {
      if (!API_URL) setError(API_CONFIGURATION_MESSAGE);
      else if (err instanceof Error && err.message && err.message !== "Failed to fetch") setError(err.message);
      else setError("MediGuide could not generate an explanation for this document.");
    } finally {
      setLoadingStage("");
    }
  }

  function resetDocument() {
    setDocState(null); setDocFields([]); setDocConfirmed(false); setDocReviewChecked(false); setDocExplain(null); setDocQuestion(""); setDocSelectedPage(1); setError("");
  }

  function onDrop(event: DragEvent<HTMLDivElement>) { event.preventDefault(); setDocumentDragging(false); const file = event.dataTransfer.files[0]; if (file) void uploadDocument(file); }
  function onFileChange(event: ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; if (file) void uploadDocument(file); }

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
        next.onstop = async () => { stream.getTracks().forEach((track) => track.stop()); const form = new FormData(); form.append("file", new Blob(audioChunks.current, { type: "audio/webm" }), "question.webm"); try { const response = await fetch(`${API_URL}/api/transcribe`, { method: "POST", body: form }); const data = await response.json(); if (!response.ok) throw new Error(); setQuestion(data.text || ""); } catch { setError("MediGuide could not create a transcript. Your audio was not sent."); } finally { setLoadingStage(""); } };
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

  if (!workspace) return <PremiumLanding onStart={() => setWorkspace(true)} />;
  const handleViewChange = (nextView: View) => { setView(nextView); setMobileNavOpen(false); };
  const docEvidenceSources: Source[] = (docExplain?.sources || []).map((source) => ({ number: source.citation_number, title: source.title, publisher: source.publisher, url: source.source_url }));
  const medEvidenceSources: Source[] = (medInfo?.sources || []).map((source) => ({ number: source.citation_number, title: source.title, publisher: source.publisher, url: source.source_url }));
  const evidenceSources = view === "documents" && docExplain ? docEvidenceSources : view === "medication" && medInfo ? medEvidenceSources : sources;
  return <main className="product-shell workspace-enter"><header className="app-header"><button className="app-brand" onClick={() => setWorkspace(false)}><span className="brand-mark"><ShieldCheck size={15} /></span><span>MediGuide <em>AI</em></span></button><span className="header-context">Private · Local · Evidence-supported</span><div className="header-actions"><select className="language-select" value={language} onChange={(event) => void translateAnswer(event.target.value)} aria-label="Response language"><option>English</option><option>Spanish</option><option>French</option></select><button className="local-pill" onClick={() => setHealthOpen(true)}><span /> Private local</button><button className="icon-button" title="Help"><HelpCircle size={18} /></button><button className="icon-button" title="Settings"><Settings size={18} /></button><button className="profile-button" title="Profile"><UserRound size={17} /></button></div><button className="mobile-menu icon-button" title="Open navigation" aria-label="Open navigation" aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen(true)}><Menu size={20} /></button></header>{mobileNavOpen && <button className="mobile-nav-backdrop" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}<div className={mobileNavOpen ? "workspace-grid mobile-nav-visible" : "workspace-grid"}><Sidebar view={view} setView={handleViewChange} onNew={() => { clearSession(); setMobileNavOpen(false); }} onPrivacy={() => { setPrivacyOpen(true); setMobileNavOpen(false); }} onClose={() => setMobileNavOpen(false)} /><section className="main-panel">{view === "conversation" && <Conversation answer={answer} status={answerStatus} streaming={streaming} sources={sources} question={question} messages={messages} loading={loadingStage} error={error} selectedSource={selectedSource} setSelectedSource={setSelectedSource} onRetry={retry} onPreset={(prompt) => setQuestion(prompt)} onOpenView={handleViewChange} onUpload={() => fileInput.current?.click()} onAction={(action) => { if (action === "copy") copyAnswer(); if (action === "listen") readAnswer(); if (action === "simple") void sendQuestion(undefined, `Explain this answer simply:\n\n${answer}`); if (action === "questions") { setQuestion("What questions should I ask my clinician about this?"); } }} />}{view === "documents" && <Documents apiUrl={API_URL} docState={docState} docFields={docFields} docConfirmed={docConfirmed} docReviewChecked={docReviewChecked} setDocReviewChecked={setDocReviewChecked} docSelectedPage={docSelectedPage} setDocSelectedPage={setDocSelectedPage} docExplain={docExplain} docQuestion={docQuestion} setDocQuestion={setDocQuestion} selectedSource={selectedSource} setSelectedSource={setSelectedSource} dragging={documentDragging} onUpload={() => fileInput.current?.click()} onDrop={onDrop} onDragEnter={() => setDocumentDragging(true)} onDragLeave={() => setDocumentDragging(false)} onFieldChange={updateDocField} onConfirm={() => void confirmDocument()} onExplain={() => void explainDocument()} onReset={resetDocument} loading={loadingStage} error={error} />}{view === "labs" && <LabTimeline tests={labTests} selectedCode={selectedLabCode} onSelectCode={(code) => { setSelectedLabCode(code); setSelectedLabPoint(null); }} points={labPoints} selectedPoint={selectedLabPoint} onSelectPoint={setSelectedLabPoint} apiUrl={API_URL} />}{view === "medication" && <Medication apiUrl={API_URL} medState={medState} medFields={medFields} medConfirmed={medConfirmed} medReviewChecked={medReviewChecked} setMedReviewChecked={setMedReviewChecked} medInfo={medInfo} medQuestion={medQuestion} setMedQuestion={setMedQuestion} medTypedText={medTypedText} setMedTypedText={setMedTypedText} selectedSource={selectedSource} setSelectedSource={setSelectedSource} dragging={medDragging} onUpload={() => medFileInput.current?.click()} onDrop={onMedDrop} onDragEnter={() => setMedDragging(true)} onDragLeave={() => setMedDragging(false)} onFieldChange={updateMedField} onConfirm={() => void confirmMedication()} onGetInfo={() => void getMedicationInfo()} onSubmitTyped={() => void submitTypedMedication(medTypedText)} onReset={resetMedication} loading={loadingStage} error={error} />}{view === "visit" && <Visit fields={visitFields} setFields={setVisitFields} onGenerate={generateVisitSummary} />}{view === "sources" && <Sources sources={sources} library={library} onSelect={setSelectedSource} />}{view === "system" && <SystemStatusView status={systemStatus} health={health} onRetry={() => { void checkHealth(); void loadSystemStatus(); }} />}{view !== "documents" && view !== "medication" && view !== "visit" && view !== "labs" && view !== "system" && <Composer question={question} setQuestion={setQuestion} onSubmit={sendQuestion} onKeyDown={handleComposerKey} onUpload={() => fileInput.current?.click()} onVoice={toggleVoice} recording={recording} loading={Boolean(loadingStage)} answerDetail={answerDetail} setAnswerDetail={setAnswerDetail} readingLevel={readingLevel} setReadingLevel={setReadingLevel} />}<input ref={fileInput} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,image/*" hidden onChange={onFileChange} /><input ref={medFileInput} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,image/*" hidden onChange={onMedFileChange} /></section><Evidence sources={evidenceSources} selected={selectedSource} onSelect={setSelectedSource} /></div>{privacyOpen && <Privacy onClose={() => setPrivacyOpen(false)} onClear={clearSession} />}{healthOpen && <Health health={health} onClose={() => setHealthOpen(false)} onRetry={checkHealth} />}</main>;
}

/* Legacy landing markup retained for reference; PremiumLanding is the public entry point. */

function Sidebar({ view, setView, onNew, onPrivacy, onClose }: { view: View; setView: (view: View) => void; onNew: () => void; onPrivacy: () => void; onClose: () => void }) { const item = (target: View, label: string, Icon: LucideIcon) => <button className={view === target ? "nav-item active" : "nav-item"} onClick={() => setView(target)}><Icon size={17} />{label}</button>; return <aside className="sidebar"><div className="mobile-sidebar-head"><span>Navigate</span><button className="icon-button" title="Close navigation" aria-label="Close navigation" onClick={onClose}><X size={18} /></button></div><div className="sidebar-label">WORKSPACE</div><button className="new-conversation" onClick={onNew}><Plus size={17} /> New conversation</button><nav>{item("conversation", "Conversations", HomeIcon)}{item("documents", "Documents", FileText)}{item("labs", "Lab timeline", TrendingUp)}{item("medication", "Medications", Pill)}{item("visit", "Visit preparation", Stethoscope)}</nav><div className="sidebar-label knowledge-label">KNOWLEDGE</div><nav>{item("sources", "Sources", BookOpen)}</nav><div className="sidebar-label system-label">SYSTEM</div><nav><button className="nav-item" onClick={onPrivacy}><ShieldCheck size={17} /> Privacy</button>{item("system", "System status", Activity)}<button className="nav-item"><Settings size={17} /> Settings</button></nav><div className="sidebar-footer"><span className="status-dot" /> <div><strong>Private local mode</strong><small>Human-verified provenance</small></div></div></aside>; }

function Conversation({ answer, status, streaming, sources, messages, loading, error, selectedSource, setSelectedSource, onRetry, onPreset, onOpenView, onUpload, onAction }: { answer: string; status: AnswerStatus; streaming: boolean; sources: Source[]; question: string; messages: Message[]; loading: string; error: string; selectedSource: number | null; setSelectedSource: (value: number | null) => void; onRetry: () => void; onPreset: (prompt: string) => void; onOpenView: (view: View) => void; onUpload: () => void; onAction: (action: "copy" | "listen" | "simple" | "questions") => void }) {
  const lastQuestion = [...messages].reverse().find((item) => item.role === "user");
  const empty = !answer && !loading && !lastQuestion;
  return <div className="conversation-view">
    <div className="conversation-header">
      <div>
        <p className="eyebrow">PRIVATE • LOCAL • EVIDENCE-SUPPORTED</p>
        <h2>{answer ? "Your health question, clarified." : "What can I help you understand today?"}</h2>
        {!answer && <p>Ask a health question, review a document, use your voice, or prepare for an appointment — in one private workspace.</p>}
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
    {error && <div className="service-error"><Activity size={19} /><div><strong>{error}</strong><p>Your question has not been sent.</p></div><button onClick={onRetry}><RefreshCw size={15} /> Retry</button></div>}
    {loading && <div className="processing"><Sparkles size={17} /><span>{loading}</span><i /><i /><i /></div>}
    {answer && <Answer answer={answer} status={status} streaming={streaming} sources={sources} selectedSource={selectedSource} setSelectedSource={setSelectedSource} onAction={onAction} onPreset={onPreset} onOpenView={onOpenView} />}
  </div>;
}

function Answer({ answer, status, streaming, sources, selectedSource, setSelectedSource, onAction, onPreset, onOpenView }: { answer: string; status: AnswerStatus; streaming: boolean; sources: Source[]; selectedSource: number | null; setSelectedSource: (value: number | null) => void; onAction: (action: "copy" | "listen" | "simple" | "questions") => void; onPreset: (prompt: string) => void; onOpenView: (view: View) => void }) {
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
    const numbers = /^\[\d+(?:,\s*\d+)*\]$/.test(part) ? part.match(/\d+/g) : null;
    if (!numbers) return part.replace(/^#+\s*/, "");
    return numbers.map((num, index) => (
      <button className={selectedSource === Number(num) ? "citation selected" : "citation"} onClick={() => setSelectedSource(Number(num))} key={`${key}-${index}`}>[{num}]</button>
    ));
  };
  return <article className="answer-document"><div className="answer-kicker"><span><Sparkles size={14} /> MEDIGUIDE</span><small>{streaming ? "Writing..." : "Evidence checked"}</small></div><div className="answer-content">{lines.map((line, index) => { const heading = line.startsWith("#"); const parts = line.split(/(\[\d+(?:,\s*\d+)*\])/g); return <p className={heading ? "answer-heading" : ""} key={index}>{parts.map((part, partIndex) => renderPart(part, `${index}-${partIndex}`))}</p>; })}{streaming && <span className="streaming-cursor" aria-hidden />}</div>{!streaming && <div className="response-actions"><button onClick={() => onAction("copy")}><Clipboard size={14} /> Copy</button><button onClick={() => onAction("listen")}><Volume2 size={14} /> Listen</button><button onClick={() => onAction("simple")}><Sparkles size={14} /> Explain simply</button><button onClick={() => onAction("questions")}><Stethoscope size={14} /> Questions for clinician</button><button onClick={() => setSelectedSource(sources.length ? sources[0].number : null)}><BookOpen size={14} /> Show sources</button></div>}<p className="answer-safety-note"><ShieldCheck size={13} /> General educational information, not a diagnosis or personalized treatment recommendation.</p></article>;
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
    <textarea value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={onKeyDown} placeholder="Ask a health question, explain a document, or prepare for a visit..." rows={3} />
    <div className="composer-footer">
      <div>
        <span>Enter to send · Shift + Enter for a new line</span>
      </div>
      <button className="send-button" disabled={loading || !question.trim()} aria-label="Send"><ArrowUp size={20} /></button>
    </div>
  </form>;
}

function Evidence({ sources, selected, onSelect }: { sources: Source[]; selected: number | null; onSelect: (value: number | null) => void }) {
  return <aside className="evidence workspace-evidence">
    <div className="evidence-top">
      <div>
        <p className="eyebrow">EVIDENCE</p>
        <h3>Sources &amp; context</h3>
      </div>
      <button className="icon-button" title="Search sources"><BookOpen size={17} /></button>
    </div>
    {sources.length ? <>
      <div className="support-level"><span>Evidence support</span><strong>{sources.length > 2 ? "STRONG" : sources.length === 2 ? "PARTIAL" : "LIMITED"}</strong></div>
      {sources.map((source) => <button className={selected === source.number ? "source-card selected" : "source-card"} key={source.number} onClick={() => onSelect(source.number)}><span className="source-number">[{source.number}]</span><span><strong>{source.publisher}</strong><b>{source.title}</b><small>{source.reviewed ? `Reviewed ${source.reviewed}` : "Approved knowledge source"}</small><em>Relevant passage available <ArrowUpRight size={12} /></em></span></button>)}
    </> : <div className="evidence-empty">
      <BookOpen size={22} />
      <strong>Citations appear beside answers</strong>
      <p>MedlinePlus, CDC, FDA, and other approved sources will show publisher, topic, and review date here.</p>
      <ul className="evidence-promise">
        <li><Check size={13} /> Cited answers</li>
        <li><Check size={13} /> Local retrieval</li>
        <li><Check size={13} /> Passage context</li>
      </ul>
    </div>}
    <div className="evidence-note"><ShieldCheck size={16} /><span>Sources are retrieved from the approved local knowledge base.</span></div>
  </aside>;
}

const DOC_STATUS_LABELS: Record<DocFieldStatus, string> = { in_listed_range: "In range", outside_listed_range: "Outside range", not_applicable: "N/A", unknown: "Unknown" };
const DOC_CONFIDENCE_LABELS: Record<DocFieldConfidence, string> = { clearly_visible: "Clearly visible", needs_review: "Needs review", could_not_read: "Could not read" };

function Documents({
  apiUrl, docState, docFields, docConfirmed, docReviewChecked, setDocReviewChecked,
  docSelectedPage, setDocSelectedPage, docExplain, docQuestion, setDocQuestion,
  selectedSource, setSelectedSource,
  dragging, onUpload, onDrop, onDragEnter, onDragLeave, onFieldChange, onConfirm, onExplain, onReset,
  loading, error,
}: {
  apiUrl: string;
  docState: DocState | null;
  docFields: DocField[];
  docConfirmed: boolean;
  docReviewChecked: boolean;
  setDocReviewChecked: (value: boolean) => void;
  docSelectedPage: number;
  setDocSelectedPage: (value: number) => void;
  docExplain: DocExplain | null;
  docQuestion: string;
  setDocQuestion: (value: string) => void;
  selectedSource: number | null;
  setSelectedSource: (value: number | null) => void;
  dragging: boolean;
  onUpload: () => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnter: () => void;
  onDragLeave: () => void;
  onFieldChange: (fieldId: string, patch: Partial<Pick<DocField, "value" | "unit" | "reference_range">>) => void;
  onConfirm: () => void;
  onExplain: () => void;
  onReset: () => void;
  loading: string;
  error: string;
}) {
  if (!docState) {
    return <div className="workflow-view">
      <div className="workflow-heading-row">
        <div><p className="eyebrow">DOCUMENT REVIEW</p><h2>Understand the details.</h2><p className="workflow-lead">Upload a lab report, medication label, or health document — review every extracted value before MediGuide explains it.</p></div>
        <span className="workflow-badge"><ShieldCheck size={14} /> Human review first</span>
      </div>
      {!loading && <div className={dragging ? "upload-zone is-dragging" : "upload-zone"} onDrop={onDrop} onDragEnter={(event) => { event.preventDefault(); onDragEnter(); }} onDragOver={(event) => event.preventDefault()} onDragLeave={onDragLeave}>
        <span className="upload-art"><FileText size={25} /><span><ImageIcon size={14} /></span></span>
        <strong>Upload a health document</strong>
        <span>Drop a PDF or image here, or choose a file</span>
        <small>PDF, PNG, JPG, WEBP · Multi-page supported · Temporary session file</small>
        <button className="forest-button" onClick={onUpload}>Choose file <Paperclip size={16} /></button>
      </div>}
      {loading && <div className="processing large"><Sparkles size={18} /> {loading}<i /><i /><i /></div>}
      {error && <div className="service-error"><Activity size={19} /><div><strong>{error}</strong><p>Your document has not been added.</p></div></div>}
    </div>;
  }

  const visibleFields = docFields.filter((field) => field.page_number === docSelectedPage);
  const activePreview = docState.pages.find((page) => page.page_number === docSelectedPage) || docState.pages[0];

  return <div className="workflow-view doc-intel-view">
    <div className="workflow-heading-row">
      <div><p className="eyebrow">DOCUMENT REVIEW</p><h2>{docState.filename}</h2><p className="workflow-lead">{docState.page_count} page{docState.page_count === 1 ? "" : "s"} · {docConfirmed ? "Confirmed by you" : "Review each value before confirming"}</p></div>
      <button className="quiet-button" onClick={onReset}><RefreshCw size={14} /> Upload a different document</button>
    </div>

    {error && <div className="service-error"><Activity size={19} /><div><strong>{error}</strong><p>Try again below.</p></div></div>}

    {docState.page_count > 1 && <div className="page-strip" aria-label="Document pages">
      {docState.pages.map((page) => (
        <button key={page.page_number} className={docSelectedPage === page.page_number ? "page-thumb selected" : "page-thumb"} onClick={() => setDocSelectedPage(page.page_number)}>
          <img src={`${apiUrl}${page.preview_url}`} alt={`Page ${page.page_number} preview`} />
          <span>Page {page.page_number}</span>
        </button>
      ))}
    </div>}

    <div className="extraction-grid doc-review-grid">
      <div className="document-preview doc-page-preview">
        {activePreview ? <img src={`${apiUrl}${activePreview.preview_url}`} alt={`Page ${docSelectedPage} preview`} /> : <FileText size={38} />}
        <small>Check names, values, units, dates, and reference ranges</small>
      </div>

      <div className="extracted-fields doc-fields">
        <p className="eyebrow">PAGE {docSelectedPage} · EXTRACTED VALUES</p>
        {visibleFields.length === 0 && <p className="doc-fields-empty">No fields were extracted on this page.</p>}
        {visibleFields.map((field) => (
          <div key={field.field_id} className={`doc-field-row status-${field.status}`}>
            <div className="doc-field-label">
              <strong>{field.label}</strong>
              <span className={`confidence-pill confidence-${field.confidence}`}>{DOC_CONFIDENCE_LABELS[field.confidence]}</span>
              {(field.status === "in_listed_range" || field.status === "outside_listed_range") && <span className={`status-pill status-pill-${field.status}`}>{DOC_STATUS_LABELS[field.status]}</span>}
            </div>
            <div className="doc-field-inputs">
              <label>Value<input value={field.value} readOnly={docConfirmed} onChange={(event) => onFieldChange(field.field_id, { value: event.target.value })} /></label>
              <label>Unit<input value={field.unit} readOnly={docConfirmed} onChange={(event) => onFieldChange(field.field_id, { unit: event.target.value })} /></label>
              <label>Reference range<input value={field.reference_range} readOnly={docConfirmed} onChange={(event) => onFieldChange(field.field_id, { reference_range: event.target.value })} /></label>
            </div>
          </div>
        ))}

        {!docConfirmed && <div className="confirm-gate">
          <label className="confirm"><input type="checkbox" checked={docReviewChecked} onChange={(event) => setDocReviewChecked(event.target.checked)} /> I reviewed the names, values, units, dates, and reference ranges above.</label>
          <button className="forest-button" disabled={!docReviewChecked || Boolean(loading)} onClick={onConfirm}>Confirm reviewed values <Check size={16} /></button>
        </div>}

        {docConfirmed && !docExplain && <div className="explain-gate">
          <label>Ask a question about this document (optional)<textarea rows={2} value={docQuestion} onChange={(event) => setDocQuestion(event.target.value)} placeholder="Explain the confirmed information in plain language and suggest questions for a qualified healthcare professional." /></label>
          <button className="forest-button" disabled={Boolean(loading)} onClick={onExplain}>Get AI explanation <ArrowUpRight size={16} /></button>
        </div>}
      </div>
    </div>

    {loading && <div className="processing"><Sparkles size={17} /><span>{loading}</span><i /><i /><i /></div>}

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
    <div className="answer-kicker"><span><Sparkles size={14} /> MEDIGUIDE</span><small>Document explanation</small></div>
    <div className="answer-content">
      {lines.map((line, index) => {
        const heading = line.startsWith("#");
        const parts = line.split(/(\[D\d+\]|\[\d+(?:,\s*\d+)*\])/g);
        return <p className={heading ? "answer-heading" : ""} key={index}>{parts.map((part, partIndex) => renderPart(part, `${index}-${partIndex}`))}</p>;
      })}
    </div>
    {explain.limitations.length > 0 && <div className="doc-limitations"><p className="eyebrow">LIMITATIONS</p><ul>{explain.limitations.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
    <p className="answer-safety-note"><ShieldCheck size={13} /> General educational information, not a diagnosis or personalized treatment recommendation.</p>
  </article>;
}

function Medication({
  apiUrl, medState, medFields, medConfirmed, medReviewChecked, setMedReviewChecked,
  medInfo, medQuestion, setMedQuestion, medTypedText, setMedTypedText,
  selectedSource, setSelectedSource,
  dragging, onUpload, onDrop, onDragEnter, onDragLeave, onFieldChange, onConfirm, onGetInfo, onSubmitTyped, onReset,
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
        <button className="forest-button" onClick={onUpload}>Choose file <Paperclip size={16} /></button>
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
          <button className="forest-button" disabled={Boolean(loading)} onClick={onGetInfo}>Get educational information <ArrowUpRight size={16} /></button>
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

function Visit({ fields, setFields, onGenerate }: { fields: Record<string, string>; setFields: (value: Record<string, string>) => void; onGenerate: () => void }) { const names = ["Main concern", "Symptoms", "Symptom timeline", "Duration", "Severity", "Triggers", "Medications entered by user", "Questions for clinician", "Missing information"]; return <div className="workflow-view"><p className="eyebrow">VISIT PREPARATION</p><h2>Make the visit count.</h2><p className="workflow-lead">Organize patient-provided information and turn uncertainty into useful questions.</p><div className="visit-form">{names.map((name) => <label key={name}>{name}<textarea rows={name === "Symptoms" || name === "Questions for clinician" ? 3 : 2} value={fields[name] || ""} onChange={(event) => setFields({ ...fields, [name]: event.target.value })} placeholder={`Add ${name.toLowerCase()}...`} /></label>)}</div><p className="patient-note"><ShieldCheck size={16} /> Patient-provided information — not a diagnosis.</p><button className="forest-button" onClick={onGenerate}>Generate visit summary <ArrowUpRight size={16} /></button></div>; }

function LabTimeline({ tests, selectedCode, onSelectCode, points, selectedPoint, onSelectPoint, apiUrl }: { tests: LabTest[]; selectedCode: string; onSelectCode: (code: string) => void; points: LabPoint[]; selectedPoint: LabPoint | null; onSelectPoint: (point: LabPoint | null) => void; apiUrl: string }) {
  const maxValue = Math.max(...points.map((point) => point.value ?? 0), 1);
  return <div className="workflow-view lab-timeline-view">
    <p className="eyebrow">LAB RESULTS TIMELINE</p>
    <h2>Verified observations over time.</h2>
    <p className="workflow-lead">Every point links back to a confirmed document page — document, page, field, date, unit, and verification state.</p>
    <div className="lab-test-row" role="tablist" aria-label="Tracked lab tests">
      {(tests.length ? tests : [{ test_code: "hemoglobin", display_name: "Hemoglobin", observation_count: 0, has_data: false }]).map((test) => (
        <button key={test.test_code} type="button" className={selectedCode === test.test_code ? "lab-test-chip active" : "lab-test-chip"} onClick={() => onSelectCode(test.test_code)}>
          {test.display_name}
          <small>{test.observation_count}</small>
        </button>
      ))}
    </div>
    <div className="lab-chart-panel">
      {points.length ? (
        <div className="lab-chart" role="list">
          {points.map((point) => {
            const height = Math.max(12, ((point.value ?? 0) / maxValue) * 100);
            return <button type="button" key={point.observation_id} className={selectedPoint?.observation_id === point.observation_id ? "lab-point selected" : "lab-point"} style={{ height: `${height}%` }} onClick={() => onSelectPoint(point)} role="listitem" title={`${point.value_text} ${point.unit}`}>
              <span className="lab-point-dot" />
              <strong>{point.value_text}</strong>
              <small>{point.report_date || "Unknown date"}</small>
            </button>;
          })}
        </div>
      ) : (
        <div className="lab-empty">
          <TrendingUp size={22} />
          <strong>No verified observations yet</strong>
          <p>Confirm a lab report in Documents, or run <code>python scripts/seed_demo_labs.py</code> for sample portfolio data.</p>
        </div>
      )}
    </div>
    {selectedPoint && <aside className="lab-point-detail">
      <p className="eyebrow">RESULT DETAILS</p>
      <h3>{selectedPoint.value_text} {selectedPoint.unit}</h3>
      <p className="lab-verified"><Check size={14} /> {selectedPoint.verification_state === "human_verified" ? "Human verified" : selectedPoint.verification_state}</p>
      <dl>
        <div><dt>Test</dt><dd>{selectedPoint.test_name}</dd></div>
        <div><dt>Report date</dt><dd>{selectedPoint.report_date || "Not listed"}</dd></div>
        <div><dt>Document</dt><dd>{selectedPoint.document_name}</dd></div>
        <div><dt>Page</dt><dd>{selectedPoint.page_number}</dd></div>
        <div><dt>Field</dt><dd>{selectedPoint.field_id}</dd></div>
        {selectedPoint.reference_text ? <div><dt>Reference</dt><dd>{selectedPoint.reference_text}</dd></div> : null}
      </dl>
      <a className="forest-button" href={`${apiUrl}/api/documents/v2/${selectedPoint.document_id}/pages/${selectedPoint.page_number}/preview`} target="_blank" rel="noreferrer">Open source page</a>
    </aside>}
  </div>;
}

function SystemStatusView({ status, health, onRetry }: { status: SystemStatus | null; health: HealthResponse | null; onRetry: () => void }) {
  const components = status?.components || Object.entries(health?.statuses || {}).map(([key, value]) => ({ name: healthLabels[key] || key, key, status: value.status, detail: value.detail }));
  const knowledge = status?.knowledge || health?.knowledge || {};
  return <div className="workflow-view system-status-view">
    <p className="eyebrow">SYSTEM</p>
    <h2>MediGuide System</h2>
    <p className="workflow-lead">Component health for the local AI stack — no credentials, internal URLs, or file paths.</p>
    <div className="system-grid">
      {components.map((component) => (
        <div key={component.key} className="system-card">
          <span className={component.status === "ready" ? "status-dot" : "status-dot off"} />
          <div>
            <strong>{component.name}</strong>
            <small>{component.detail}</small>
          </div>
        </div>
      ))}
    </div>
    <div className="knowledge-panel">
      <h3>Knowledge base</h3>
      <p><strong>{knowledge.active_chunks ?? "—"}</strong> active chunks</p>
      <p><strong>{knowledge.approved_sources ?? "—"}</strong> approved sources</p>
    </div>
    <button className="forest-button" onClick={onRetry}><RefreshCw size={15} /> Refresh status</button>
  </div>;
}

function Sources({ sources, library, onSelect }: { sources: Source[]; library: LibrarySource[]; onSelect: (value: number) => void }) {
  if (sources.length) {
    return <div className="workflow-view"><p className="eyebrow">THIS ANSWER</p><h2>Cited sources.</h2><p className="workflow-lead">Evidence backing your most recent answer.</p><div className="source-list">{sources.map((source) => <button key={source.number} onClick={() => onSelect(source.number)}><span>[{source.number}]</span><div><strong>{source.publisher}</strong><b>{source.title}</b><small>{source.reviewed || "Approved source"}</small></div><ChevronRight size={17} /></button>)}</div></div>;
  }
  return <div className="workflow-view"><p className="eyebrow">KNOWLEDGE BASE</p><h2>Approved sources.</h2><p className="workflow-lead">Trusted local retrieval keeps answers grounded and transparent. Ask a question to see which of these support your answer.</p><div className="source-list">{library.length ? library.map((source) => <a key={source.id} href={source.url || undefined} target={source.url ? "_blank" : undefined} rel={source.url ? "noreferrer" : undefined} className={source.url ? "" : "no-link"}><span><BookOpen size={15} /></span><div><strong>{source.publisher}</strong><b>{source.title}</b><small>{source.reviewed ? `Reviewed ${source.reviewed}` : "Approved source"}</small></div>{source.url && <ArrowUpRight size={16} />}</a>) : <div className="empty-panel"><BookOpen size={23} /><p>The knowledge base is still loading.</p></div>}</div></div>;
}

function Privacy({ onClose, onClear }: { onClose: () => void; onClear: () => void }) { return <div className="drawer-backdrop" onClick={onClose}><aside className="drawer" onClick={(event) => event.stopPropagation()}><button className="drawer-close" onClick={onClose}><X size={18} /></button><p className="eyebrow">PRIVACY CENTER</p><h2>Private local processing.</h2><p>Your session is designed to stay close to your device.</p><ul><li><Check size={16} /> Local language model</li><li><Check size={16} /> Local speech transcription</li><li><Check size={16} /> Local document processing</li><li><Check size={16} /> Trusted local retrieval</li><li><Check size={16} /> Chat persistence disabled</li><li><Check size={16} /> Temporary audio cleanup</li></ul><div className="drawer-warning"><strong>Public demo mode</strong><span>Do not enter identifying health information.</span></div><button className="drawer-action" onClick={onClear}><Trash2 size={16} /> Clear session</button><button className="drawer-action secondary"><RefreshCw size={16} /> Clear temporary files</button></aside></div>; }

function Health({ health, onClose, onRetry }: { health: HealthResponse | null; onClose: () => void; onRetry: () => void }) { return <div className="drawer-backdrop" onClick={onClose}><aside className="drawer health-drawer" onClick={(event) => event.stopPropagation()}><button className="drawer-close" onClick={onClose}><X size={18} /></button><p className="eyebrow">SYSTEM STATUS</p><h2>{health?.status === "ok" ? "All systems ready." : "Some services need attention."}</h2><p>{health ? `${health.ready} of ${health.total} services ready.` : "Checking the local AI service..."}</p><div className="health-list">{Object.entries(health?.statuses || {}).map(([key, value]) => <div key={key}><span className={value.status === "ready" ? "status-dot" : "status-dot off"} /><strong>{healthLabels[key] || key}</strong><small>{value.detail}</small></div>)}</div><button className="drawer-action" onClick={onRetry}><RefreshCw size={16} /> Check again</button></aside></div>; }
