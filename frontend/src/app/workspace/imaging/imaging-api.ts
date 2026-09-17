import { fetchWithTimeout, parseApiError } from "../../../lib/api-error";
import type { CompareBucket, ImagingStudy, Modality, ModalitySummary, ReportSection } from "./imaging-types";

/** DICOM is intercepted client-side (see ImagingLanding/ImagingReportPanel
 * upload handlers) before any request is made, so this code path exists
 * only as a defensive fallback if that check is ever bypassed. */
export const DICOM_NOT_SUPPORTED_MESSAGE =
  "DICOM viewing isn't available yet. MediGuide currently supports imaging reports while DICOM study viewing is being prepared.";

async function asJson<T>(response: Response, fallbackMessage: string): Promise<T> {
  if (!response.ok) {
    const apiError = await parseApiError(response, fallbackMessage);
    if (apiError.code === "DICOM_NOT_YET_SUPPORTED") {
      throw new Error(DICOM_NOT_SUPPORTED_MESSAGE);
    }
    throw new Error(apiError.message);
  }
  return response.json() as Promise<T>;
}

export function fetchModalities(apiUrl: string): Promise<{ modalities: ModalitySummary[] }> {
  return fetchWithTimeout(`${apiUrl}/api/imaging/modalities`).then((r) =>
    asJson(r, "Could not load imaging categories."),
  );
}

export function fetchStudies(
  apiUrl: string,
  params: { modality?: string; body_region?: string; date_from?: string; date_to?: string } = {},
): Promise<{ studies: ImagingStudy[] }> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  const qs = query.toString();
  return fetchWithTimeout(`${apiUrl}/api/imaging/studies${qs ? `?${qs}` : ""}`).then((r) =>
    asJson(r, "Could not load studies."),
  );
}

export function fetchStudy(apiUrl: string, studyId: string): Promise<ImagingStudy> {
  return fetchWithTimeout(`${apiUrl}/api/imaging/studies/${studyId}`).then((r) =>
    asJson(r, "Could not load this study."),
  );
}

export function createStudy(
  apiUrl: string,
  input: { modality: Modality; body_region: string; study_date: string | null; institution: string },
): Promise<ImagingStudy> {
  return fetchWithTimeout(`${apiUrl}/api/imaging/studies`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }).then((r) => asJson(r, "Could not create this study."));
}

export function deleteStudy(apiUrl: string, studyId: string): Promise<void> {
  return fetchWithTimeout(`${apiUrl}/api/imaging/studies/${studyId}`, { method: "DELETE" }).then((r) =>
    asJson(r, "Could not delete this study."),
  );
}

export function uploadReport(
  apiUrl: string,
  studyId: string,
  file: File,
): Promise<{ document_id: string; sections: Record<string, string> }> {
  const form = new FormData();
  form.append("file", file);
  return fetchWithTimeout(
    `${apiUrl}/api/imaging/studies/${studyId}/report`,
    { method: "POST", body: form },
    90_000,
  ).then((r) => asJson(r, "MediGuide could not read this imaging report."));
}

export function fetchSections(apiUrl: string, studyId: string): Promise<{ sections: ReportSection[] }> {
  return fetchWithTimeout(`${apiUrl}/api/imaging/studies/${studyId}/report/sections`).then((r) =>
    asJson(r, "Could not load report sections."),
  );
}

export function confirmSections(
  apiUrl: string,
  studyId: string,
  edits: { section_type: string; text: string }[],
): Promise<{ sections: ReportSection[]; verification_status: string }> {
  return fetchWithTimeout(`${apiUrl}/api/imaging/studies/${studyId}/report/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reviewed: true, sections: edits }),
  }).then((r) => asJson(r, "Could not confirm this report."));
}

export function compareReports(
  apiUrl: string,
  documentIdA: string,
  documentIdB: string,
): Promise<{ comparisons: CompareBucket[] }> {
  return fetchWithTimeout(`${apiUrl}/api/imaging/compare`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ document_id_a: documentIdA, document_id_b: documentIdB }),
  }).then((r) => asJson(r, "Could not compare these reports."));
}

export function explainTerm(
  apiUrl: string,
  term: string,
  modality?: string,
): Promise<{ term: string; answer_markdown: string; sources: { title: string; publisher: string }[] }> {
  return fetchWithTimeout(`${apiUrl}/api/imaging/terminology/explain`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ term, modality }),
  }).then((r) => asJson(r, "Could not explain this term right now."));
}

export function reportPagePreviewUrl(apiUrl: string, studyId: string, page: number): string {
  return `${apiUrl}/api/imaging/studies/${studyId}/report/pages/${page}/preview`;
}
