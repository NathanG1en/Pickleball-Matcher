import { test, expect } from "@playwright/test";
import { createTestGroup } from "./test-helpers";

test("semifinal corrections clear the final and champion, including after refresh", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await createTestGroup(page, `Bracket corrections ${Date.now()}`);
  await page.getByRole("button", { name: "Add Guest", exact: true }).click();
  for (const name of ["Blake", "Casey", "Drew"]) {
    await page.getByRole("textbox", { name: "Guest Name", exact: true }).fill(name);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByRole("status")).toContainText(`Guest player "${name}" added`);
  }
  await page.getByRole("link", { name: "+ Create Tournament", exact: true }).click();
  await page.getByRole("button", { name: "Select Division Brackets →", exact: true }).click();
  await page.getByRole("button", { name: "Clear", exact: true }).first().click();
  await page.getByRole("checkbox", { name: /Men's Singles/ }).check();
  await page.getByRole("button", { name: "Create Tournament →", exact: true }).click();
  await expect(page).toHaveURL(/\/tournaments\/tr_/);

  const matchId = (round: number, match = 1) => `mens_singles_r${round}_m${match}`;
  const score = async (id: string, first: string, second: string) => {
    await page.getByTestId(`score1-input-${id}`).fill(first);
    await page.getByTestId(`score2-input-${id}`).fill(second);
    await page.getByTestId(`save-score-${id}`).click();
    await expect(page.getByTestId(`save-score-${id}`)).toBeEnabled();
  };
  await score(matchId(1), "11", "5");
  await score(matchId(1, 2), "11", "6");
  await score(matchId(2), "11", "3");
  const champion = page.getByRole("heading", { name: "Men's Singles Champion", exact: true });
  await expect(champion).toBeVisible();

  // A draft on the unaffected semifinal must survive the correction.
  await page.getByTestId(`score2-input-${matchId(1, 2)}`).fill("8");
  await score(matchId(1), "5", "11");
  await expect(champion).toHaveCount(0);
  // Inline drafts for the previous finalists must be cleared immediately too.
  await expect(page.getByTestId(`score1-input-${matchId(2)}`)).toHaveValue("");
  await expect(page.getByTestId(`score2-input-${matchId(2)}`)).toHaveValue("");
  await expect(page.getByTestId(`score1-input-${matchId(1, 2)}`)).toHaveValue("11");
  await expect(page.getByTestId(`score2-input-${matchId(1, 2)}`)).toHaveValue("8");
  await page.reload();
  await expect(champion).toHaveCount(0);
  await expect(page.getByTestId(`score1-input-${matchId(2)}`)).toHaveValue("");
  await expect(page.getByTestId(`score2-input-${matchId(2)}`)).toHaveValue("");
  await page.screenshot({ path: testInfo.outputPath("corrected-semifinal-clears-final.png"), fullPage: true });

  await score(matchId(2), "11", "4");
  await expect(champion).toBeVisible();
  // Correct the other semifinal through the edit dialog, as in the audit.
  await page.getByRole("button", { name: "Edit", exact: true }).nth(1).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("spinbutton").nth(0).fill("6");
  await dialog.getByRole("spinbutton").nth(1).fill("11");
  await dialog.getByRole("button", { name: "Save Matchup", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(champion).toHaveCount(0);
  await expect(page.getByTestId(`score1-input-${matchId(2)}`)).toHaveValue("");
  await expect(page.getByTestId(`score2-input-${matchId(2)}`)).toHaveValue("");
  await page.reload();
  await expect(champion).toHaveCount(0);
});
