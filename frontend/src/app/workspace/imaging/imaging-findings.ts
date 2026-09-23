import type { ImagingFinding, ReportSection } from "./imaging-types";

export interface AppointmentQuestion {
  id: string;
  text: string;
}

const DEFAULT_QUESTIONS: AppointmentQuestion[] = [
  { id: "q-extent", text: "How extensive is this finding on the actual images?" },
  { id: "q-symptoms", text: "How does this finding relate to my symptoms?" },
  { id: "q-options", text: "What treatment approaches are usually considered?" },
  { id: "q-rehab", text: "Would rehabilitation be appropriate?" },
  { id: "q-followup", text: "When should I follow up, and with which specialist?" },
];

const TEAR_QUESTIONS: AppointmentQuestion[] = [
  { id: "q-tear-extent", text: "How extensive is the supraspinatus tear?" },
  { id: "q-retraction", text: "Is there tendon retraction?" },
  { id: "q-atrophy", text: "Is there muscle atrophy or fatty change?" },
  { id: "q-symptoms", text: "How does this finding relate to my symptoms?" },
  { id: "q-options", text: "What treatment approaches are usually considered?" },
  { id: "q-rehab", text: "Would rehabilitation be appropriate?" },
  { id: "q-surgery-when", text: "Under what circumstances would surgery be considered?" },
];

export function buildAppointmentQuestions(findings: ImagingFinding[]): AppointmentQuestion[] {
  const blob = findings.map((f) => `${f.finding_text} ${f.normalized_concept}`).join(" ").toLowerCase();
  if (blob.includes("tear") || blob.includes("supraspinatus")) return TEAR_QUESTIONS;
  return DEFAULT_QUESTIONS;
}

/** Report-documented context vs general associations — never causation. */
export function buildPossibleContext(
  sections: ReportSection[],
  findings: ImagingFinding[],
): { fromReport: string | null; general: string | null } {
  const history = sections.find((s) => s.section_type === "clinical_history")?.section_text?.trim() || "";
  const blob = findings.map((f) => f.finding_text).join(" ").toLowerCase();
  const mentionsFall = /\bfall\b|\btrauma\b|\binjur/.test(history.toLowerCase());
  const hasTear = blob.includes("tear");

  const fromReport = history
    ? history.length > 240
      ? `${history.slice(0, 237)}…`
      : history
    : null;

  let general: string | null = null;
  if (hasTear) {
    general =
      "Rotator-cuff tendon tears may occur after trauma and can also occur in association with degenerative tendon changes. An MRI report alone generally cannot establish how much of a finding was acute versus pre-existing.";
  } else if (mentionsFall) {
    general =
      "Shoulder soft-tissue findings described on MRI can be associated with recent trauma; correlation with clinical examination is required.";
  }

  return { fromReport, general };
}

export function appendQuestionsToVisitPrep(
  questions: AppointmentQuestion[],
  studyLabel: string,
  findingLabels: string[] = [],
): void {
  try {
    const raw = window.sessionStorage.getItem("mediguide.visit-draft");
    const current = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    const existing = current["Questions for clinician"] || "";
    const block = [
      `From imaging: ${studyLabel}`,
      ...(findingLabels.length ? [`Verified findings: ${findingLabels.join("; ")}`] : []),
      ...questions.map((q) => `• ${q.text}`),
    ].join("\n");
    const merged = existing.trim() ? `${existing.trim()}\n\n${block}` : block;
    window.sessionStorage.setItem(
      "mediguide.visit-draft",
      JSON.stringify({
        ...current,
        "Questions for clinician": merged,
        "Main concern": current["Main concern"] || `Understanding ${studyLabel} before my appointment`,
      }),
    );
  } catch {
    /* ignore */
  }
}

export function appendFindingToVisitPrep(studyLabel: string, finding: ImagingFinding): void {
  try {
    const raw = window.sessionStorage.getItem("mediguide.visit-draft");
    const current = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    const key = "Imaging findings to discuss";
    const line = `• ${finding.summary_label || finding.finding_text} (source: ${studyLabel}, page ${finding.source_page})`;
    const existing = current[key] || "";
    window.sessionStorage.setItem(
      "mediguide.visit-draft",
      JSON.stringify({
        ...current,
        [key]: existing.trim() ? `${existing.trim()}\n${line}` : line,
        "Main concern": current["Main concern"] || `Understanding ${studyLabel} before my appointment`,
      }),
    );
  } catch {
    /* ignore */
  }
}
