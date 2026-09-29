// @ts-nocheck — scaffold: @playwright/test intentionally not installed.
/**
 * SCAFFOLD — Playwright config (11.1). NOT wired into CI.
 * See e2e/smoke.spec.ts header for activation steps. Do not fake green runs.
 */
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // backend sessions are stateful; keep serial
  retries: 0, // smoke must pass first try or fail loudly
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-390", use: { ...devices["iPhone 13"] } }, // 10.1 mobile pass
  ],
});
