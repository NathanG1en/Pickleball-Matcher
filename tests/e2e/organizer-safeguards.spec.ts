import { test, expect, type Page } from "@playwright/test";
import { createTestGroup } from "./test-helpers";

async function addGuests(page: Page, names: string[]) {
  await page.locator("button:has-text('Add Guest')").click();
  for (const name of names) {
    await page.fill("#guest-player-name", name);
    await page.locator("button:text-is('Add')").click();
    await expect(page.locator("p[role='status']")).toContainText(`Guest player "${name}" added to the roster.`);
  }
}

const lineupText = async (page: Page) => {
  await expect(page.locator(".court-card").first()).toBeVisible();
  return (await page.locator(".court-card").allInnerTexts()).join(" | ").replace(/\s+/g, " ");
};

test("the proposed lineup survives reloads, and a reshuffle is remembered until the round starts", async ({ page }) => {
  test.setTimeout(90_000);
  await createTestGroup(page, `Stable Lineup ${Date.now()}`);
  await addGuests(page, ["Alex", "Blake", "Casey", "Drew", "Ellis", "Finley", "Glenn", "Harper", "Jamie"]);

  await page.click("a[href*='/sessions/new']");
  await page.click("button[data-testid='select-normal-session-button']");
  await page.click("button[data-testid='continue-to-pairings-button']");
  await page.click("button:has-text('Start Session')");
  await expect(page).toHaveURL(/\/sessions\/session_/);

  const first = await lineupText(page);
  await page.reload();
  expect(await lineupText(page)).toBe(first);
  await page.reload();
  expect(await lineupText(page)).toBe(first);

  // An explicit reshuffle changes the lineup, and a reload keeps the reshuffled one.
  await page.getByTestId("reshuffle-matchups-button").click();
  await expect.poll(() => lineupText(page)).not.toBe(first);
  const reshuffled = await lineupText(page);
  await page.reload();
  expect(await lineupText(page)).toBe(reshuffled);
});

test("tournament setup starts with no divisions and blocks divisions without eligible players", async ({ page }) => {
  test.setTimeout(45_000);
  await createTestGroup(page, `Division Guard ${Date.now()}`);
  await addGuests(page, ["Blake", "Casey", "Drew"]); // all default to male, like the host

  await page.getByRole("link", { name: "+ Create Tournament", exact: true }).click();
  await page.getByRole("button", { name: "Select Division Brackets →", exact: true }).click();

  await expect(page.locator("input[id^='division-check-']:checked")).toHaveCount(0);
  await expect(page.getByRole("checkbox", { name: /^Men's Singles/ })).toBeEnabled();
  for (const division of ["Women's Singles", "Women's Doubles", "Mixed Doubles"]) {
    const box = page.getByRole("checkbox", { name: new RegExp(`^${division}`) });
    await expect(box).toBeDisabled();
  }
  await expect(page.locator("label[for='division-check-womens_singles']")).toContainText("Needs 2+ eligible players");
  await expect(page.locator("label[for='division-check-womens_singles']")).toContainText("0 entrants");
});
