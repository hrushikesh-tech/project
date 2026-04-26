import { expect, test } from "@playwright/test";

import { hasLiveCredentials, loginWithRetry } from "./helpers";

test.skip(!hasLiveCredentials(), "Live auth credentials are not configured for this run.");
test.describe.configure({ timeout: 120000 });

test("offline queue and accessibility-critical shell hooks are present", async ({ page }) => {
  await loginWithRetry(page);

  await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);

  await page.goto("/dashboard/notifications/preferences");
  await expect(page.getByRole("heading", { name: /notification preferences/i })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /invoice.match_failed IN_APP/i })).toBeVisible();
  await page.evaluate(() => {
    const browserWindow = window as Window & { __amdoxForceOffline?: boolean };
    browserWindow.__amdoxForceOffline = true;
    browserWindow.dispatchEvent(new Event("offline"));
  });

  await expect(page.getByText(/Offline mode enabled/i)).toBeVisible();
  await page.getByRole("checkbox", { name: /invoice.match_failed IN_APP/i }).click();
  await page.getByRole("button", { name: /save preferences/i }).click();
  await expect(page.getByText(/queued action/i)).toBeVisible();

  await page.goto("/dashboard/finance/journal-entry");
  await expect(page.getByRole("heading", { name: /journal entry builder/i })).toBeVisible();
});
