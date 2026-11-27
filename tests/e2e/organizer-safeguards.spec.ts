import { test, expect, type Page } from "@playwright/test";
import { createTestGroup } from "./test-helpers";

async function addGuests(page: Page, names: string[]) {
  await page.locator("button:has-text('Add Guest')").click();
  for (const name of names) {
    await page.fill("#guest-player-name", name);
    await page.locator("button:text-is('Add')").click({ force: true });
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

test("attendance rows stay put, typed scores survive a reload, and the tally and summary are there", async ({ page }) => {
  test.setTimeout(120_000);
  const { groupId } = await createTestGroup(page, `Courtside Comforts ${Date.now()}`);
  await addGuests(page, ["Alex", "Blake", "Casey", "Drew", "Ellis", "Finley", "Glenn"]);

  await page.click("a[href*='/sessions/new']");
  await page.click("button[data-testid='select-normal-session-button']");
  await page.click("button[data-testid='continue-to-pairings-button']");
  await page.click("button:has-text('Start Session')");
  await expect(page).toHaveURL(/\/sessions\/session_/);
  const sessionPath = new URL(page.url()).pathname;
  await page.click("button:has-text('Start Round')");
  const confirm = page.locator("button:has-text('Confirm & Start')");
  if (await confirm.isVisible({ timeout: 2000 }).catch(() => false)) await confirm.click();
  const c1t1 = page.locator("input[aria-label='Court 1 Team 1 score']");
  await expect(c1t1).toBeVisible();
  await expect(c1t1).toHaveAttribute("inputmode", "numeric");

  // Scores typed but not saved come back after the page reloads.
  await c1t1.fill("11");
  await page.locator("input[aria-label='Court 1 Team 2 score']").fill("7");
  await page.reload();
  await expect(c1t1).toHaveValue("11");
  await expect(page.locator("input[aria-label='Court 1 Team 2 score']")).toHaveValue("7");

  // Save & Start explains what's missing.
  await expect(page.getByTestId("save-and-start-next-round-button")).toBeDisabled();
  await expect(page.getByTestId("save-start-blocked-reason")).toContainText("Court 2 needs a score");

  // Marking someone out keeps their row where it was until Settings is reopened.
  await page.getByRole("button", { name: "Session Settings", exact: true }).click();
  const presentList = page.getByTestId("attendance-present-list");
  await presentList.getByTestId("attendance-left-Alex").click();
  await expect(page.getByTestId("attendance-left-Alex")).toHaveAttribute("aria-pressed", "true");
  await expect(presentList.getByTestId("attendance-row-Alex")).toBeVisible();
  await presentList.getByTestId("attendance-present-Alex").click();
  await expect(page.getByTestId("attendance-present-Alex")).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Close", exact: true }).click();

  // The running tally is available on demand.
  const tally = page.getByTestId("play-count");
  await tally.locator("summary").click();
  await expect(tally.getByRole("columnheader", { name: "Played" })).toBeVisible();

  // Finish and end; the dashboard points at the summary.
  const courts = await page.locator("[data-testid^='court-match-']").count();
  for (let court = 1; court <= courts; court++) {
    await page.locator(`input[aria-label='Court ${court} Team 1 score']`).fill("11");
    await page.locator(`input[aria-label='Court ${court} Team 2 score']`).fill(String(3 + court));
    await page.locator(`[data-testid='court-match-${court}'] button:has-text('Save Result')`).click();
    await expect(page.getByTestId(`court-match-${court}`).getByText("Final", { exact: true })).toBeVisible();
  }
  await page.getByTestId("end-session-button").click();
  await page.getByTestId("confirm-end-session-button").click();
  await expect(page.getByTestId("completed-session-badge")).toBeVisible();
  await page.goto(`/g/${groupId}`);
  await expect(page.getByTestId("session-summary-link")).toHaveAttribute("href", sessionPath);
});
