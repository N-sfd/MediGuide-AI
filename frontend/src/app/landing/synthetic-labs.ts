/** Synthetic portfolio demo data only — never real patient information. */

export type SyntheticLabPoint = {
  id: string;
  label: string;
  dateLabel: string;
  fullDate: string;
  value: number;
  unit: string;
  flagged: "high" | "low" | null;
  document: string;
  page: number;
};

export const SYNTHETIC_A1C_POINTS: SyntheticLabPoint[] = [
  {
    id: "a1c-jan",
    label: "Jan 2026",
    dateLabel: "Jan 2026",
    fullDate: "Jan 15, 2026",
    value: 6.2,
    unit: "%",
    flagged: "high",
    document: "Synthetic Lab Report — Jan 15, 2026",
    page: 1,
  },
  {
    id: "a1c-apr",
    label: "Apr 2026",
    dateLabel: "Apr 2026",
    fullDate: "Apr 10, 2026",
    value: 6.5,
    unit: "%",
    flagged: "high",
    document: "Synthetic Lab Report — Apr 10, 2026",
    page: 1,
  },
  {
    id: "a1c-aug",
    label: "Aug 2026",
    dateLabel: "Aug 2026",
    fullDate: "Aug 12, 2026",
    value: 6.7,
    unit: "%",
    flagged: "high",
    document: "Synthetic Lab Report — Aug 12, 2026",
    page: 2,
  },
];

export const APPROVED_SOURCE_EXAMPLES = [
  {
    n: 1,
    publisher: "MedlinePlus (NLM)",
    title: "Hemoglobin A1C",
    reviewed: "Approved educational source",
  },
  {
    n: 2,
    publisher: "Centers for Disease Control and Prevention (CDC)",
    title: "About A1C",
    reviewed: "Approved educational source",
  },
  {
    n: 3,
    publisher: "National Institutes of Health (NIH)",
    title: "Blood Tests for Diabetes",
    reviewed: "Approved educational source",
  },
] as const;
