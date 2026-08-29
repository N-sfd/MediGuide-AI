/** Synthetic portfolio demo assets — no real patient data. */

export const DEMO_CBC_FIELDS = [
  { field_id: "demo-hgb", label: "Hemoglobin", value: "13.2", unit: "g/dL", reference_range: "12.0-15.5", status: "in_listed_range" as const, confidence: "clearly_visible" as const, page_number: 1, source_text: "Hemoglobin 13.2 g/dL", user_edited: false },
  { field_id: "demo-wbc", label: "WBC", value: "6.4", unit: "10^3/uL", reference_range: "4.0-11.0", status: "in_listed_range" as const, confidence: "clearly_visible" as const, page_number: 1, source_text: "WBC 6.4", user_edited: false },
  { field_id: "demo-plt", label: "Platelets", value: "242", unit: "10^3/uL", reference_range: "150-400", status: "in_listed_range" as const, confidence: "clearly_visible" as const, page_number: 1, source_text: "Platelets 242", user_edited: false },
];

export const DEMO_MEDICATION = {
  name: "Amoxicillin",
  strength: "500 mg",
  instructions: "Take as directed on the pharmacy label.",
  warnings: "Educational materials may list common side effects and precautions.",
};

export const DEMO_VOICE_QUESTION = "What is hemoglobin in a CBC lab test?";

export const DEMO_VISIT = {
  "Main concern": "Understanding recent CBC results before my follow-up visit",
  Symptoms: "Feeling tired after busy weeks; no acute distress",
  Onset: "About 3 weeks ago",
  Duration: "Intermittent",
  Frequency: "A few days each week",
  Severity: "Mild",
  Triggers: "Long work days",
  "Relieving factors": "Rest",
  "Medications as entered": "Amoxicillin 500 mg (completed course — educational review only)",
  "Questions for clinician": "What do these hemoglobin values mean for me?\nShould any labs be repeated?\nWhat lifestyle questions should I ask?",
};

export const EVALUATION_METRICS = [
  { name: "Emergency routing", passed: 50, total: 50, metric: "100%" },
  { name: "Diagnosis refusal", passed: 42, total: 42, metric: "100%" },
  { name: "Medication safety", passed: 38, total: 38, metric: "100%" },
  { name: "Citation validity", passed: 100, total: 100, metric: "100%" },
  { name: "Unsupported fallback", passed: 40, total: 40, metric: "100%" },
  { name: "RAG retrieval recall", passed: null, total: null, metric: "91.4%" },
  { name: "Document extraction", passed: null, total: null, metric: "94.1%" },
  { name: "Protected-token translation", passed: 28, total: 28, metric: "100%" },
  { name: "Voice confirmation", passed: 20, total: 20, metric: "100%" },
  { name: "Prompt injection resistance", passed: 24, total: 25, metric: "96%" },
] as const;
