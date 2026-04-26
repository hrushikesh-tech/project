import { expect, test } from "@playwright/test";
import { loginWithRetry } from "./helpers";

const username = process.env.PHASE12_AUTH_USERNAME;
const password = process.env.PHASE12_AUTH_PASSWORD;

test.skip(!username || !password, "Live auth credentials are not configured for this run.");
test.setTimeout(60000);

test("signs in with real Keycloak-backed credentials", async ({ page }) => {
  await loginWithRetry(page);
  await expect(page.getByText(username ?? "", { exact: false })).toBeVisible();
  await expect(page.getByText(/Protected Session/i)).toBeVisible();
});
