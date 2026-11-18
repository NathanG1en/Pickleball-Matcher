import { test, expect } from "@playwright/test";

// The Google leg itself needs a real Google account, so it is checked by hand. This covers the
// app's side: the button is there, and a return without a finished Neon sign-in is handled.
test.describe("Google sign-in", () => {
  test("returns to sign in with an error when Google sign-in didn't finish", async ({ page }) => {
    await page.goto("/auth/google/complete?next=%2Fplayers");

    await expect(page).toHaveURL(/\/player-login\?/);
    const url = new URL(page.url());
    expect(url.searchParams.get("next")).toBe("/players");
    await expect(page.getByText("Google sign-in didn't finish. Please try again.")).toBeVisible();
    await expect(page.getByTestId("google-sign-in-button")).toBeVisible();
  });

  test("ignores an off-site return path", async ({ page }) => {
    await page.goto("/auth/google/complete?next=%2F%2Fevil.example");
    const url = new URL(page.url());
    expect(url.pathname).toBe("/player-login");
    expect(url.searchParams.get("next")).toBeNull();
  });
});
