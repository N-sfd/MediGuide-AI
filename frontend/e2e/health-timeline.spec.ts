import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { generateReportPdf, sidebarImagingNav } from "./helpers";

const FIXTURES_DIR = path.join(__dirname, ".scratch", "fixtures");

test.beforeAll(() => {
  fs.mkdirSync(FIXTURES_DIR, { recursive: true });
});

test.describe("Health Timeline", () => {
  test("shows confirmed items and cross-links into their real detail views", async ({ page }) => {
    // Seed one confirmed, verified imaging study through the real Imaging flow.
    await page.goto("/workspace");
    await expect(sidebarImagingNav(page)).toBeEnabled();
    await sidebarImagingNav(page).click();
    await page.getByRole("button", { name: "Add imaging study" }).click();
    await page.locator(".imaging-add-form select").selectOption("ultrasound");
    await page.getByPlaceholder("e.g. Right knee").fill("Abdomen");
    await page.getByRole("button", { name: "Create study" }).click();

    const reportPath = path.join(FIXTURES_DIR, "timeline-imaging-report.pdf");
    generateReportPdf(reportPath, {
      exam: "Ultrasound Abdomen",
      findings: "No acute abnormality.",
      impression: "No acute abnormality.",
    });
    await page.locator(".imaging-upload-label input[type=file]").setInputFiles(reportPath);
    await expect(page.getByText(/sections reviewed/)).toBeVisible({ timeout: 20_000 });

    const textareas = page.locator(".imaging-section-block textarea");
    const count = await textareas.count();
    for (let i = 0; i < count; i += 1) await textareas.nth(i).click();
    await page.getByRole("button", { name: "Confirm reviewed sections" }).click();
    await expect(page.locator(".lab-verified")).toContainText("Verified");

    // Open the Health Timeline and confirm the study appears.
    await page.locator("aside").getByRole("button", { name: "Health Timeline", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Health Timeline" })).toBeVisible();
    const imagingRow = page.locator(".timeline-entry").filter({ hasText: "Ultrasound" });
    await expect(imagingRow).toBeVisible();
    await expect(imagingRow).toContainText("Verified report");

    // "View study" cross-links into the real Imaging Detail view.
    await imagingRow.getByRole("button", { name: "View study" }).click();
    await expect(page.locator(".imaging-study-meta")).toContainText("Ultrasound");

    // Back to the Timeline for the empty/no-entries copy check on a fresh
    // reload isn't meaningful here (data now exists), so instead verify the
    // dismissible error banner never appears when the API is healthy.
    await page.locator("aside").getByRole("button", { name: "Health Timeline", exact: true }).click();
    await expect(page.getByText("Something needs attention")).toHaveCount(0);
  });
});
