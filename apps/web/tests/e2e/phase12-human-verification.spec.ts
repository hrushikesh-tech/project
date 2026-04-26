import { expect, test } from "@playwright/test";

import { hasLiveCredentials, loginWithRetry } from "./helpers";

test.skip(!hasLiveCredentials(), "Live auth credentials are not configured for this run.");
test.describe.configure({ timeout: 180000 });

const viewports = [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 1080 },
] as const;

test("assisted phase 12 ux verification across role home, BI, Gantt, offline queue, and breakpoints", async ({ page }) => {
  await loginWithRetry(page);

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", {
        name: /Platform command center|Tenant operations home|Finance command center|People operations home|Supply chain operations home|Project delivery home|Executive overview/i,
      }),
    ).toBeVisible();
    await expect(page.getByText("Role Home", { exact: true })).toBeVisible();
    await page.screenshot({
      path: `test-results/manual-phase12-${viewport.name}-dashboard.png`,
      fullPage: true,
    });

    await page.goto("/dashboard/bi/dashboard-ops", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/Approved widgets/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /po approval cycle time/i })).toBeVisible();
    await page.getByRole("button", { name: /po approval cycle time/i }).click();
    await page.screenshot({
      path: `test-results/manual-phase12-${viewport.name}-bi.png`,
      fullPage: true,
    });

    await page.goto("/dashboard/projects", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /bounded scheduling with visible dependencies/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Northwind rollout/i })).toBeVisible();
    await page.screenshot({
      path: `test-results/manual-phase12-${viewport.name}-projects.png`,
      fullPage: true,
    });
  }

  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.goto("/dashboard/notifications/preferences", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /notification preferences/i })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /invoice.match_failed IN_APP/i })).toBeVisible();
  await page.evaluate(() => {
    const browserWindow = window as Window & { __amdoxForceOffline?: boolean };
    browserWindow.__amdoxForceOffline = true;
    browserWindow.dispatchEvent(new Event("offline"));
  });
  await expect(page.getByText(/Offline mode enabled/i)).toBeVisible();
  await expect(page.getByText(/higher-risk module actions remain online-only/i)).toBeVisible();
  await page.getByRole("checkbox", { name: /invoice.match_failed IN_APP/i }).click();
  await page.getByRole("button", { name: /save preferences/i }).click();
  await expect(page.getByText(/queued action/i)).toBeVisible();
  await page.screenshot({
    path: "test-results/manual-phase12-desktop-offline.png",
    fullPage: true,
  });
});
