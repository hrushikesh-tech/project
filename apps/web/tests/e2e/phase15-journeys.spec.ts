import { expect, test } from "@playwright/test";

import { hasLiveCredentials, loginWithRetry, phase15JourneyNames } from "./helpers";

test.describe("phase 15 journey catalog", () => {
  test("declares the eight business-critical journeys", () => {
    expect(phase15JourneyNames).toHaveLength(8);
  });
});

test.describe.configure({ mode: "serial", timeout: 120000 });
test.skip(!hasLiveCredentials(), "Live auth credentials are not configured for this run.");

test("journey 1: auth shell redirect", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: /Amdox sign-in flow/i })).toBeVisible();
});

test("journey 2: live authenticated landing", async ({ page }) => {
  await loginWithRetry(page);
  await expect(page.getByText(/Protected Session/i)).toBeVisible();
});

test("journey 3: finance journal readiness", async ({ page }) => {
  await loginWithRetry(page);
  await page.goto("/dashboard/finance/journal-entry", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /journal entry builder/i })).toBeVisible();
  await expect(page.getByText(/balanced/i)).toBeVisible();
});

test("journey 4: ap-ar and hr operations", async ({ page }) => {
  await loginWithRetry(page);
  await page.goto("/dashboard/ap-ar", { waitUntil: "domcontentloaded" });
  await expect(page.getByText(/invoice queue/i)).toBeVisible();
  await page.goto("/dashboard/hr", { waitUntil: "domcontentloaded" });
  await expect(page.getByText(/employee roster/i)).toBeVisible();
});

test("journey 5: payroll run visibility", async ({ page }) => {
  await loginWithRetry(page);
  await page.goto("/dashboard/payroll", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: /open payroll runs/i })).toBeVisible();
  await expect(page.getByText(/India payroll/i).first()).toBeVisible();
});

test("journey 6: supply chain inventory flow", async ({ page }) => {
  await loginWithRetry(page);
  await page.goto("/dashboard/supply-chain", { waitUntil: "domcontentloaded" });
  await expect(page.getByLabel(/North Hub Servo Kit/i)).toBeVisible();
});

test("journey 7: bi and projects planning", async ({ page }) => {
  await loginWithRetry(page);
  await page.goto("/dashboard/bi", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /fixed-semantics dashboard builder/i })).toBeVisible();
  await page.goto("/dashboard/projects", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /Northwind rollout/i })).toBeVisible();
});

test("journey 8: offline notification resilience", async ({ page }) => {
  await loginWithRetry(page);
  await page.goto("/dashboard/notifications/preferences", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    const browserWindow = window as Window & { __amdoxForceOffline?: boolean };
    browserWindow.__amdoxForceOffline = true;
    browserWindow.dispatchEvent(new Event("offline"));
  });
  await expect(page.getByText(/Offline mode enabled/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /save preferences/i })).toBeVisible();
});
