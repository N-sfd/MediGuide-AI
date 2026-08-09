"use client";

import { ChangeEvent, FormEvent, useRef, useState } from "react";
import { ArrowUpRight, BookOpen, ChevronRight, FileText, Globe2, Menu, Mic, Paperclip, ShieldCheck, Sparkles, Stethoscope, Volume2 } from "lucide-react";

type Source = { number: number; title: string; publisher: string; url?: string };
type Message = { role: "user" | "assistant"; content: string };
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const starters = [
  ["Ask about a health topic", "What are common signs of seasonal allergies?", BookOpen],
  ["Prepare for a visit", "Help me prepare questions for my appointment.", Stethoscope],
  ["Understand a document", "What should I look for in this lab report?", FileText],
] as const;

export default function Home() {
  const [workspace, setWorkspace] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState("English");
  const [notice, setNotice] = useState("");
  const [recording, setRecording] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  async function submit(event?: FormEvent, preset?: string) {
    event?.preventDefault();
    const message = (preset ?? question).trim();
    if (!message || loading) return;
    setWorkspace(true); setQuestion(""); setLoading(true); setNotice("");
    setMessages((current) => [...current, { role: "user", content: message }]);
    try {
      const response = await fetch(`${API_URL}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message, history: messages }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "The assistant could not respond.");
      setAnswer(data.answer || "No answer returned."); setSources(data.sources || []);
      setMessages((current) => [...current, { role: "assistant", content: data.answer }]);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not connect to MediGuide."); }
    finally { setLoading(false); }
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    const form = new FormData(); form.append("file", file); setNotice("Reading the document securely...");
    try {
      const response = await fetch(`${API_URL}/api/documents/analyze`, { method: "POST", body: form }); const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Document analysis failed.");
      setQuestion(`Help me understand this ${data.data?.document_type || "health document"}.`); setNotice("Document reviewed. Add a question, then send it to the assistant."); setWorkspace(true);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Document analysis failed."); }
  }

  async function translate() {
    if (!answer) return; const target = language === "English" ? "Spanish" : "English"; setNotice(`Translating to ${target}...`);
    try {
      const response = await fetch(`${API_URL}/api/translate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: answer, language: target }) }); const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Translation failed."); setAnswer(data.text); setLanguage(target); setNotice(`Translated to ${target}.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Translation failed."); }
  }

  function speak() {
    if (!answer) return;
    fetch(`${API_URL}/api/speak`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: answer.replace(/[#*_\[\]]/g, "") }) }).then(async (response) => { if (!response.ok) throw new Error("Voice output is unavailable."); const audio = new Audio(URL.createObjectURL(await response.blob())); await audio.play(); }).catch((error) => setNotice(error instanceof Error ? error.message : "Voice output failed."));
  }

  async function toggleVoice() {
    if (recording) {
      recorder.current?.stop();
      setRecording(false);
      setNotice("Preparing your transcript...");
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const nextRecorder = new MediaRecorder(stream);
    audioChunks.current = [];
    nextRecorder.ondataavailable = (event) => audioChunks.current.push(event.data);
    nextRecorder.onstop = async () => {
      stream.getTracks().forEach((track) => track.stop());
      const form = new FormData();
      form.append("file", new Blob(audioChunks.current, { type: "audio/webm" }), "question.webm");
      try {
        const response = await fetch(`${API_URL}/api/transcribe`, { method: "POST", body: form });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || "Transcription failed.");
        setQuestion(data.text || ""); setNotice("Transcript ready. Review it before sending.");
      } catch (error) { setNotice(error instanceof Error ? error.message : "Transcription failed."); }
    };
    recorder.current = nextRecorder;
    nextRecorder.start(); setRecording(true); setNotice("Listening. Select the microphone again when you are finished.");
  }

  return <main className={workspace ? "app-shell workspace-mode" : "app-shell"}>
    <header className="topbar"><button className="brand" onClick={() => setWorkspace(false)} aria-label="MediGuide home"><span className="brand-mark"><Sparkles size={15} /></span><span>MediGuide <em>AI</em></span></button><nav className="nav-links"><a href="#how">How it works</a><a href="#privacy">Privacy first</a><button onClick={() => setWorkspace(true)}>Open workspace <ArrowUpRight size={15} /></button></nav><button className="menu-button" aria-label="Open menu"><Menu size={20} /></button></header>
    {!workspace ? <><section className="hero" id="how"><div className="hero-copy"><p className="eyebrow"><span /> EDUCATIONAL HEALTH, MADE CLEAR</p><h1>Feel more informed.<br /><i>Ask better questions.</i></h1><p className="hero-lede">MediGuide helps you understand health information, prepare for appointments, and find the signal in the details. Grounded in trusted sources. Designed for the moments between visits.</p><div className="hero-actions"><button className="primary-button" onClick={() => setWorkspace(true)}>Start a private session <ArrowUpRight size={17} /></button><button className="text-button" onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}>See how it works <ChevronRight size={16} /></button></div><div className="hero-proof"><div className="proof-avatars"><span>J</span><span>M</span><span>A</span></div><span>Built for thoughtful health conversations</span></div></div><div className="hero-art"><div className="sun-disc" /><div className="art-line line-one" /><div className="art-line line-two" /><div className="art-note"><ShieldCheck size={18} /><span><strong>Evidence-led</strong><br />Answers cite their sources.</span></div><div className="art-card"><div className="mini-icon"><Stethoscope size={18} /></div><p>What would you like<br />to understand today?</p><span className="mini-cursor">⌁</span></div><div className="art-caption">A calmer place to begin</div></div></section><section className="trust-strip"><span>YOUR HEALTH, YOUR PACE</span><span><ShieldCheck size={16} /> Private by design</span><span><BookOpen size={16} /> Trusted sources</span><span><Sparkles size={16} /> No diagnosis. Just clarity.</span></section><section className="how-section" id="how-it-works"><div className="section-intro"><p className="eyebrow">A LITTLE MORE CLARITY</p><h2>Start wherever<br /><i>you are.</i></h2></div><div className="feature-list"><article><b>01</b><div><BookOpen size={22} /><h3>Ask without overthinking</h3><p>Get a plain-language explanation, with the boundaries and context that matter.</p></div></article><article><b>02</b><div><FileText size={22} /><h3>Bring the details</h3><p>Upload a health document or speak your question. Review everything before it goes anywhere.</p></div></article><article><b>03</b><div><ShieldCheck size={22} /><h3>Leave with better questions</h3><p>See the evidence, notice what is still unknown, and prepare for a conversation with your clinician.</p></div></article></div></section><section className="privacy-band" id="privacy"><div><p className="eyebrow">A QUIET PROMISE</p><h2>Your health information<br /><i>stays yours.</i></h2></div><p>MediGuide is designed to run locally, with privacy as a product feature rather than a footnote. You decide what to share, and you can clear your session when you are done.</p></section></> : <Workspace answer={answer} sources={sources} question={question} setQuestion={setQuestion} submit={submit} loading={loading} notice={notice} upload={upload} fileInput={fileInput} translate={translate} speak={speak} language={language} toggleVoice={toggleVoice} />}
    <footer><span>© 2026 MediGuide AI</span><span>Educational support, never a diagnosis.</span><span>Built with care <span className="footer-dot">●</span></span></footer>
  </main>;
}

function Workspace(props: { answer: string; sources: Source[]; question: string; setQuestion: (value: string) => void; submit: (event?: FormEvent, preset?: string) => void; loading: boolean; notice: string; upload: (event: ChangeEvent<HTMLInputElement>) => void; fileInput: React.RefObject<HTMLInputElement | null>; translate: () => void; speak: () => void; language: string; toggleVoice: () => void }) {
  const { answer, sources, question, setQuestion, submit, loading, notice, upload, fileInput, translate, speak, language, toggleVoice } = props;
  return <section className="workspace"><aside className="workspace-sidebar"><div className="workspace-label">YOUR SPACE</div><button className="side-active"><Sparkles size={16} /> New conversation</button><button><BookOpen size={16} /> Conversations <span>0</span></button><button><FileText size={16} /> Documents</button><div className="side-bottom"><button><ShieldCheck size={16} /> Privacy</button><button><Globe2 size={16} /> Settings</button></div></aside><div className="chat-column"><div className="workspace-heading"><div><p className="eyebrow">PRIVATE SESSION</p><h2>What would you like to understand?</h2></div><span className="status-chip"><span /> Local mode</span></div>{!answer && !loading ? <div className="starter-grid">{starters.map(([title, text, Icon]) => <button key={title} onClick={() => submit(undefined, text)}><span className="starter-icon"><Icon size={18} /></span><span><strong>{title}</strong><small>{text}</small></span><ChevronRight size={16} /></button>)}</div> : <div className="answer-area">{answer && <div className="answer-card"><div className="answer-top"><span className="assistant-tag"><Sparkles size={14} /> MEDIGUIDE</span><div className="answer-tools"><button onClick={speak} title="Read answer aloud"><Volume2 size={16} /></button><button onClick={translate} title={`Translate from ${language}`}><Globe2 size={16} /></button></div></div><div className="answer-body">{answer.split("\n").map((line, index) => <p key={index} className={line.startsWith("#") ? "answer-heading" : ""}>{line.replace(/^#+\s*/, "")}</p>)}</div></div>}{loading && <div className="loading-card"><Sparkles size={17} /> Searching approved sources and shaping your answer...</div>}</div>}<form className="composer" onSubmit={submit}><textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask a health-education question..." rows={3} /><div className="composer-bottom"><div><button type="button" onClick={() => fileInput.current?.click()} title="Upload a document"><Paperclip size={18} /></button><input ref={fileInput} type="file" accept="image/*,.pdf" hidden onChange={upload} /><button type="button" onClick={toggleVoice} title="Voice input"><Mic size={18} /></button><span>Review before sending</span></div><button className="send-button" disabled={loading || !question.trim()} aria-label="Send question"><ArrowUpRight size={19} /></button></div></form>{notice && <p className="notice"><ShieldCheck size={14} /> {notice}</p>}<p className="disclaimer">MediGuide provides general educational information, not diagnosis or treatment. In an emergency, contact local emergency services.</p></div><aside className="evidence-column"><div className="evidence-heading"><div><p className="eyebrow">EVIDENCE</p><h3>Sources &amp; context</h3></div></div>{sources.length ? sources.map((source) => <article className="source-item" key={source.number}><span className="source-number">[{source.number}]</span><div><strong>{source.title}</strong><p>{source.publisher}</p><a href={source.url || "#"}>View source <ArrowUpRight size={12} /></a></div></article>) : <div className="empty-evidence"><BookOpen size={22} /><p>Your sources will appear here alongside each answer.</p><small>Evidence helps you see what is known, what is uncertain, and where to ask next.</small></div>}<div className="safety-note"><ShieldCheck size={17} /><div><strong>A note on safety</strong><p>Answers are reviewed for citation and medical-safety boundaries before they reach you.</p></div></div></aside></section>;
}
