import { expect, test } from "@playwright/test";
import { createTestGroup } from "./test-helpers";

test("session mutations render fresh state in the action response without an extra session GET", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await createTestGroup(page, `Action refresh ${Date.now()}`);
  await page.getByRole("button", { name: "Add Guest", exact: true }).click();
  for (let i = 1; i <= 7; i++) {
    await page.locator("#guest-player-name").fill(`Refresh Guest ${i}`);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.locator("#guest-player-name")).toHaveValue("");
  }
  await page.getByTestId("start-new-session-button").click();
  await page.getByTestId("select-normal-session-button").click();
  await page.getByTestId("continue-to-pairings-button").click();
  await page.getByTestId("start-session-button").click();
  await expect(page.getByRole("heading", { name: "Round 1", exact: true })).toBeVisible();
  await page.waitForLoadState("networkidle");
  const sessionPath = new URL(page.url()).pathname;
  const samples: { step: string; posts: number; gets: number; ms: number }[] = [];
  // Override only when deliberately recording the old implementation's baseline.
  const expectedGets = Number(process.env.SESSION_REFRESH_EXPECTED_GETS ?? "0");
  async function measure(step: string, operation: () => Promise<unknown>, verify: () => Promise<unknown>, gets = expectedGets, posts = 1) {
    await page.setExtraHTTPHeaders({ "x-session-benchmark-step": step });
    const requests: { method: string }[] = [];
    const onRequest = (request: import("@playwright/test").Request) => {
      if (new URL(request.url()).pathname === sessionPath && request.headers()["next-router-prefetch"] !== "1") requests.push({ method: request.method() });
    };
    page.on("request", onRequest);
    const start = performance.now();
    try {
      const posted = page.waitForResponse(response => new URL(response.url()).pathname === sessionPath && response.request().method() === (posts ? "POST" : "GET"));
      await operation();
      const response = await posted;
      expect(response.ok(), step).toBe(true);
      await verify();
      await page.waitForLoadState("networkidle");
      const sample = { step, posts: requests.filter(r => r.method === "POST").length, gets: requests.filter(r => r.method === "GET").length, ms: performance.now() - start };
      samples.push(sample);
      expect(sample.posts, step).toBe(posts);
      expect(sample.gets, step).toBe(gets);
    } finally { page.off("request", onRequest); }
  }
  try {
    await page.getByRole("button", { name: "Start Round", exact: true }).click();
    await measure("start", () => page.getByRole("button", { name: "Confirm & Start", exact: true }).click(),
      () => expect(page.getByRole("heading", { name: "Round 1 Results", exact: true })).toBeVisible());
    const court = (number: number) => page.getByTestId(`court-match-${number}`);
    await measure("cancel", () => court(2).getByRole("button", { name: "Cancel match", exact: true }).click(),
      () => expect(court(2).getByText("Cancelled", { exact: true })).toBeVisible());
    await page.getByRole("spinbutton", { name: "Court 1 Team 1 score", exact: true }).fill("11");
    await page.getByRole("spinbutton", { name: "Court 1 Team 2 score", exact: true }).fill("7");
    await measure("save-score-control", () => court(1).getByRole("button", { name: "Save Result", exact: true }).click(),
      () => expect(court(1).getByText("Final", { exact: true })).toBeVisible(), 0);
    await measure("advance", () => page.getByRole("button", { name: "Next Round", exact: true }).click(),
      () => expect(page.getByRole("heading", { name: "Round 2", exact: true })).toBeVisible());

    const history = page.getByRole("heading", { name: "Past Rounds History", exact: true }).locator("..");
    await expect(history.getByText("11 – 7", { exact: true })).toBeVisible();
    await expect(history.getByText("Cancelled", { exact: true })).toHaveCount(1);
    await history.getByRole("button", { name: "Edit Result", exact: true }).first().click();
    await history.getByPlaceholder("T2", { exact: true }).fill("9");
    await measure("historical-score", () => history.getByRole("button", { name: "Save Score", exact: true }).click(),
      () => expect(history.getByText("11 – 9", { exact: true })).toBeVisible());
    await history.getByRole("button", { name: "Edit Result", exact: true }).first().click();
    await measure("historical-cancel", () => history.getByRole("button", { name: "Cancel Match", exact: true }).click(),
      () => expect(history.getByText("Cancelled", { exact: true })).toHaveCount(2));

    await page.getByRole("button", { name: "Session Settings", exact: true }).click();
    const guest = page.getByTestId("attendance-row-Refresh Guest 1");
    await measure("attendance-left", () => guest.getByTestId("attendance-left-Refresh Guest 1").click(),
      () => expect(guest.getByTestId("attendance-left-Refresh Guest 1")).toHaveAttribute("aria-pressed", "true"));
    await measure("attendance-present", () => guest.getByTestId("attendance-present-Refresh Guest 1").click(),
      () => expect(guest.getByTestId("attendance-present-Refresh Guest 1")).toHaveAttribute("aria-pressed", "true"));
    await page.getByRole("tab", { name: "Court Configuration", exact: true }).click();
    await measure("court-config", () => page.getByRole("button", { name: "Save Court Configuration", exact: true }).click(),
      () => expect(page.getByText("Court configuration updated successfully.", { exact: true })).toBeVisible());
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await page.getByRole("button", { name: "Start Round", exact: true }).click();
    await measure("start-second", () => page.getByRole("button", { name: "Confirm & Start", exact: true }).click(),
      () => expect(page.getByRole("heading", { name: "Round 2 Results", exact: true })).toBeVisible());
    page.once("dialog", dialog => dialog.accept());
    await measure("reshuffle-active", () => page.getByTestId("reshuffle-matchups-button").click(),
      () => expect(page.getByRole("heading", { name: "Round 2", exact: true })).toBeVisible());
    await expect(page.getByRole("button", { name: "Start Round", exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "Start Round", exact: true }).click();
    await expect(page.getByRole("button", { name: "Confirm & Start", exact: true })).toBeEnabled();
    await measure("start-third", () => page.getByRole("button", { name: "Confirm & Start", exact: true }).click(),
      () => expect(page.getByRole("heading", { name: "Round 2 Results", exact: true })).toBeVisible());
    await expect(page.getByRole("button", { name: "Undo Round 2", exact: true })).toBeEnabled();
    page.once("dialog", dialog => dialog.accept());
    await measure("undo", () => page.getByRole("button", { name: "Undo Round 2", exact: true }).click(),
      () => expect(page.getByRole("heading", { name: "Round 2", exact: true })).toBeVisible());
    await expect(page.getByRole("button", { name: "Start Round", exact: true })).toBeEnabled();
    // This non-mutation freshness path must still fetch authoritative state.
    await measure("bfcache-restore", () => page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }))),
      () => expect(page.getByRole("heading", { name: "Round 2", exact: true })).toBeVisible(), 1, 0);
    await page.setExtraHTTPHeaders({});
    await page.reload();
    await expect(page.getByRole("heading", { name: "Round 2", exact: true })).toBeVisible();
    await expect(history.getByText("Cancelled", { exact: true })).toHaveCount(2);
  } finally {
    await testInfo.attach("action-revalidation-samples", { body: JSON.stringify(samples, null, 2), contentType: "application/json" });
    console.log(`ACTION_REVALIDATION ${JSON.stringify({ project: testInfo.project.name, samples })}`);
  }
});
