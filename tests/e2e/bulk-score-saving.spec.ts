import { expect, test } from "@playwright/test";
import { createTestGroup } from "./test-helpers";

test("Save All persists every court and rejects a stale tab without replacing newer scores", async ({ page }) => {
  test.setTimeout(120_000);
  await createTestGroup(page, `Bulk scoring ${Date.now()}`);
  await page.getByRole("button", { name: "Add Guest", exact: true }).click();
  for (let i = 1; i <= 7; i++) {
    await page.locator("#guest-player-name").fill(`Batch Guest ${i}`);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.locator("p[role='status']")).toContainText(`Guest player "Batch Guest ${i}" added to the roster.`);
    await expect(page.locator("#guest-player-name")).toHaveValue("");
  }
  await page.getByTestId("start-new-session-button").click();
  await page.getByTestId("select-normal-session-button").click();
  await page.getByTestId("continue-to-pairings-button").click();
  await page.getByTestId("start-session-button").click();
  await page.getByRole("button", { name: "Start Round", exact: true }).click();
  await page.getByRole("button", { name: "Confirm & Start", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Round 1 Results", exact: true })).toBeVisible();
  const stale = await page.context().newPage();
  try {
    await stale.goto(page.url());
    await expect(stale.getByRole("heading", { name: "Round 1 Results", exact: true })).toBeVisible();
    for (const [tab, score] of [[page, "7"], [stale, "9"]] as const) {
      for (let court = 1; court <= 2; court++) {
        await tab.getByRole("spinbutton", { name: `Court ${court} Team 1 score`, exact: true }).fill("11");
        await tab.getByRole("spinbutton", { name: `Court ${court} Team 2 score`, exact: true }).fill(score);
      }
    }
    await page.getByTestId("save-all-scores-button").click();
    for (let court = 1; court <= 2; court++) await expect(page.getByTestId(`court-match-${court}`).getByText("Final", { exact: true })).toBeVisible();
    await page.reload();
    for (let court = 1; court <= 2; court++) {
      await expect(page.getByRole("spinbutton", { name: `Court ${court} Team 2 score`, exact: true })).toHaveValue("7");
      await expect(page.getByTestId(`court-match-${court}`).getByText("Final", { exact: true })).toBeVisible();
    }
    await stale.getByTestId("save-all-scores-button").click();
    await expect(stale.getByRole("alert").filter({ hasText: /match changed/i })).toBeVisible();
    await expect(stale.getByRole("spinbutton", { name: "Court 1 Team 2 score", exact: true })).toHaveValue("9");
    await stale.reload();
    for (let court = 1; court <= 2; court++) await expect(stale.getByRole("spinbutton", { name: `Court ${court} Team 2 score`, exact: true })).toHaveValue("7");
    await page.getByRole("button", { name: "Next Round", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Round 2", exact: true })).toBeVisible();
  } finally { await stale.close(); }
});
