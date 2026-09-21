import crypto from "node:crypto";
import { test, expect } from "@playwright/test";
import { seedPaginationImaging } from "./helpers";

// The Timeline page's real page size is 25 (frontend/src/app/workspace/HealthTimeline.tsx),
// which playwright.config.ts overrides to 3 via NEXT_PUBLIC_TIMELINE_PAGE_SIZE
// specifically so this spec can exercise "Load more" without seeding 25+
// records through real UI flows.
//
// All other e2e specs share this same backend DB for the whole `test:e2e`
// run (the scratch DB is wiped once up front, not per spec file), so this
// test seeds 4 imaging studies whose body_region carries a random token and
// scopes the Timeline's own search filter to that token — the assertions
// below hold regardless of how much other data other specs have created.
test.describe("Health Timeline — pagination", () => {
  test("Load more accumulates entries with no duplicate rows", async ({ page }) => {
    const token = `Pagination${crypto.randomBytes(4).toString("hex")}`;
    seedPaginationImaging(token, 4);

    await page.goto("/workspace/timeline");
    await expect(page.getByRole("heading", { name: "Health Timeline" })).toBeVisible();
    await page.getByLabel("Search timeline").fill(token);

    await expect(page.locator(".timeline-entry")).toHaveCount(3, { timeout: 10_000 });

    const loadMoreButton = page.getByRole("button", { name: /Load more/ });
    await expect(loadMoreButton).toBeVisible();
    await expect(loadMoreButton).toContainText("3 of 4");

    const firstPageTitles = await page.locator(".timeline-entry-body strong").allTextContents();
    expect(new Set(firstPageTitles).size).toBe(3); // no duplicate rows on page 1 itself

    await loadMoreButton.click();

    // All 4 present, the first page's rows still there (real accumulation,
    // not a reset), no duplicates, and the button is gone once hasMore is false.
    await expect(page.locator(".timeline-entry")).toHaveCount(4);
    const allTitles = await page.locator(".timeline-entry-body strong").allTextContents();
    expect(new Set(allTitles).size).toBe(4);
    for (const title of firstPageTitles) {
      expect(allTitles).toContain(title);
    }
    await expect(page.getByRole("button", { name: /Load more/ })).toHaveCount(0);
  });
});
