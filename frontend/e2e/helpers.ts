import { execFileSync } from "node:child_process";
import path from "node:path";
import type { Page } from "@playwright/test";

/** The sidebar's "Imaging" nav button — scoped to <aside> because several
 * in-view "back to Imaging" buttons also render the bare text "Imaging". */
export function sidebarImagingNav(page: Page) {
  return page.locator("aside").getByRole("button", { name: "Imaging", exact: true });
}

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const SCRATCH_DIR = path.join(__dirname, ".scratch");
const PYTHON = path.join(REPO_ROOT, ".venv", "Scripts", "python.exe");

function scratchEnv() {
  return {
    ...process.env,
    DATABASE_URL: `sqlite:///${path.join(SCRATCH_DIR, "e2e.db").replace(/\\/g, "/")}`,
    PYTHONPATH: REPO_ROOT,
  };
}

export function generateReportPdf(
  outputPath: string,
  opts: {
    exam?: string;
    clinicalHistory?: string;
    technique?: string;
    findings?: string;
    impression?: string;
    invalid?: boolean;
    noRecognizedHeaders?: boolean;
  } = {},
): void {
  const args = [
    path.join(REPO_ROOT, "scripts", "generate_synthetic_imaging_report.py"),
    "--output",
    outputPath,
  ];
  if (opts.exam) args.push("--exam", opts.exam);
  if (opts.clinicalHistory) args.push("--clinical-history", opts.clinicalHistory);
  if (opts.technique) args.push("--technique", opts.technique);
  if (opts.findings) args.push("--findings", opts.findings);
  if (opts.impression) args.push("--impression", opts.impression);
  if (opts.invalid) args.push("--invalid");
  if (opts.noRecognizedHeaders) args.push("--no-recognized-headers");

  execFileSync(PYTHON, args, { cwd: REPO_ROOT, env: scratchEnv() });
}

export function seedDemoImaging(): void {
  execFileSync(PYTHON, [path.join(REPO_ROOT, "scripts", "seed_demo_imaging.py")], {
    cwd: REPO_ROOT,
    env: scratchEnv(),
  });
}
