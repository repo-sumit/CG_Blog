// Playwright E2E — login + access gating.
// Run against a deployed/staging instance: `npx playwright test`.
// Requires AUTH_TEST_BASE_URL to point at a running app (Supabase configured).
import { test, expect } from "@playwright/test";

const BASE = process.env.AUTH_TEST_BASE_URL ?? "http://localhost:3000";

test.describe("auth gating", () => {
  test("unauthenticated visit redirects to /login", async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    await expect(page).toHaveURL(/\/login/);
  });

  test("login page renders the Google + magic-link controls", async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await expect(page.getByRole("button", { name: /Continue with Google/ })).toBeVisible();
    await expect(page.getByPlaceholder(/you@convegenius.ai/)).toBeVisible();
  });

  test("unauthorized page is reachable directly", async ({ page }) => {
    await page.goto(`${BASE}/unauthorized?reason=domain`);
    await expect(page.getByText(/Access restricted/)).toBeVisible();
  });
});
