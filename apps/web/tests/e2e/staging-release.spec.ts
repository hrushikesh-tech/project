import { expect, test } from "@playwright/test";

import { hasLiveCredentials, loginWithRetry } from "./helpers";

test.describe("staging release smoke", () => {
  test.skip(
    !hasLiveCredentials(),
    "Live release credentials are not configured for this run.",
  );
  test.setTimeout(60000);

  test("@staging-release reaches a protected finance route after login", async ({
    page,
  }) => {
    await loginWithRetry(page);
    await page.goto("/dashboard/finance/journal-entry", {
      waitUntil: "domcontentloaded",
    });
    await expect(
      page.getByRole("heading", { name: /journal entry builder/i }),
    ).toBeVisible();
    await expect(page.getByText(/balanced/i)).toBeVisible();
  });
});
