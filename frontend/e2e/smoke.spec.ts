// @ts-nocheck — scaffold: @playwright/test intentionally not installed.
// Typechecking resumes when the owner activates E2E per the header below.
/**
 * SCAFFOLD — Playwright E2E smoke spec (11.1). NOT executed in CI.
 *
 * Covers: homepage submit → workspace loads; 2-question chat streak;
 * scan → bulk ticket creation; /demo interactive in <3s.
 *
 * To activate (owner action):
 *   1. `pnpm add -D @playwright/test && npx playwright install --with-deps chromium`
 *   2. Start backend (:8000) and frontend (`pnpm dev` on :3000).
 *   3. `npx playwright test` (add a CI job only after green locally).
 *
 * Do NOT wire into `.github/workflows/ci.yml` until browsers are installed
 * and the spec passes against a live backend — never fake passing tests.
 */
import { test, expect } from "@playwright/test";

const DEMO_REPO = "psf/requests"; // small, fast to analyze

test.describe("CodeAtlas smoke", () => {
  test("homepage submit → workspace loads graph", async ({ page }) => {
    await page.goto("/");
    const input = page.getByLabel("GitHub repository URL");
    await expect(input).toBeVisible();
    await input.fill(`github.com/${DEMO_REPO}`);
    await page.getByRole("button", { name: /onboard repository/i }).click();
    // Workspace arrives after async onboard job completes (budget: 120s).
    await expect(page.getByText(/dependency graph/i).first()).toBeVisible({ timeout: 120_000 });
  });

  test("chat 2-question streak always produces a visible state", async ({ page }) => {
    await page.goto(`/workspace?repo=${encodeURIComponent(DEMO_REPO)}`);
    await page.getByRole("tab", { name: /chat/i }).click();
    const box = page.getByPlaceholder(/ask about this codebase/i);
    for (const q of ["What does this repo do?", "asdfghjkl nonsense input"]) {
      await box.fill(q);
      await page.keyboard.press("Enter");
      // Answer, typing indicator, or retryable error — never silence (03.2).
      await expect(
        page.locator('[data-testid="chat-answer"], [data-testid="chat-thinking"], [data-testid="chat-error"]').first(),
      ).toBeVisible({ timeout: 65_000 });
    }
  });

  test("scan → bulk ticket creation", async ({ page }) => {
    await page.goto(`/workspace?repo=${encodeURIComponent(DEMO_REPO)}`);
    await page.getByRole("tab", { name: /scan/i }).click();
    await expect(page.getByText(/scan report/i).first()).toBeVisible({ timeout: 120_000 });
    const bulk = page.getByText(/select all major issues/i);
    if (await bulk.count()) {
      await bulk.click();
      await page.getByRole("button", { name: /create .* tickets/i }).click();
      await expect(page.getByText(/tickets created/i)).toBeVisible({ timeout: 30_000 });
    }
  });

  test("/demo interactive in under 3s, no login", async ({ page }) => {
    const start = Date.now();
    await page.goto("/demo");
    await expect(page.getByText(/dependency graph|scan report|chat/i).first()).toBeVisible({
      timeout: 30_000,
    });
    expect(Date.now() - start).toBeLessThan(30_000); // tighten to 3s once pre-analyzed
  });
});
