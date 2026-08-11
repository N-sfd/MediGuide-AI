"use client";

import { ChangeEvent, DragEvent, FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { Activity, ArrowUp, ArrowUpRight, BookOpen, Check, ChevronRight, Clipboard, FileText, HelpCircle, Home as HomeIcon, Image as ImageIcon, Menu, Mic, Paperclip, Plus, RefreshCw, Settings, ShieldCheck, Sparkles, Stethoscope, Trash2, UserRound, Volume2, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PremiumLanding } from "./premium-landing";
import "./workspace.css";

type Source = { number: number; title: string; publisher: string; published?: string; reviewed?: string; url?: string };
type Message = { role: "user" | "assistant"; content: string };
type HealthStatus = { status: string; detail: string };
type HealthResponse = { status: string; ready: number; total: number; statuses: Record<string, HealthStatus> };
type View = "conversation" | "documents" | "visit" | "sources";

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
const healthLabels: Record<string, string> = { fastapi: "FastAPI", ollama: "Ollama", text_model: "Text model", vision_model: "Vision model", embedding_model: "Embedding model", vector_store: "Vector store", whisper: "Whisper", piper: "Piper TTS", translation_model: "Translation model" };

export default function Home() {
  const [workspace, setWorkspace] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [view, setView] = useState<View>("conversation");
  const [messages, setMessages] = useState<Message[]>([]);
  const [answer, setAnswer] = useState("");
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
  const [document, setDocument] = useState<{ name: string; data: Record<string, unknown> } | null>(null);
  const [documentPreviewUrl, setDocumentPreviewUrl] = useState<string | null>(null);
  const [documentDragging, setDocumentDragging] = useState(false);
  const [visitFields, setVisitFields] = useState<Record<string, string>>({});
  const fileInput = useRef<HTMLInputElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  useEffect(() => { if (workspace) void checkHealth(); }, [workspace]);
  useEffect(() => () => { if (documentPreviewUrl) URL.revokeObjectURL(documentPreviewUrl); }, [documentPreviewUrl]);
  useEffect(() => {
    if (!mobileNavOpen) return;
    const closeOnEscape = (event: globalThis.KeyboardEvent) => { if (event.key === "Escape") setMobileNavOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileNavOpen]);

  async function checkHealth() {
    try { const response = await fetch(`${API_URL}/api/health`); if (!response.ok) throw new Error(); setHealth(await response.json()); }
    catch { setHealth({ status: "unavailable", ready: 0, total: 9, statuses: {} }); }
  }

  async function sendQuestion(event?: FormEvent, preset?: string) {
    event?.preventDefault();
    const text = (preset ?? question).trim();
    if (!text || loadingStage) return;
    setWorkspace(true); setView("conversation"); setQuestion(""); setError(""); setLoadingStage("Checking safety...");
    const nextHistory = [...messages, { role: "user" as const, content: text }];
    setMessages(nextHistory); setAnswer(""); setSources([]);
    try {
      setLoadingStage("Searching trusted sources...");
      const response = await fetch(`${API_URL}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text, history: messages }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "The local AI service is unavailable.");
      setLoadingStage("Validating citations...");
      setAnswer(data.answer || "No answer was returned."); setSources(data.sources || []); setMessages([...nextHistory, { role: "assistant", content: data.answer || "" }]);
    } catch { setError(API_URL ? "MediGuide could not reach the local AI service." : API_CONFIGURATION_MESSAGE); setMessages(messages); }
    finally { setLoadingStage(""); }
  }

  async function uploadDocument(file: File) {
    setView("documents"); setError(""); setDocumentDragging(false); setDocumentPreviewUrl(file.type.startsWith("image/") ? URL.createObjectURL(file) : null); setLoadingStage("Reading visible information...");
    const form = new FormData(); form.append("file", file);
    try {
      const response = await fetch(`${API_URL}/api/documents/analyze`, { method: "POST", body: form }); const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Document analysis failed.");
      setDocument({ name: file.name, data: data.data || {} }); setLoadingStage("");
    } catch { setDocumentPreviewUrl(null); setLoadingStage(""); setError(API_URL ? "MediGuide could not read that document. Check the file and try again." : API_CONFIGURATION_MESSAGE); }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) { event.preventDefault(); setDocumentDragging(false); const file = event.dataTransfer.files[0]; if (file) void uploadDocument(file); }
  function onFileChange(event: ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; if (file) void uploadDocument(file); }

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
  function clearSession() { setMessages([]); setAnswer(""); setQuestion(""); setSources([]); setDocument(null); setDocumentPreviewUrl(null); setError(""); setView("conversation"); }
  function retry() { const last = [...messages].reverse().find((item) => item.role === "user"); if (last) void sendQuestion(undefined, last.content); }
  function copyAnswer() { if (answer) void navigator.clipboard?.writeText(answer); }
  function readAnswer() { if (!answer) return; void fetch(`${API_URL}/api/speak`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: answer.replace(/[#*_\[\]]/g, "") }) }).then(async (response) => { if (!response.ok) throw new Error(); const audio = new Audio(URL.createObjectURL(await response.blob())); await audio.play(); }).catch(() => setError("Spoken output is unavailable right now.")); }
  async function translateAnswer(target: string) { if (!answer) return; setLoadingStage(`Translating to ${target}...`); try { const response = await fetch(`${API_URL}/api/translate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: answer, language: target }) }); const data = await response.json(); if (!response.ok) throw new Error(); setAnswer(data.text || answer); setLanguage(target); } catch { setError("MediGuide could not translate this answer right now."); } finally { setLoadingStage(""); } }
  function generateVisitSummary() { const summary = Object.entries(visitFields).filter(([, value]) => value.trim()).map(([key, value]) => `${key}: ${value}`).join("\n\n"); setQuestion(`Help me prepare questions for a healthcare professional using these patient-provided notes:\n\n${summary}`); setView("conversation"); }

  if (!workspace) return <PremiumLanding onStart={() => setWorkspace(true)} />;
  const handleViewChange = (nextView: View) => { setView(nextView); setMobileNavOpen(false); };
  return <main className="product-shell workspace-enter"><header className="app-header"><button className="app-brand" onClick={() => setWorkspace(false)}><span className="brand-mark"><ShieldCheck size={15} /></span><span>MediGuide <em>AI</em></span></button><span className="header-context">Private · Local · Evidence-supported</span><div className="header-actions"><select className="language-select" value={language} onChange={(event) => void translateAnswer(event.target.value)} aria-label="Response language"><option>English</option><option>Spanish</option><option>French</option></select><button className="local-pill" onClick={() => setHealthOpen(true)}><span /> Private local</button><button className="icon-button" title="Help"><HelpCircle size={18} /></button><button className="icon-button" title="Settings"><Settings size={18} /></button><button className="profile-button" title="Profile"><UserRound size={17} /></button></div><button className="mobile-menu icon-button" title="Open navigation" aria-label="Open navigation" aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen(true)}><Menu size={20} /></button></header>{mobileNavOpen && <button className="mobile-nav-backdrop" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}<div className={mobileNavOpen ? "workspace-grid mobile-nav-visible" : "workspace-grid"}><Sidebar view={view} setView={handleViewChange} onNew={() => { clearSession(); setMobileNavOpen(false); }} onPrivacy={() => { setPrivacyOpen(true); setMobileNavOpen(false); }} onClose={() => setMobileNavOpen(false)} /><section className="main-panel">{view === "conversation" && <Conversation answer={answer} sources={sources} question={question} messages={messages} loading={loadingStage} error={error} selectedSource={selectedSource} setSelectedSource={setSelectedSource} onRetry={retry} onPreset={(prompt) => setQuestion(prompt)} onOpenView={handleViewChange} onUpload={() => fileInput.current?.click()} onAction={(action) => { if (action === "copy") copyAnswer(); if (action === "listen") readAnswer(); if (action === "simple") void sendQuestion(undefined, `Explain this answer simply:\n\n${answer}`); if (action === "questions") { setQuestion("What questions should I ask my clinician about this?"); } }} />}{view === "documents" && <Documents document={document} previewUrl={documentPreviewUrl} dragging={documentDragging} onUpload={() => fileInput.current?.click()} onDrop={onDrop} onDragEnter={() => setDocumentDragging(true)} onDragLeave={() => setDocumentDragging(false)} loading={loadingStage} error={error} />}{view === "visit" && <Visit fields={visitFields} setFields={setVisitFields} onGenerate={generateVisitSummary} />}{view === "sources" && <Sources sources={sources} onSelect={setSelectedSource} />}{view !== "documents" && view !== "visit" && <Composer question={question} setQuestion={setQuestion} onSubmit={sendQuestion} onKeyDown={handleComposerKey} onUpload={() => fileInput.current?.click()} onVoice={toggleVoice} recording={recording} loading={Boolean(loadingStage)} />}<input ref={fileInput} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,image/*" hidden onChange={onFileChange} /></section><Evidence sources={sources} selected={selectedSource} onSelect={setSelectedSource} /></div>{privacyOpen && <Privacy onClose={() => setPrivacyOpen(false)} onClear={clearSession} />}{healthOpen && <Health health={health} onClose={() => setHealthOpen(false)} onRetry={checkHealth} />}</main>;
}

/* Legacy landing markup retained for reference; PremiumLanding is the public entry point. */

function Sidebar({ view, setView, onNew, onPrivacy, onClose }: { view: View; setView: (view: View) => void; onNew: () => void; onPrivacy: () => void; onClose: () => void }) { const item = (target: View, label: string, Icon: LucideIcon) => <button className={view === target ? "nav-item active" : "nav-item"} onClick={() => setView(target)}><Icon size={17} />{label}</button>; return <aside className="sidebar"><div className="mobile-sidebar-head"><span>Navigate</span><button className="icon-button" title="Close navigation" aria-label="Close navigation" onClick={onClose}><X size={18} /></button></div><div className="sidebar-label">WORKSPACE</div><button className="new-conversation" onClick={onNew}><Plus size={17} /> New conversation</button><nav>{item("conversation", "Conversations", HomeIcon)}{item("documents", "Documents", FileText)}{item("visit", "Visit preparation", Stethoscope)}</nav><div className="sidebar-label knowledge-label">KNOWLEDGE</div><nav>{item("sources", "Sources", BookOpen)}</nav><div className="sidebar-label system-label">SYSTEM</div><nav><button className="nav-item" onClick={onPrivacy}><ShieldCheck size={17} /> Privacy</button><button className="nav-item"><Settings size={17} /> Settings</button></nav><div className="sidebar-footer"><span className="status-dot" /> <div><strong>Private local mode</strong><small>Session-only storage</small></div></div></aside>; }

function Conversation({ answer, sources, messages, loading, error, selectedSource, setSelectedSource, onRetry, onPreset, onOpenView, onUpload, onAction }: { answer: string; sources: Source[]; question: string; messages: Message[]; loading: string; error: string; selectedSource: number | null; setSelectedSource: (value: number | null) => void; onRetry: () => void; onPreset: (prompt: string) => void; onOpenView: (view: View) => void; onUpload: () => void; onAction: (action: "copy" | "listen" | "simple" | "questions") => void }) {
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
    {error && <div className="service-error"><Activity size={19} /><div><strong>MediGuide couldn’t reach the local AI service.</strong><p>Your question has not been sent.</p></div><button onClick={onRetry}><RefreshCw size={15} /> Retry</button></div>}
    {loading && <div className="processing"><Sparkles size={17} /><span>{loading}</span><i /><i /><i /></div>}
    {answer && <Answer answer={answer} sources={sources} selectedSource={selectedSource} setSelectedSource={setSelectedSource} onAction={onAction} onPreset={onPreset} onOpenView={onOpenView} />}
  </div>;
}

function Answer({ answer, sources, selectedSource, setSelectedSource, onAction, onPreset, onOpenView }: { answer: string; sources: Source[]; selectedSource: number | null; setSelectedSource: (value: number | null) => void; onAction: (action: "copy" | "listen" | "simple" | "questions") => void; onPreset: (prompt: string) => void; onOpenView: (view: View) => void }) {
  const limited = /Limited trusted information available|Not enough trusted information found/i.test(answer);
  if (limited) {
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
  const lines = answer.split("\n");
  return <article className="answer-document"><div className="answer-kicker"><span><Sparkles size={14} /> MEDIGUIDE</span><small>Evidence checked</small></div><div className="answer-content">{lines.map((line, index) => { const heading = line.startsWith("#"); const parts = line.split(/(\[\d+\])/g); return <p className={heading ? "answer-heading" : ""} key={index}>{parts.map((part, partIndex) => /^\[\d+\]$/.test(part) ? <button className={selectedSource === Number(part.replace(/\D/g, "")) ? "citation selected" : "citation"} onClick={() => setSelectedSource(Number(part.replace(/\D/g, "")))} key={partIndex}>{part}</button> : part.replace(/^#+\s*/, ""))}</p>; })}</div><div className="response-actions"><button onClick={() => onAction("copy")}><Clipboard size={14} /> Copy</button><button onClick={() => onAction("listen")}><Volume2 size={14} /> Listen</button><button onClick={() => onAction("simple")}><Sparkles size={14} /> Explain simply</button><button onClick={() => onAction("questions")}><Stethoscope size={14} /> Questions for clinician</button><button onClick={() => setSelectedSource(sources.length ? sources[0].number : null)}><BookOpen size={14} /> Show sources</button></div></article>;
}

function Composer({ question, setQuestion, onSubmit, onKeyDown, onUpload, onVoice, recording, loading }: { question: string; setQuestion: (value: string) => void; onSubmit: (event?: FormEvent) => void; onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void; onUpload: () => void; onVoice: () => void; recording: boolean; loading: boolean }) {
  return <form className="composer workspace-composer" onSubmit={onSubmit} onDragOver={(event) => event.preventDefault()}>
    <div className="composer-tools">
      <button type="button" onClick={onUpload}><Paperclip size={15} /> Document</button>
      <button type="button" className={recording ? "recording voice-trigger" : "voice-trigger"} onClick={onVoice}><Mic size={15} /> {recording ? "Listening locally" : "Voice"}</button>
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
      <div className="support-level"><span>Evidence support</span><strong>{sources.length > 2 ? "STRONG" : sources.length === 2 ? "MODERATE" : "LIMITED"}</strong></div>
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

function Documents({ document, previewUrl, dragging, onUpload, onDrop, onDragEnter, onDragLeave, loading, error }: { document: { name: string; data: Record<string, unknown> } | null; previewUrl: string | null; dragging: boolean; onUpload: () => void; onDrop: (event: DragEvent<HTMLDivElement>) => void; onDragEnter: () => void; onDragLeave: () => void; loading: string; error: string }) { return <div className="workflow-view"><div className="workflow-heading-row"><div><p className="eyebrow">DOCUMENT REVIEW</p><h2>Understand the details.</h2><p className="workflow-lead">Review visible information before it becomes part of a question.</p></div><span className="workflow-badge"><ShieldCheck size={14} /> Human review first</span></div>{!document && !loading && <div className={dragging ? "upload-zone is-dragging" : "upload-zone"} onDrop={onDrop} onDragEnter={(event) => { event.preventDefault(); onDragEnter(); }} onDragOver={(event) => event.preventDefault()} onDragLeave={onDragLeave}><span className="upload-art"><FileText size={25} /><span><ImageIcon size={14} /></span></span><strong>Upload a health document</strong><span>Drop an image or PDF here, or choose a file</span><small>PDF, PNG, JPG, WEBP · Temporary session file</small><button className="forest-button" onClick={onUpload}>Choose file <Paperclip size={16} /></button></div>}{loading && <div className="processing large"><Sparkles size={18} /> {loading}<i /><i /><i /></div>}{error && <div className="service-error"><Activity size={19} /><div><strong>{error}</strong><p>Your document has not been added.</p></div></div>}{document && <div className="document-review"><div className="document-meta"><FileText size={18} /><span><strong>{document.name}</strong><small>Ready for review · temporary session file</small></span><Check size={18} /></div><div className="extraction-grid"><div className="document-preview">{previewUrl ? <img src={previewUrl} alt="Uploaded health document preview" /> : <FileText size={38} />}<span>{previewUrl ? "Uploaded image" : "Original document"}</span><small>Check names, values, units, and dates</small></div><div className="extracted-fields"><p className="eyebrow">EXTRACTED INFORMATION</p>{Object.entries(document.data).filter(([key]) => key !== "visible_text" && key !== "uncertain_text").slice(0, 5).map(([key, value]) => <label key={key}>{key.replaceAll("_", " ")}<input value={typeof value === "string" ? value : JSON.stringify(value)} readOnly /></label>)}<div className="review-key"><span>Clearly visible</span><span>Needs review</span><span>Could not read</span></div><label className="confirm"><input type="checkbox" /> I reviewed names, values, units, and dates.</label></div></div></div>}</div>; }

function Visit({ fields, setFields, onGenerate }: { fields: Record<string, string>; setFields: (value: Record<string, string>) => void; onGenerate: () => void }) { const names = ["Main concern", "Symptoms", "Symptom timeline", "Duration", "Severity", "Triggers", "Medications entered by user", "Questions for clinician", "Missing information"]; return <div className="workflow-view"><p className="eyebrow">VISIT PREPARATION</p><h2>Make the visit count.</h2><p className="workflow-lead">Organize patient-provided information and turn uncertainty into useful questions.</p><div className="visit-form">{names.map((name) => <label key={name}>{name}<textarea rows={name === "Symptoms" || name === "Questions for clinician" ? 3 : 2} value={fields[name] || ""} onChange={(event) => setFields({ ...fields, [name]: event.target.value })} placeholder={`Add ${name.toLowerCase()}...`} /></label>)}</div><p className="patient-note"><ShieldCheck size={16} /> Patient-provided information — not a diagnosis.</p><button className="forest-button" onClick={onGenerate}>Generate visit summary <ArrowUpRight size={16} /></button></div>; }

function Sources({ sources, onSelect }: { sources: Source[]; onSelect: (value: number) => void }) { return <div className="workflow-view"><p className="eyebrow">KNOWLEDGE BASE</p><h2>Approved sources.</h2><p className="workflow-lead">Trusted local retrieval keeps answers grounded and transparent.</p><div className="source-list">{sources.length ? sources.map((source) => <button key={source.number} onClick={() => onSelect(source.number)}><span>[{source.number}]</span><div><strong>{source.publisher}</strong><b>{source.title}</b><small>{source.reviewed || "Approved source"}</small></div><ChevronRight size={17} /></button>) : <div className="empty-panel"><BookOpen size={23} /><p>Sources will appear here after your first evidence-supported answer.</p></div>}</div></div>; }

function Privacy({ onClose, onClear }: { onClose: () => void; onClear: () => void }) { return <div className="drawer-backdrop" onClick={onClose}><aside className="drawer" onClick={(event) => event.stopPropagation()}><button className="drawer-close" onClick={onClose}><X size={18} /></button><p className="eyebrow">PRIVACY CENTER</p><h2>Private local processing.</h2><p>Your session is designed to stay close to your device.</p><ul><li><Check size={16} /> Local language model</li><li><Check size={16} /> Local speech transcription</li><li><Check size={16} /> Local document processing</li><li><Check size={16} /> Trusted local retrieval</li><li><Check size={16} /> Chat persistence disabled</li><li><Check size={16} /> Temporary audio cleanup</li></ul><div className="drawer-warning"><strong>Public demo mode</strong><span>Do not enter identifying health information.</span></div><button className="drawer-action" onClick={onClear}><Trash2 size={16} /> Clear session</button><button className="drawer-action secondary"><RefreshCw size={16} /> Clear temporary files</button></aside></div>; }

function Health({ health, onClose, onRetry }: { health: HealthResponse | null; onClose: () => void; onRetry: () => void }) { return <div className="drawer-backdrop" onClick={onClose}><aside className="drawer health-drawer" onClick={(event) => event.stopPropagation()}><button className="drawer-close" onClick={onClose}><X size={18} /></button><p className="eyebrow">SYSTEM STATUS</p><h2>{health?.status === "ok" ? "All systems ready." : "Some services need attention."}</h2><p>{health ? `${health.ready} of ${health.total} services ready.` : "Checking the local AI service..."}</p><div className="health-list">{Object.entries(health?.statuses || {}).map(([key, value]) => <div key={key}><span className={value.status === "ready" ? "status-dot" : "status-dot off"} /><strong>{healthLabels[key] || key}</strong><small>{value.detail}</small></div>)}</div><button className="drawer-action" onClick={onRetry}><RefreshCw size={16} /> Check again</button></aside></div>; }
