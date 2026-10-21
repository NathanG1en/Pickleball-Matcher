import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { sampleReplayMotion, checkAnimationReplay, createTestGroup, createAndSignInPlayer } from "./test-helpers";

test.describe("Corrections and Replay Workflow", () => {
  test("handles match score corrections, cancellations, round undo, and attendance changes", async ({
    page,
  }) => {
    test.setTimeout(90000);
    // 1. Create a group
    const groupName = `Corrections League ${Date.now()}`;
    await createTestGroup(page, groupName);

    // 2. Add 8 players for 2 courts
    await expect(page.locator("h2:has-text('Roster')")).toBeVisible();
    await expect(page.locator("button:has-text('Find Player')")).toBeVisible();
    const addGuestButton = page.locator("button:has-text('Add Guest')");
    await expect(addGuestButton).toBeVisible();
    await addGuestButton.click();
    const players = ["Charlie", "Dana", "Eli", "Frank", "Grace", "Henry", "Ivy"];
    for (const name of players) {
      await page.fill("#guest-player-name", name);
      await page.locator("button:text-is('Add')").click();
      await expect(page.locator("p[role='status']")).toContainText(`Guest player "${name}" added to the roster.`, { timeout: 10000 });
      await expect(page.locator("#guest-player-name")).toHaveValue("");
    }
    await expect(page.getByRole("heading", { name: /Roster \(/ })).toContainText("Roster (8)", { timeout: 15000 });

    // 3. Start a session with 2 courts and 8 players
    await page.click("a[href*='/sessions/new']");
    await expect(page).toHaveURL(/\/sessions\/new/);
    await expect(page.locator("text=8 players selected")).toBeVisible();
    await page.click("button:has-text('Start Session')");
    await expect(page).toHaveURL(/\/sessions\/session_/);

    // 4. Start Round 1
    await page.click("button:has-text('Start Round')");
    await page.click("button:has-text('Confirm & Start')");
    await expect(page.locator("h1")).toContainText("Round 1 Results");

    // 5. Test cancelling a match on Court 2
    await page.locator("[data-testid='court-match-2'] button:has-text('Cancel match')").click();
    await expect(page.locator("[data-testid='court-match-2'] >> text=Cancelled")).toBeVisible();

    // 6. Record and then correct Court 1 score
    const court1Team1 = page.locator("input[aria-label='Court 1 Team 1 score']");
    const court1Team2 = page.locator("input[aria-label='Court 1 Team 2 score']");
    await court1Team1.fill("11");
    await court1Team2.fill("7");
    await page.locator("[data-testid='court-match-1'] button:has-text('Save Result')").click();
    await expect(page.locator("[data-testid='court-match-1'] >> text=Final")).toBeVisible();

    // Now correct the score to 11-9
    await court1Team2.fill("9");
    await expect(page.getByRole("button", { name: "Next Round", exact: true })).toBeDisabled();
    await expect(page.getByTestId("end-session-button")).toBeDisabled();
    await expect(page.getByRole("status")).toContainText("Save or revert your score changes before continuing.");

    // Reverting to the stored score clears the guard without a save.
    await court1Team2.fill("7");
    await expect(page.getByRole("button", { name: "Next Round", exact: true })).toBeEnabled();
    await expect(page.getByTestId("end-session-button")).toBeEnabled();

    // Blank and rejected corrections must keep the guard and the draft.
    await court1Team2.fill("");
    await expect(page.getByRole("button", { name: "Next Round", exact: true })).toBeDisabled();
    await court1Team2.fill("11");
    await page.getByRole("button", { name: "Update Score", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "cannot end in a tie" })).toBeVisible();
    await expect(court1Team2).toHaveValue("11");
    await expect(page.getByRole("button", { name: "Next Round", exact: true })).toBeDisabled();
    await expect(page.getByTestId("end-session-button")).toBeDisabled();

    await court1Team2.fill("9");
    await page.locator("[data-testid='court-match-1'] button:has-text('Update Score')").click();
    await expect(court1Team2).toHaveValue("9");
    await expect(page.getByRole("button", { name: "Next Round", exact: true })).toBeEnabled();
    await page.reload();
    await expect(court1Team2).toHaveValue("9");

    // 7. Advance to Round 2
    await expect(page.locator("button:has-text('Next Round')")).toBeEnabled();
    await page.click("button:has-text('Next Round')");
    await expect(page.locator("h1")).toContainText("Round 2");

    // 8. Test undoing the latest round (Round 2 proposed / start)
    await page.click("button:has-text('Start Round')");
    await page.click("button:has-text('Confirm & Start')");
    await expect(page.locator("h1")).toContainText("Round 2 Results");

    // Click Undo Round 2
    page.on("dialog", (dialog) => dialog.accept());
    await page.click("button:has-text('Undo Round 2')");
    // After undo, should be back to proposal or previous state
    await expect(page.locator("h1:has-text('Round 2')")).toBeVisible();

    // 9. Test mid-session attendance correction
    await page.click("button:has-text('Attendance')");
    await expect(page.locator("h3:has-text('Session Attendance')")).toBeVisible();

    // Toggle player Charlie to Away
    const charlieRow = page.locator("[data-testid='attendance-row-Charlie']");
    await charlieRow.locator("button:has-text('Mark Left')").click();
    await expect(charlieRow.locator("text=Away")).toBeVisible();

    // Toggle Charlie back to Present
    await charlieRow.locator("button:has-text('Mark Present')").click();
    await expect(charlieRow.locator("text=Present")).toBeVisible();

    // Close attendance modal
    await page.click("button:has-text('Close')");
    await expect(page.locator("h3:has-text('Session Attendance')")).not.toBeVisible();
  });

  test("warns about in-progress games when ending session, but not cancelled games", async ({
    page,
  }) => {
    test.setTimeout(90000);
    // 1. Create group and roster
    const groupName = `End Session Warning ${Date.now()}`;
    await createTestGroup(page, groupName);

    const addGuestButton = page.locator("button:has-text('Add Guest')");
    await addGuestButton.click();
    const players = ["Charlie", "Dana", "Eli", "Frank", "Grace", "Henry", "Ivy"];
    for (const name of players) {
      await page.fill("#guest-player-name", name);
      await page.locator("button:text-is('Add')").click();
      await expect(page.locator("p[role='status']")).toContainText(`Guest player "${name}" added to the roster.`, { timeout: 10000 });
      await expect(page.locator("#guest-player-name")).toHaveValue("");
    }
    await expect(page.getByRole("heading", { name: /Roster \(/ })).toContainText("Roster (8)", { timeout: 15000 });

    // 2. Start a session
    await page.click("a[href*='/sessions/new']");
    await expect(page).toHaveURL(/\/sessions\/new/);
    await page.click("button:has-text('Start Session')");
    await expect(page).toHaveURL(/\/sessions\/session_/);

    // 3. Start Round 1
    await page.click("button:has-text('Start Round')");
    await page.click("button:has-text('Confirm & Start')");
    await expect(page.locator("h1")).toContainText("Round 1 Results");

    // 4. Cancel match on Court 2
    await page.locator("[data-testid='court-match-2'] button:has-text('Cancel match')").click();
    await expect(page.locator("[data-testid='court-match-2'] >> text=Cancelled")).toBeVisible();

    // 5. Try ending session while Court 1 is in progress (Court 2 is cancelled)
    await page.click("button[data-testid='end-session-button']");

    // Verify in-progress warning modal appears
    const warningModal = page.locator("[data-testid='in-progress-warning-modal']");
    await expect(warningModal).toBeVisible();
    await expect(warningModal).toContainText("You have these games in progress:");
    await expect(warningModal).toContainText("Court 1");
    // Crucially: Court 2 should NOT appear because it was cancelled!
    await expect(warningModal.locator("[data-testid='in-progress-match-list']")).not.toContainText("Court 2");
    await expect(warningModal).toContainText("Are you sure you want to end it?");

    // 6. Test Cancel button in modal
    await page.click("[data-testid='cancel-end-session-button']");
    await expect(warningModal).not.toBeVisible();
    // Session is still active on the session page
    await expect(page.locator("button[data-testid='end-session-button']")).toBeVisible();

    // 7. Click End Session again, check "Do not ask me again", and confirm
    await page.click("button[data-testid='end-session-button']");
    await expect(warningModal).toBeVisible();
    await page.check("[data-testid='do-not-ask-again-checkbox']");
    await page.click("[data-testid='confirm-end-session-button']");

    // 8. User redirected to group dashboard
    await page.waitForURL(/\/g\/[^/]+$/);

    // Verify session is ended on group page - does NOT say "Resume Session"
    await expect(page.locator("text=Resume Session")).not.toBeVisible();
    await expect(page.locator("text=Session In Progress")).not.toBeVisible();
    await expect(page.locator("h2:has-text('Ready to Play?')")).toBeVisible();

    // Verify session appears in past sessions
    const expandArrow = page.locator("[data-testid^='expand-session-arrow-']").first();
    await expect(expandArrow).toBeVisible();
    await expandArrow.click();
    const viewFullLink = page.locator("[data-testid^='view-full-session-link-']").first();
    await expect(viewFullLink).toBeVisible();
  });
});


test("host synergy follows current partners after manual swaps and new proposals", async ({ page, browser }) => {
  test.setTimeout(120000);
  const { hostName } = await createTestGroup(page, `Pair synergy ${Date.now()}`);
  const names = [hostName];
  const otherContext = await browser.newContext();
  try {
    const otherPage = await otherContext.newPage();
    for (const name of ["Synergy Blake", "Synergy Casey", "Synergy Drew"]) {
      const account = await createAndSignInPlayer(otherPage, { name });
      names.push(name);
      await page.getByRole("textbox", { name: "Look up player by username", exact: true }).fill(account.username);
      await page.getByRole("button", { name: "Add", exact: true }).click();
      await expect(page.getByText(`${names.length} players on roster`, { exact: true })).toBeVisible();
    }
  } finally {
    await otherContext.close();
  }
  await page.getByRole("link", { name: "Start New Session", exact: true }).click();
  await page.getByRole("button", { name: "Start Session", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Round 1", exact: true })).toBeVisible();
  const card = page.locator(".court-card");
  const teamBox = (team: number) => card.getByText(`Team ${team}`, { exact: true }).locator("../..");
  const teamNames = async (team: number) => (await teamBox(team).locator("[draggable] > span").allTextContents()).filter((name) => names.includes(name));
  const winners = await teamNames(1);
  const losers = await teamNames(2);
  expect(winners).toHaveLength(2);
  expect(losers).toHaveLength(2);
  await page.getByRole("button", { name: "Start Round", exact: true }).click();
  await page.getByRole("button", { name: "Confirm & Start", exact: true }).click();
  await page.getByRole("spinbutton", { name: "Court 1 Team 1 score", exact: true }).fill("11");
  await page.getByRole("spinbutton", { name: "Court 1 Team 2 score", exact: true }).fill("5");
  await page.getByRole("button", { name: "Save Result", exact: true }).click();
  await expect(page.getByRole("button", { name: "Next Round", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Next Round", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Round 2", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Customize Lineup", exact: true }).click();
  await page.getByRole("button", { name: "Unlock Manual Swaps", exact: true }).click();

  const arrangeTeam1 = async (desired: string[]) => {
    for (const name of desired) {
      const current = await teamNames(1);
      if (!current.includes(name)) {
        const outgoing = current.find((player) => !desired.includes(player))!;
        await card.getByText(name, { exact: true }).click();
        await card.getByText(outgoing, { exact: true }).click();
        await expect(teamBox(1).getByText(name, { exact: true })).toBeVisible();
      }
    }
  };
  const reveal = () => page.getByRole("button", { name: "Reveal Synergy", exact: true }).click();
  const close = () => page.getByRole("button", { name: "Close Breakdown", exact: true }).click();
  const expectCurrentSynergy = async (team: number, badge: string) => {
    const pairNames = (await teamNames(team)).join(" & ");
    await expect(page.getByText(pairNames, { exact: true }).locator("..")).toContainText(badge);
  };

  await arrangeTeam1(winners);
  await reveal();
  await expectCurrentSynergy(1, "67% (1 games)");
  await expectCurrentSynergy(2, "33% (1 games)");
  await close();

  // Neither mixed partnership has ever played, so neither may inherit a saved score.
  await card.getByText(winners[1], { exact: true }).click();
  await card.getByText(losers[0], { exact: true }).click();
  await reveal();
  await expect(page.getByText("New Duo (0 games)", { exact: true })).toHaveCount(2);
  await close();

  // Moving a known partnership to the other team slot preserves its history.
  await arrangeTeam1(losers);
  await reveal();
  await expectCurrentSynergy(1, "33% (1 games)");
  await expectCurrentSynergy(2, "67% (1 games)");
  await close();

  // A refreshed lineup must agree with the same account-pair history.
  await page.reload();
  const pairKey = (pair: string[]) => [...pair].sort().join("|");
  const expected = new Map([[pairKey(winners), "67% (1 games)"], [pairKey(losers), "33% (1 games)"]]);
  await reveal();
  for (const team of [1, 2]) {
    await expectCurrentSynergy(team, expected.get(pairKey(await teamNames(team))) ?? "New Duo (0 games)");
  }
});


test("custom lineup survives refresh and starts with the saved assignments", async ({ page }) => {
  test.setTimeout(90000);
  await createTestGroup(page, `Lineup draft ${Date.now()}`);
  await page.getByRole("button", { name: "Add Guest", exact: true }).click();
  for (const name of ["Draft Blake", "Draft Casey", "Draft Drew"]) {
    await page.locator("#guest-player-name").fill(name);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.locator("#guest-player-name")).toHaveValue("");
  }
  await page.getByRole("link", { name: "Start New Session", exact: true }).click();
  await page.getByRole("button", { name: "Start Session", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Round 1", exact: true })).toBeVisible();
  const card = page.locator(".court-card");
  const team = (number: number) => card.getByText(`Team ${number}`, { exact: true }).locator("../..");
  const names = async (number: number) => (await team(number).locator("[draggable] > span").allTextContents()).filter((value) => value !== "⋮⋮");
  const original = [await names(1), await names(2)];
  await page.getByRole("button", { name: "Customize Lineup", exact: true }).click();
  await page.getByRole("button", { name: "Unlock Manual Swaps", exact: true }).click();
  await card.getByText(original[0][0], { exact: true }).click();
  await card.getByText(original[1][0], { exact: true }).click();
  let edited = [await names(1), await names(2)];
  expect(edited).not.toEqual(original);
  await page.reload();
  await expect(team(1).getByText(original[1][0], { exact: true })).toBeVisible();
  expect([await names(1), await names(2)]).toEqual(edited);
  await page.getByRole("button", { name: "Customize Lineup", exact: true }).click();
  await page.getByRole("button", { name: "Unlock Manual Swaps", exact: true }).click();
  // Benching creates a definite override even if the new algorithm proposal matches the saved swap.
  await page.getByRole("button", { name: "Bench to sitting pool", exact: true }).first().click();
  await page.getByRole("button", { name: "↺ Reset to Algorithm", exact: true }).click();
  const draftKey = await page.evaluate(() => Object.keys(localStorage).find(key => key.startsWith("lineup-draft:")));
  expect(draftKey).toBeUndefined();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Round 1", exact: true })).toBeVisible();
  const reset = [await names(1), await names(2)];
  await page.getByRole("button", { name: "Customize Lineup", exact: true }).click();
  await page.getByRole("button", { name: "Unlock Manual Swaps", exact: true }).click();
  await card.getByText(reset[0][0], { exact: true }).click();
  await card.getByText(reset[1][0], { exact: true }).click();
  edited = [await names(1), await names(2)];
  await page.getByRole("button", { name: "Start Round", exact: true }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Confirm & Start", exact: true }).click();
  await expect(page.locator("h1")).toContainText("Round 1 Results");
  await page.reload();
  await expect(page.locator("h1")).toContainText("Round 1 Results");
  const savedTeam = page.getByRole("spinbutton", { name: "Court 1 Team 1 score", exact: true }).locator("../..");
  await expect(savedTeam).toHaveCount(1);
  for (const name of edited[0]) await expect(savedTeam).toContainText(name);
});

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`session sign-off only rolls after confirmed matchmaking completion (${reducedMotion})`, async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion });
    await page.addInitScript(() => {
      document.addEventListener("animationstart", event => {
        if (event.animationName === "session-signoff-roll") document.documentElement.dataset.sessionRolls = String(Number(document.documentElement.dataset.sessionRolls ?? "0") + 1);
      });
    });
    const { groupId } = await createTestGroup(page, `Sign-off ${Date.now()}`);
    await page.getByRole("button", { name: "Add Guest", exact: true }).click();
    await page.locator("#guest-player-name").fill("Signoff Guest");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.locator("#guest-player-name")).toHaveValue("");
    await page.getByRole("link", { name: "Start New Session", exact: true }).click();
    await page.getByRole("button", { name: "Start Session", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Round 1", exact: true })).toBeVisible();
    const sessionUrl = page.url();
    page.once("dialog", dialog => dialog.dismiss());
    await page.getByTestId("end-session-button").click();
    await expect(page.getByTestId("end-session-button")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.dataset.sessionRolls)).toBeUndefined();
    if (reducedMotion === "no-preference") {
      await page.route(sessionUrl, route => route.request().method() === "POST" && route.request().headers()["next-action"] ? route.abort() : route.continue());
      page.once("dialog", dialog => dialog.accept());
      await page.getByTestId("end-session-button").click();
      await expect(page.getByRole("alert").filter({ hasText: "Failed to end session." })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.dataset.sessionRolls)).toBeUndefined();
      await page.unrouteAll({ behavior: "wait" });
    }
    page.once("dialog", dialog => dialog.accept());
    await page.getByTestId("end-session-button").click();
    await expect(page).toHaveURL(`/g/${groupId}`);
    const art = page.getByTestId("session-signoff");
    await expect(art).toBeInViewport();
    await expect(art).toHaveAttribute("aria-hidden", "true");
    if (reducedMotion === "no-preference") {
      await expect.poll(() => page.evaluate(() => document.documentElement.dataset.sessionRolls)).toBe("1");
    }
    await expect(art).toHaveAttribute("data-motion", "still");
    expect(await art.evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0);
    expect(await page.evaluate(() => document.documentElement.dataset.sessionRolls)).toBe(reducedMotion === "reduce" ? undefined : "1");
    await art.screenshot({ path: testInfo.outputPath("session-signoff.png") });
    await page.reload();
    await expect(art).toHaveAttribute("data-motion", "still");
    expect(await page.evaluate(() => document.documentElement.dataset.sessionRolls)).toBeUndefined();
    await page.goto(sessionUrl);
    await expect(page.getByTestId("completed-session-full-view")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.dataset.sessionRolls)).toBeUndefined();
    await page.goto(`/g/${groupId}`);
    await expect(art).toHaveAttribute("data-motion", "still");
    expect(await page.evaluate(() => document.documentElement.dataset.sessionRolls)).toBeUndefined();
    if (reducedMotion === "no-preference") {
      const motion = await sampleReplayMotion(art, ".session-signoff-ball");
      expect(motion.duration).toBeGreaterThanOrEqual(1000);
      expect(motion.frames[0].cx - motion.frames[4].cx).toBeGreaterThan(10);
      expect(motion.frames[0].cx - motion.frames[2].cx).toBeGreaterThan(motion.frames[2].cx - motion.frames[4].cx);
      expect(motion.frames[0].cy).toBeCloseTo(motion.frames[4].cy, 0);
    }
    await checkAnimationReplay(page, art, "Replay session sign-off", "sessionRolls", { reducedMotion: reducedMotion === "reduce", touch: Boolean(testInfo.project.use.hasTouch) });
  });
}

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`pickle celebration follows saved 11-0 scores, not drafts or history (${reducedMotion})`, async ({ page }, testInfo) => {
    test.setTimeout(90000);
    await page.emulateMedia({ reducedMotion });
    await page.addInitScript(() => document.addEventListener("animationstart", event => {
      if (event.animationName === "pickle-victory-wiggle") document.documentElement.dataset.pickleWiggles = String(Number(document.documentElement.dataset.pickleWiggles ?? "0") + 1);
    }));
    await createTestGroup(page, `Pickle score ${Date.now()}`);
    await page.getByRole("button", { name: "Add Guest", exact: true }).click();
    await page.locator("#guest-player-name").fill("Pickle Guest");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.locator("#guest-player-name")).toHaveValue("");
    await page.getByRole("link", { name: "Start New Session", exact: true }).click();
    await page.getByRole("button", { name: "Start Session", exact: true }).click();
    await page.getByRole("button", { name: "Start Round", exact: true }).click();
    await page.getByRole("button", { name: "Confirm & Start", exact: true }).click();
    const court = page.getByTestId("court-match-1");
    const score1 = page.getByRole("spinbutton", { name: "Court 1 Team 1 score", exact: true });
    const score2 = page.getByRole("spinbutton", { name: "Court 1 Team 2 score", exact: true });
    const reaction = page.getByTestId("pickle-celebration");
    await score1.fill("11");
    await score2.fill("0");
    await expect(reaction).toHaveCount(0);
    if (reducedMotion === "no-preference") {
      await page.route(page.url(), route => route.request().method() === "POST" && route.request().headers()["next-action"] ? route.abort() : route.continue());
      await court.getByRole("button", { name: "Save Result", exact: true }).click();
      await expect(court.getByRole("alert")).toContainText("Failed to save match result.");
      await expect(reaction).toHaveCount(0);
      await page.unrouteAll({ behavior: "wait" });
    }
    await court.getByRole("button", { name: "Save Result", exact: true }).click();
    await expect(reaction).toBeVisible();
    await expect(reaction.getByRole("status")).toContainText("Pickled! 11–0");
    const art = reaction.getByTestId("pickle-mascot");
    if (reducedMotion === "no-preference") await expect.poll(() => page.evaluate(() => document.documentElement.dataset.pickleWiggles)).toBe("1");
    await expect(art).toHaveAttribute("data-motion", "still");
    await checkAnimationReplay(page, art, "Replay pickle celebration", "pickleWiggles", { reducedMotion: reducedMotion === "reduce", touch: Boolean(testInfo.project.use.hasTouch) });
    const audit = await new AxeBuilder({ page }).include('[data-testid="pickle-celebration"]').analyze();
    expect(audit.violations).toEqual([]);
    await reaction.screenshot({ path: testInfo.outputPath("pickle-celebration.png") });
    await page.reload();
    await expect(score1).toHaveValue("11");
    await expect(score2).toHaveValue("0");
    await expect(reaction).toHaveCount(0);
    await score1.fill("0");
    await score2.fill("11");
    await court.getByRole("button", { name: "Update Score", exact: true }).click();
    await expect(reaction).toBeVisible();
    await expect(art).toHaveAttribute("data-motion", "still");
    await reaction.getByRole("button", { name: "Dismiss pickle celebration", exact: true }).click();
    await expect(reaction).toHaveCount(0);
    await score1.fill("21");
    await score2.fill("0");
    await court.getByRole("button", { name: "Update Score", exact: true }).click();
    await expect(page.getByRole("button", { name: "Next Round", exact: true })).toBeEnabled({ timeout: 15000 });
    await expect(reaction).toHaveCount(0);
  });
}
