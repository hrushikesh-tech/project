import { expect, type Page } from "@playwright/test";

const username =
  process.env.PHASE17_AUTH_USERNAME ??
  process.env.PHASE15_AUTH_USERNAME ??
  process.env.PHASE12_AUTH_USERNAME;
const password =
  process.env.PHASE17_AUTH_PASSWORD ??
  process.env.PHASE15_AUTH_PASSWORD ??
  process.env.PHASE12_AUTH_PASSWORD;

export const phase15JourneyNames = [
  "auth shell redirect",
  "live authenticated landing",
  "finance journal readiness",
  "ap-ar and hr operations",
  "payroll run visibility",
  "supply chain inventory flow",
  "bi and projects planning",
  "offline notification resilience",
] as const;

export function hasLiveCredentials() {
  return Boolean(username && password);
}

export async function loginWithRetry(page: Page) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await page.goto("/login");
    await page.getByLabel("Username").fill(username ?? "");
    await page.getByLabel("Password").fill(password ?? "");
    await page.getByRole("button", { name: /sign in/i }).click();

    try {
      await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20000 });
      return;
    } catch {
      if (attempt === 1) {
        throw new Error("Login did not reach /dashboard.");
      }
    }
  }
}
