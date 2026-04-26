import { expect, test } from "@playwright/test";

import { hasLiveCredentials, loginWithRetry } from "./helpers";

test.skip(!hasLiveCredentials(), "Live auth credentials are not configured for this run.");
test.describe.configure({ timeout: 120000 });

test("finance, ap/ar, hr, and notification preferences are reachable in the protected shell", async ({ page }) => {
  await loginWithRetry(page);

  await page.goto("/dashboard/finance", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /close-week operations and journal readiness/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /open journal entry/i })).toBeVisible();

  await page.goto("/dashboard/finance/journal-entry", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /journal entry builder/i })).toBeVisible();
  await expect(page.getByText(/balanced/i)).toBeVisible();

  await page.goto("/dashboard/ap-ar", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /invoice review, due dates, and collections/i })).toBeVisible();
  await expect(page.getByText(/invoice queue/i)).toBeVisible();

  await page.goto("/dashboard/hr", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /people operations with the same dense erp rhythm/i })).toBeVisible();
  await expect(page.getByText(/employee roster/i)).toBeVisible();

  await page.goto("/dashboard/notifications/preferences", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /notification preferences/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /save preferences/i })).toBeVisible();
  await expect(page.getByText(/payroll.run.completed/i)).toBeVisible();
});
