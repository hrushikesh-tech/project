import { expect, test } from "@playwright/test";

import { hasLiveCredentials, loginWithRetry } from "./helpers";

test.skip(!hasLiveCredentials(), "Live auth credentials are not configured for this run.");
test.describe.configure({ timeout: 120000 });

test("payroll, supply chain, and notifications center are reachable", async ({ page }) => {
  await loginWithRetry(page);

  await page.goto("/dashboard/payroll");
  await expect(page.getByRole("heading", { name: /run progress, payslips, and payroll artifacts/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /open payroll runs/i })).toBeVisible();
  await expect(page.getByText(/April India payroll generated payslips/i)).not.toBeVisible();
  await expect(page.getByText(/India payroll/i).first()).toBeVisible();

  await page.goto("/dashboard/supply-chain");
  await expect(page.getByRole("heading", { name: /warehouse pressure and inventory flow/i })).toBeVisible();
  await expect(page.getByLabel(/North Hub Servo Kit/i)).toBeVisible();

  await page.goto("/dashboard/notifications");
  await expect(page.getByRole("heading", { name: /in-shell inbox and delivery preferences/i })).toBeVisible();
  await expect(page.getByText(/Payroll run completed/i)).toBeVisible();
});
