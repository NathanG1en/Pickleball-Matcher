import { test, expect } from "@playwright/test";
import { createTestGroup } from "./test-helpers";

test("organizer saves and refreshes session partners before starting a paired round", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await createTestGroup(page, `Stay Together ${Date.now()}`);
  await page.getByRole("button", { name: "Add Guest", exact: true }).click();
  for (const name of ["Alex Friend", "Sam Friend", "Casey Friend", "Drew Friend"]) {
    await page.locator("#guest-player-name").fill(name);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.locator("#guest-player-name")).toHaveValue("");
  }
  await page.getByTestId("start-new-session-button").click();
  await page.getByTestId("select-normal-session-button").click();
  await page.getByRole("combobox", { name: "First friend", exact: true }).selectOption({ label: "Alex Friend" });
  await page.getByRole("combobox", { name: "Second friend", exact: true }).selectOption({ label: "Sam Friend" });
  await page.getByRole("button", { name: "Add pair", exact: true }).click();
  await expect(page.getByTestId("stay-together-settings").getByRole("listitem").filter({ hasText: "Alex Friend" }).filter({ hasText: "Sam Friend" })).toBeVisible();
  await page.getByRole("button", { name: "Start Session", exact: true }).click();
  await expect(page).toHaveURL(/\/sessions\/session_/);
  await expect(page.getByTestId("stay-together-settings")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("stay-together-settings").getByRole("listitem").filter({ hasText: "Alex Friend" }).filter({ hasText: "Sam Friend" })).toBeVisible();
  await page.getByRole("combobox", { name: "First friend", exact: true }).selectOption({ label: "Casey Friend" });
  await page.getByRole("combobox", { name: "Second friend", exact: true }).selectOption({ label: "Drew Friend" });
  await page.getByRole("button", { name: "Add pair", exact: true }).click();
  await expect(page.getByTestId("stay-together-settings").getByRole("listitem").filter({ hasText: "Casey Friend" }).filter({ hasText: "Drew Friend" })).toBeVisible({ timeout: 20_000 });
  await page.reload();
  await expect(page.getByTestId("stay-together-settings").getByRole("listitem").filter({ hasText: "Casey Friend" }).filter({ hasText: "Drew Friend" })).toBeVisible();
  const soloNotice = page.getByRole("status").filter({ hasText: "is sitting this round to rotate playing time" });
  const showedSoloNotice = await soloNotice.isVisible();
  await page.screenshot({ path: testInfo.outputPath("stay-together-preview.png"), fullPage: true });
  await page.getByRole("button", { name: "Start Round", exact: true }).click();
  await page.getByRole("button", { name: "Confirm & Start", exact: true }).click();
  await expect(page.getByRole("button", { name: "Save Result", exact: true })).toBeVisible();
  await page.getByRole("spinbutton", { name: "Court 1 Team 1 score", exact: true }).fill("11");
  await page.getByRole("spinbutton", { name: "Court 1 Team 2 score", exact: true }).fill("5");
  await page.getByRole("button", { name: "Save Result", exact: true }).click();
  await page.getByRole("button", { name: "Next Round", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Round 2", exact: true })).toBeVisible();
  if (!showedSoloNotice) await expect(soloNotice).toBeVisible();
});
