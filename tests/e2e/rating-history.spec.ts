import { test, expect } from "@playwright/test";
import { createTestGroup } from "./test-helpers";

test("joining a new session without playing does not reset the rating graph", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const { groupId, hostName, hostUsername } = await createTestGroup(page, `History carry-forward ${Date.now()}`);
  await page.getByTestId("start-new-session-button").click();
  await page.getByTestId("select-open-play-button").click();
  await page.getByTestId("start-open-play-button").click();
  await expect(page).toHaveURL(/\/sessions\/session_/);
  for (const name of ["History Ally", "History Opponent A", "History Opponent B"]) {
    await page.locator("#guest-name-input").fill(name);
    await page.locator("form").filter({ has: page.locator("#guest-name-input") }).locator("button[type='submit']").click();
    const popup = page.getByTestId("guest-added-popup");
    await expect(popup).toBeVisible();
    await popup.getByRole("button", { name: "Dismiss", exact: true }).click();
    await expect(page.getByTestId("open-play-attendees").getByText(name, { exact: true })).toBeVisible();
  }
  const card = page.getByTestId("submit-game-card");
  await expect(card.getByTestId("select-team-1-player-1")).toContainText(hostName);
  for (const [selector, name] of [["select-team-1-player-2", "History Ally"], ["select-team-2-player-1", "History Opponent A"], ["select-team-2-player-2", "History Opponent B"]]) {
    await card.getByTestId(selector).click();
    await page.getByRole("option").filter({ hasText: name }).click();
  }
  await card.getByRole("spinbutton", { name: "Team 1 Score", exact: true }).fill("11");
  await card.getByRole("spinbutton", { name: "Team 2 Score", exact: true }).fill("7");
  await card.getByTestId("submit-game-button").click();
  await expect(page.getByTestId("open-play-matches-list")).toContainText("11 – 7");
  page.once("dialog", dialog => dialog.accept());
  await page.getByTestId("end-session-button").click();
  await expect(page.getByText("Completed", { exact: true })).toBeVisible();
  await page.goto(`/g/${groupId}`);
  await page.getByTestId("start-new-session-button").click();
  await page.getByTestId("select-normal-session-button").click();
  await page.getByRole("button", { name: "Start Session", exact: true }).click();
  await expect(page).toHaveURL(/\/sessions\/session_/);
  for (const route of ["/players", `/players/${hostUsername}`]) {
    await page.goto(route);
    // Equal provisional teams gain 20 Elo: 1000 -> 1020, displayed as 3.55.
    await expect(page.locator("header").first()).toContainText("3.55");
    const lastPoint = page.getByTestId("rating-point-1");
    await expect(lastPoint).toHaveAttribute("aria-label", /^Rating 3\.55 on /);
    await lastPoint.click();
    await expect(page.getByTestId("tooltip-rating")).toContainText("3.55");
    await page.reload();
    await expect(lastPoint).toHaveAttribute("aria-label", /^Rating 3\.55 on /);
  }
  await page.screenshot({ path: testInfo.outputPath("rating-carried-forward.png"), fullPage: true });
});
