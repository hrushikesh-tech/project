import { expect, test } from "@playwright/test";

import { hasLiveCredentials, loginWithRetry } from "./helpers";

test.skip(!hasLiveCredentials(), "Live auth credentials are not configured for this run.");
test.describe.configure({ timeout: 120000 });

test("bi builder and gantt routes are reachable with interactive controls", async ({ page }) => {
  await loginWithRetry(page);

  await page.goto("/dashboard/bi");
  await expect(page.getByRole("heading", { name: /fixed-semantics dashboard builder/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /open builder/i })).toBeVisible();
  await expect(page.getByText(/Operations pulse/i)).toBeVisible();

  await page.goto("/dashboard/bi/dashboard-ops");
  await expect(page.getByText(/Approved widgets/i)).toBeVisible();
  await page.getByRole("button", { name: /po approval cycle time/i }).click();
  await expect(page.locator("article").filter({ hasText: /po approval cycle time/i }).first()).toBeVisible();

  await page.locator("a[href='/dashboard/projects']").click();
  await page.waitForURL(/\/dashboard\/projects$/);
  await expect(page.getByRole("heading", { name: /bounded scheduling with visible dependencies/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Northwind rollout/i })).toBeVisible();
});
