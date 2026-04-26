import { expect, test } from "@playwright/test";

test("redirects unauthenticated dashboard visits to login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: /Amdox sign-in flow/i })).toBeVisible();
});

test("renders the login form shell", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByLabel("Username")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
});
