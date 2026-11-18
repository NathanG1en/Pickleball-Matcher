import { test, expect, type BrowserContext } from "@playwright/test";
import { SignJWT } from "jose";

// Signs a pending Google sign-up the way /auth/google/complete does, with the test server's key.
async function addPendingGoogleSignup(context: BrowserContext, email: string, name: string) {
  const secret =
    process.env.PLAYER_SESSION_SECRET ?? process.env.ORGANIZER_SESSION_SECRET ?? "test-organizer-session-secret-at-least-32-chars";
  const now = Math.floor(Date.now() / 1_000);
  const token = await new SignJWT({ email, name })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer("pickleball-matchmaker")
    .setAudience("pickleball-google-signup")
    .setIssuedAt(now)
    .setExpirationTime(now + 600)
    .sign(new TextEncoder().encode(secret));
  await context.addCookies([{ name: "pending_google_signup", value: token, url: test.info().project.use.baseURL ?? "http://localhost:3100" }]);
}

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

  test("sends Finish your profile back to sign in when there is no pending Google sign-up", async ({ page }) => {
    await page.goto("/player-signup/finish?next=%2Fplayers");
    const url = new URL(page.url());
    expect(url.pathname).toBe("/player-login");
    expect(url.searchParams.get("next")).toBe("/players");
    await expect(page.getByText("Your Google sign-in timed out. Please try again.")).toBeVisible();
  });

  // Creating the account itself is covered by tests/actions/complete-google-signup.test.ts, which
  // doesn't depend on the test database having the newest email columns.
  test("Finish your profile pre-fills from Google and makes the player choose a gender", async ({ page, context }) => {
    const stamp = Date.now().toString().slice(-8);
    const email = `g.player.${stamp}@example.com`;
    await addPendingGoogleSignup(context, email, "Gina Player");

    await page.goto("/player-signup/finish?next=%2Fplayers");
    await expect(page.getByRole("heading", { name: "Finish your profile" })).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();
    await expect(page.locator("#finish-username")).toHaveValue(`g_player_${stamp}`);
    await expect(page.locator("#finish-name")).toHaveValue("Gina Player");
    await page.waitForSelector("form[data-hydrated='true']");

    // Gender has no default, so it has to be chosen.
    await page.getByRole("button", { name: "Let's play →" }).click();
    await expect(page.getByText("Choose male or female.")).toBeVisible();

    await page.getByTestId("finish-gender-female").click();
    await expect(page.getByTestId("finish-gender-female")).toHaveAttribute("aria-checked", "true");
    await expect(page.getByTestId("finish-gender-male")).toHaveAttribute("aria-checked", "false");
  });
});
