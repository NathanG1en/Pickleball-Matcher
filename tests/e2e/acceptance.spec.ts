import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { sampleReplayMotion, checkAnimationReplay, createAndSignInPlayer, createTestGroup } from "./test-helpers";

test.describe("PRD Acceptance Workflow: 14 players, 3 courts", () => {
  test("creates group, manages attendance, generates fair rounds, and records scores", async ({ page }, testInfo) => {
    test.setTimeout(120000);
    // 1. Authenticate player and visit setup page
    await createAndSignInPlayer(page);
    await expect(page.locator("h1")).toContainText("Create Group");

    // Accessibility check on setup page
    const setupA11y = await new AxeBuilder({ page })
      .disableRules(["color-contrast"]) // outdoor high contrast styles handled
      .analyze();
    expect(setupA11y.violations).toEqual([]);

    // 2. Submit setup form
    const groupName = `Acceptance Test League ${Date.now()}`;
    await page.fill("#group-name", groupName);
    await page.click("button[type='submit']");

    // Should navigate to group dashboard
    await expect(page).toHaveURL(/\/g\/grp_/);
    await expect(page.locator("h1")).toContainText(groupName);

    // 3. Add players to roster until we have 14 players
    await expect(page.locator("h2:has-text('Roster')")).toBeVisible();
    await expect(page.locator("button:has-text('Find Player')")).toBeVisible();
    const addGuestButton = page.locator("button:has-text('Add Guest')");
    await expect(addGuestButton).toBeVisible();
    await addGuestButton.click();

    const playerNames = [
      "Alex", "Blake", "Casey", "Drew", "Ellis", "Finley", "Glenn",
      "Harper", "Jamie", "Kendall", "Logan", "Morgan", "Peyton"
    ];

    for (const name of playerNames) {
      await page.fill("#guest-player-name", name);
      await page.locator("button:text-is('Add')").click();
      await expect(page.locator("p[role='status']")).toContainText(`Guest player "${name}" added to the roster.`, { timeout: 10000 });
      await expect(page.locator("#guest-player-name")).toHaveValue("");
    }

    await expect(page.getByRole("heading", { name: /Roster \(/ })).toContainText("Roster (14)", { timeout: 15000 });

    // 4. Start new session
    await page.click("a[href*='/sessions/new']");
    await expect(page).toHaveURL(/\/sessions\/new/);

    // Select Normal Session format
    await page.click("button[data-testid='select-normal-session-button']");

    // Increase courts to 3
    const courtDisplay = page.locator("span[aria-label='Court count']");
    while ((await courtDisplay.textContent()) !== "3") {
      await page.click("button[aria-label='Increase courts']");
    }

    // Verify 14 players selected
    await expect(page.locator("text=14 players selected")).toBeVisible();

    // Start session
    await page.click("button:has-text('Start Session')");
    await expect(page).toHaveURL(/\/sessions\/session_/, { timeout: 15000 });

    // 5. Verify Round 1 Proposal: 3 courts (12 players) and 2 sits
    await expect(page.locator(".court-card:has-text('Court 1')")).toBeVisible();
    await expect(page.locator(".court-card:has-text('Court 2')")).toBeVisible();
    await expect(page.locator(".court-card:has-text('Court 3')")).toBeVisible();
    const sitsSection = page.locator("section:has-text('Sitting this round')");
    await expect(sitsSection).toBeVisible();
    // Verify Reshuffle Matchups in proposed round
    const reshuffleButton = page.locator("[data-testid='reshuffle-matchups-button']");
    await expect(reshuffleButton).toBeVisible();
    await reshuffleButton.click();
    await expect(page.locator(".court-card:has-text('Court 1')")).toBeVisible();

    const round1Sitters = await sitsSection.locator("span").allTextContents();
    expect(round1Sitters.length).toBeGreaterThanOrEqual(2);

    // Start Round 1
    await page.click("button:has-text('Start Round')");
    await page.click("button:has-text('Confirm & Start')");

    // 6. Enter scores for Round 1
    await expect(page.locator("h1")).toContainText("Round 1 Results");
    await expect(page.getByTestId("session-highlights")).toHaveCount(0);

    // Fill in scores for Court 1, 2, 3
    const court1Team1 = page.locator("input[aria-label='Court 1 Team 1 score']");
    const court1Team2 = page.locator("input[aria-label='Court 1 Team 2 score']");
    await court1Team1.fill("11");
    await court1Team2.fill("7");
    await page.locator("[data-testid='court-match-1'] button:has-text('Save Result')").click();
    await expect(page.locator("[data-testid='court-match-1'] >> text=Final")).toBeVisible({ timeout: 15000 });

    const court2Team1 = page.locator("input[aria-label='Court 2 Team 1 score']");
    const court2Team2 = page.locator("input[aria-label='Court 2 Team 2 score']");
    await court2Team1.fill("11");
    await court2Team2.fill("9");
    await page.locator("[data-testid='court-match-2'] button:has-text('Save Result')").click();
    await expect(page.locator("[data-testid='court-match-2'] >> text=Final")).toBeVisible();

    const court3Team1 = page.locator("input[aria-label='Court 3 Team 1 score']");
    const court3Team2 = page.locator("input[aria-label='Court 3 Team 2 score']");
    await court3Team1.fill("9");
    await court3Team2.fill("11");
    await page.locator("[data-testid='court-match-3'] button:has-text('Save Result')").click();
    await expect(page.locator("[data-testid='court-match-3'] >> text=Final")).toBeVisible();

    // 7. Advance to Round 2
    await page.click("button:has-text('Next Round')");

    // Verify Round 2 Proposal
    await expect(page.locator("h1")).toContainText("Round 2");
    await expect(page.locator(".court-card:has-text('Court 1')")).toBeVisible();
    await expect(page.locator(".court-card:has-text('Court 2')")).toBeVisible();
    await expect(page.locator(".court-card:has-text('Court 3')")).toBeVisible();

    // Prior sitters must NOT sit again in Round 2
    const round2SitsSection = page.locator("section:has-text('Sitting this round')");
    await expect(async () => {
      const round2Sitters = await round2SitsSection.locator("span").allTextContents();
      expect(round2Sitters.length).toBeGreaterThanOrEqual(2);
      for (const sitter of round1Sitters) {
        if (sitter.trim()) {
          expect(round2Sitters).not.toContain(sitter);
        }
      }
    }).toPass({ timeout: 10000 });

    // 8. End the session and verify completed session summary remains visible without returning to group
    const sessionUrl = page.url();
    page.once("dialog", (dialog) => dialog.accept());
    await page.click("button:has-text('End Session')");

    // After ending session, user is redirected to group dashboard
    await page.waitForURL(/\/g\/[^/]+$/);

    // Expand past sessions list and navigate to full session summary
    const expandArrow = page.locator("[data-testid^='expand-session-arrow-']").first();
    const pastSessionOptions = page.locator("[data-testid^='session-options-menu-button-']").first();
    await expect(expandArrow).toBeVisible();
    await expect(pastSessionOptions).toBeVisible();
    const arrowBox = await expandArrow.boundingBox();
    const optionsBox = await pastSessionOptions.boundingBox();
    expect(arrowBox && optionsBox && optionsBox.x > arrowBox.x).toBe(true);

    // Test canceling rename session from past sessions options menu
    await pastSessionOptions.click();
    const historyRenameItem = page.locator("[data-testid='rename-session-menu-item']");
    const historyDuplicateItem = page.locator("[data-testid='duplicate-session-menu-item']");
    const historyDeleteItem = page.locator("[data-testid='delete-session-menu-item']");
    await expect(historyRenameItem).toBeVisible();
    await expect(historyDuplicateItem).toBeVisible();
    await expect(historyDeleteItem).toBeVisible();

    await historyRenameItem.click();
    const renameModal = page.locator("div[role='dialog']:has-text('Rename Session')");
    await expect(renameModal).toBeVisible();
    const nameInput = renameModal.locator("#rename-session-name-input");
    await expect(nameInput).toBeVisible();
    await nameInput.fill("Accidental New Name");
    await renameModal.locator("button:text-is('Cancel')").click();
    await expect(renameModal).not.toBeVisible();

    // Verify session row did NOT change and nothing changed about the group
    const pastSessionRow = page.locator("[data-testid^='past-session-item-']").first();
    await expect(pastSessionRow).not.toContainText("Accidental New Name");

    // Now test actually renaming session from past sessions options menu
    await pastSessionOptions.click();
    await historyRenameItem.click();
    await expect(renameModal).toBeVisible();
    await expect(nameInput).toHaveValue("");
    await nameInput.fill("Championship Night");
    await renameModal.locator("button[data-testid='confirm-rename-session-button']").click();

    // Verify session row updates with new name
    await expect(pastSessionRow).toContainText("Championship Night");

    await expandArrow.click();

    const viewFullLink = page.locator("[data-testid^='view-full-session-link-']").first();
    await expect(viewFullLink).toBeVisible();
    await viewFullLink.click();

    // Verify full session summary renders and stays visible
    await page.waitForURL(/\/sessions\/[^/]+$/);
    const summaryCard = page.locator("[data-testid='completed-session-full-view']");
    await expect(summaryCard).toBeVisible();

    const highlights = page.getByTestId("session-highlights");
    await expect(highlights).toBeVisible();
    await expect(highlights).toContainText("From 3 completed games");
    await expect(highlights.getByTestId("highlight-closest-game")).toContainText("11 – 9");
    await expect(highlights.getByTestId("highlight-most-wins")).toContainText("1 win");
    await expect(highlights.getByTestId("highlight-most-partners")).toContainText("1 partner");
    await page.reload();
    await expect(highlights.getByTestId("highlight-closest-game")).toContainText("11 – 9");
    const tiedGames = highlights.locator("details");
    await expect(tiedGames.locator("summary")).toHaveText("1 other game tied");
    await tiedGames.locator("summary").focus();
    await page.keyboard.press("Enter");
    await expect(tiedGames).toHaveAttribute("open", "");
    await expect(tiedGames.locator("li")).toContainText("9 – 11");
    await page.keyboard.press("Space");
    await expect(tiedGames).not.toHaveAttribute("open", "");
    await highlights.screenshot({ path: testInfo.outputPath("session-highlights.png") });
    const recapA11y = await new AxeBuilder({ page }).analyze();
    expect(recapA11y.violations).toEqual([]);

    await expect(page.getByRole("heading", { level: 1, name: "Championship Night", exact: true })).toBeVisible();

    // Test canceling inline session name change
    const editSessionNameBtn = page.locator("button[aria-label='Edit session name']");
    await expect(editSessionNameBtn).toBeVisible();
    await editSessionNameBtn.click();
    const inlineInput = page.locator("#session-name-input");
    await expect(inlineInput).toBeVisible();
    await inlineInput.fill("Accidental Inline Name");
    await page.locator("button:text-is('Cancel')").click();
    await expect(inlineInput).not.toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Championship Night", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Accidental Inline Name", exact: true })).not.toBeVisible();

    // Wait 1.5s to ensure it does NOT redirect back to the group dashboard
    await page.waitForTimeout(1500);
    expect(page.url()).toBe(sessionUrl);
    await expect(summaryCard).toBeVisible();

    // 9. Host duplicates the session with confirmation via options menu dropdown
    const optionsButton = page.locator("[data-testid='session-options-menu-button']");
    await expect(optionsButton).toBeVisible();
    await optionsButton.click();

    const renameMenuItem = page.locator("[data-testid='rename-session-menu-item']");
    const duplicateMenuItem = page.locator("[data-testid='duplicate-session-menu-item']");
    const deleteMenuItem = page.locator("[data-testid='delete-session-menu-item']");
    await expect(renameMenuItem).toBeVisible();
    await expect(duplicateMenuItem).toBeVisible();
    await expect(deleteMenuItem).toBeVisible();

    // Test cancel duplication
    await duplicateMenuItem.click();
    const duplicateConfirmModal = page.locator("[role='alertdialog']");
    await expect(duplicateConfirmModal).toBeVisible();
    await expect(duplicateConfirmModal).toContainText("Duplicate Session");
    await duplicateConfirmModal.locator("button:has-text('Cancel')").click();
    await expect(duplicateConfirmModal).not.toBeVisible();
    expect(page.url()).toBe(sessionUrl);

    // Confirm duplicate
    await optionsButton.click();
    await duplicateMenuItem.click();
    await expect(duplicateConfirmModal).toBeVisible();
    await duplicateConfirmModal.locator("button[data-testid='confirm-duplicate-session-button']").click();

    // Verify redirected to new active session
    await page.waitForURL((url) => url.href !== sessionUrl && url.pathname.includes("/sessions/session_"));
    const newSessionUrl = page.url();
    expect(newSessionUrl).not.toBe(sessionUrl);

    // Verify duplicated session has active status and players
    await expect(page.locator("h2, h1").filter({ hasText: new RegExp(new Date().toLocaleDateString("en-US", { month: "short" })) })).toBeVisible();

    // Delete the duplicated session
    const newSessionOptionsButton = page.locator("[data-testid='session-options-menu-button']");
    await expect(newSessionOptionsButton).toBeVisible();
    await newSessionOptionsButton.click();
    await page.locator("[data-testid='delete-session-menu-item']").click();
    const deleteModal = page.locator("[role='alertdialog']");
    await expect(deleteModal).toBeVisible();
    await deleteModal.locator("button:has-text('Delete Session')").click();
    await page.waitForURL(/\/g\/[^/]+$/);

    // Navigate back to original completed session to test deleting it
    await page.goto(sessionUrl);
    await optionsButton.click();
    await expect(deleteMenuItem).toBeVisible();
    await deleteMenuItem.click();

    // Verify confirmation modal opens
    const confirmModal = page.locator("[role='alertdialog']");
    await expect(confirmModal).toBeVisible();
    await expect(confirmModal).toContainText("Delete Session");
    await expect(confirmModal).toContainText(/Are you sure you want to delete ("Championship Night"|this session)\?/);

    // Test canceling the deletion
    await confirmModal.locator("button:has-text('Cancel')").click();
    await expect(confirmModal).not.toBeVisible();
    expect(page.url()).toBe(sessionUrl);

    // Confirm deletion
    await optionsButton.click();
    await expect(deleteMenuItem).toBeVisible();
    await deleteMenuItem.click();
    await expect(confirmModal).toBeVisible();
    await confirmModal.locator("button:has-text('Delete Session')").click();

    // Verify redirected back to group dashboard and session is deleted
    await page.waitForURL(/\/g\/[^/]+$/);
    await expect(page.locator("[data-testid='past-sessions-list']")).toContainText("No sessions played yet.");
  });
});


test("tournament final waits for both semifinal qualifiers", async ({ page }) => {
  test.setTimeout(90000);
  await createTestGroup(page, `Tournament readiness ${Date.now()}`);
  await page.getByRole("button", { name: "Add Guest", exact: true }).click();
  for (const name of ["Qualifier A", "Qualifier B"]) {
    await page.fill("#guest-player-name", name);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.locator("#guest-player-name")).toHaveValue("");
  }
  await page.getByRole("link", { name: "+ Create Tournament", exact: true }).click();
  await page.getByRole("button", { name: "Clear", exact: true }).first().click();
  await page.getByRole("checkbox", { name: /^Men's Singles/ }).check();
  await page.getByRole("button", { name: "Create Tournament →", exact: true }).click();
  await expect(page).toHaveURL(/\/tournaments\/tr_/);
  const final = page.locator(".round-column").last().locator(".bracket-match-card");
  await expect(final).toContainText("TBD");
  await expect(final.getByRole("button", { name: "Win", exact: true })).toBeDisabled();
  await page.reload();
  await expect(final.getByRole("button", { name: "Win", exact: true })).toBeDisabled();
  const semifinal = page.locator(".round-column").first().locator(".bracket-match-card").filter({ has: page.getByRole("button", { name: "Win", exact: true }) });
  await semifinal.getByRole("button", { name: "Win", exact: true }).first().click();
  await expect(final).not.toContainText("TBD");
  await expect(final.getByRole("button", { name: "Win", exact: true }).first()).toBeEnabled();
  await final.getByRole("button", { name: "Win", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Men's Singles Champion", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Men's Singles Champion", exact: true })).toBeVisible();
});

for (const courtSizes of [[4], [4, 3, 2]]) {
  test(`temporary group summarizes ${courtSizes.length} courts separately from player capacity`, async ({ page }) => {
    const capacity = courtSizes.reduce((sum, size) => sum + size, 0);
    await page.goto("/temporary");
    await page.getByRole("textbox", { name: "Group name", exact: true }).fill("Court summary regression");
    await page.getByRole("textbox", { name: "Player names · one per line", exact: true }).fill(
      Array.from({ length: capacity + 1 }, (_, index) => `Player ${index + 1}`).join("\n"),
    );
    await page.getByRole("combobox", { name: "Number of courts", exact: true }).selectOption(String(courtSizes.length));
    for (const [index, size] of courtSizes.entries()) {
      await page.getByRole("combobox", { name: `Court ${index + 1}`, exact: true }).selectOption(String(size));
    }
    await page.getByRole("button", { name: "Start Temporary Group", exact: true }).click();
    const summary = `${courtSizes.length} court${courtSizes.length === 1 ? "" : "s"} · ${capacity} playing · 1 sitting out`;
    await expect(page.getByText(summary, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Generate First Round", exact: true }).click();
    await expect(page.getByRole("spinbutton")).toHaveCount(courtSizes.length * 2);
    page.once("dialog", (dialog) => dialog.accept());
    await page.reload();
    await expect(page.getByText(summary, { exact: true })).toBeVisible();
    await expect(page.getByRole("spinbutton")).toHaveCount(courtSizes.length * 2);
  });
}

test("restored temporary group calculates capacity from saved courts without a setup draft", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("pickleball-temporary-group-v1", JSON.stringify({
      name: "Restored mixed courts", isPublic: false, courtPlayerCounts: [4, 3, 2],
      players: Array.from({ length: 10 }, (_, index) => ({ id: `p${index}`, name: `Player ${index}`, rating: 1000 })),
      rounds: [], currentRound: null,
    }));
  });
  await page.goto("/temporary");
  await expect(page.getByRole("heading", { name: "Restored mixed courts", exact: true })).toBeVisible();
  await expect(page.getByText("3 courts · 9 playing · 1 sitting out", { exact: true })).toBeVisible();
});

test("round generation indicator follows pending requests and clears on success or failure", async ({ page }, testInfo) => {
  test.setTimeout(90000);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await createTestGroup(page, `Generation feedback ${Date.now()}`);
  await page.getByRole("button", { name: "Add Guest", exact: true }).click();
  for (const name of ["Generation Blake", "Generation Casey", "Generation Drew"]) {
    await page.locator("#guest-player-name").fill(name);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.locator("#guest-player-name")).toHaveValue("");
  }
  await page.getByRole("link", { name: "Start New Session", exact: true }).click();
  await page.getByTestId("select-normal-session-button").click();
  await page.getByRole("button", { name: "Start Session", exact: true }).click();
  await page.getByRole("button", { name: "Start Round", exact: true }).click();
  await page.getByRole("button", { name: "Confirm & Start", exact: true }).click();
  await page.getByRole("spinbutton", { name: "Court 1 Team 1 score", exact: true }).fill("11");
  await page.getByRole("spinbutton", { name: "Court 1 Team 2 score", exact: true }).fill("5");
  const sessionUrl = page.url();
  const indicator = page.getByRole("status").filter({ hasText: "Generating…" });
  const pauseAction = async (abort = false) => {
    let release = () => {};
    const gate = new Promise<void>(resolve => { release = resolve; });
    const handler = async (route: import("@playwright/test").Route) => {
      if (route.request().method() !== "POST" || !route.request().headers()["next-action"]) return route.continue();
      await gate;
      if (abort) await route.abort();
      else await route.continue();
    };
    await page.route(sessionUrl, handler);
    return { release, dispose: async () => { release(); await page.unrouteAll({ behavior: "wait" }); } };
  };

  const save = await pauseAction();
  try {
    await page.getByRole("button", { name: "Save Result", exact: true }).click();
    await expect(page.getByRole("button", { name: /Save Result|Saving\.\.\./ })).toBeDisabled();
    await expect(indicator).toHaveCount(0);
    save.release();
    await expect(page.getByRole("button", { name: "Next Round", exact: true })).toBeEnabled({ timeout: 15000 });
  } finally { await save.dispose(); }

  const failure = await pauseAction(true);
  try {
    await page.getByRole("button", { name: "Next Round", exact: true }).click();
    await expect(indicator).toBeVisible();
    await expect(indicator.locator(".round-generation-art")).toHaveCSS("opacity", "1");
    const position = await indicator.evaluate(element => {
      const button = element.closest("button")?.getBoundingClientRect();
      const art = element.querySelector(".round-generation-art")?.getBoundingClientRect();
      const label = element.lastElementChild?.getBoundingClientRect();
      if (!button || !art || !label) throw new Error("Expected pending button, ball and label");
      return { labelOffset: Math.abs(label.x + label.width / 2 - button.x - button.width / 2), ballPosition: (art.x + art.width / 2 - button.x) / button.width, gap: label.x - art.right };
    });
    expect(position.labelOffset).toBeLessThanOrEqual(1);
    expect(position.ballPosition).toBeLessThan(0.33);
    expect(position.gap).toBeGreaterThanOrEqual(16);
    await indicator.locator("..").screenshot({ path: testInfo.outputPath("generating-button.png") });
    await expect(indicator.locator("svg")).toHaveCSS("animation-name", "round-generation-shuttle");
    expect(await indicator.locator("svg").evaluate(element => Number.parseFloat(getComputedStyle(element).animationDuration))).toBeGreaterThanOrEqual(1);
    failure.release();
    await expect(page.getByRole("alert").filter({ hasText: "Failed to advance to next round." })).toBeVisible();
    await expect(indicator).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Next Round", exact: true })).toBeEnabled();
  } finally { await failure.dispose(); }

  await page.emulateMedia({ reducedMotion: "reduce" });
  const success = await pauseAction();
  try {
    await page.getByRole("button", { name: "Next Round", exact: true }).click();
    await expect(indicator).toBeVisible();
    await expect(indicator.locator("svg")).toHaveCSS("animation-name", "none");
    success.release();
    await expect(page.getByRole("heading", { name: "Round 2", exact: true })).toBeVisible();
    await expect(indicator).toHaveCount(0);
  } finally { await success.dispose(); }
});

test("session setup court settles once without replaying during attendance or court edits", async ({ page }, testInfo) => {
  test.setTimeout(90000);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    document.addEventListener("animationstart", event => {
      if (event.animationName === "setup-court-ball-settle") {
        document.documentElement.dataset.courtSettles = String(Number(document.documentElement.dataset.courtSettles ?? "0") + 1);
      }
    });
  });
  await createTestGroup(page, `Court illustration ${Date.now()}`);
  await page.getByRole("button", { name: "Add Guest", exact: true }).click();
  for (const name of ["Court Canvas Blake", "Court Canvas Casey", "Court Canvas Drew"]) {
    await page.locator("#guest-player-name").fill(name);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.locator("p[role='status']")).toContainText(`Guest player "${name}" added to the roster.`, { timeout: 10000 });
    await expect(page.locator("#guest-player-name")).toHaveValue("");
  }
  await page.getByRole("link", { name: "Start New Session", exact: true }).click();
  await page.getByTestId("select-normal-session-button").click();
  const court = page.getByTestId("setup-court");
  await expect(court).toBeVisible();
  await expect(court).toHaveAttribute("aria-hidden", "true");
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.courtSettles)).toBe("1");
  await expect(court).toHaveAttribute("data-motion", "still");
  expect(await court.evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0);
  await page.getByRole("button", { name: "Increase courts", exact: true }).click();
  await expect(page.getByLabel("Court count", { exact: true })).toHaveText("2");
  await page.getByRole("button", { name: "Decrease courts", exact: true }).click();
  const player = page.getByRole("checkbox", { name: /Court Canvas Blake/ });
  await player.uncheck();
  await expect(page.getByText("3 players selected", { exact: true })).toBeVisible();
  await player.check();
  await page.getByRole("combobox", { name: "Players on court 1", exact: true }).selectOption("2");
  await page.getByRole("combobox", { name: "Players on court 1", exact: true }).selectOption("4");
  expect(await page.evaluate(() => document.documentElement.dataset.courtSettles)).toBe("1");
  await page.reload();
  await expect(court).toHaveAttribute("data-motion", "still");
  expect(await page.evaluate(() => document.documentElement.dataset.courtSettles)).toBeUndefined();
  const motion = await sampleReplayMotion(court, ".setup-court-ball-hop");
  expect(motion.duration).toBeGreaterThanOrEqual(1000);
  expect(motion.frames[4].x - motion.frames[0].x).toBeGreaterThan(35);
  expect(motion.frames[1].y).toBeLessThan(motion.frames[0].y - 10);
  for (const frame of motion.frames) {
    expect(frame.x).toBeGreaterThanOrEqual(frame.canvas.x);
    expect(frame.right).toBeLessThanOrEqual(frame.canvas.right);
    expect(frame.y).toBeGreaterThanOrEqual(frame.canvas.y);
    expect(frame.bottom).toBeLessThanOrEqual(frame.canvas.bottom);
  }
  await checkAnimationReplay(page, court, "Replay court animation", "courtSettles", { touch: Boolean(testInfo.project.use.hasTouch) });
  await page.screenshot({ path: testInfo.outputPath("setup-court.png"), fullPage: true });
  await page.getByRole("button", { name: "Start Session", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Round 1", exact: true })).toBeVisible();
});

test("session setup court respects reduced motion and allows manual replay with blocked storage", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    document.addEventListener("animationstart", event => {
      if (event.animationName === "setup-court-ball-settle") document.documentElement.dataset.courtSettles = String(Number(document.documentElement.dataset.courtSettles ?? "0") + 1);
    });
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await createTestGroup(page, `Static court ${Date.now()}`);
  await page.getByRole("link", { name: "Start New Session", exact: true }).click();
  await page.getByTestId("select-normal-session-button").click();
  const court = page.getByTestId("setup-court");
  await expect(court).toBeVisible();
  await expect(court).toHaveAttribute("data-motion", "still");
  expect(await court.evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0);
  await checkAnimationReplay(page, court, "Replay court animation", "courtSettles", { reducedMotion: true, touch: Boolean(testInfo.project.use.hasTouch) });
  const audit = await new AxeBuilder({ page }).include("main").analyze();
  expect(audit.violations).toEqual([]);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    Object.defineProperty(window, "sessionStorage", { get() { throw new Error("Storage disabled"); } });
  });
  await page.reload();
  await expect(court).toHaveAttribute("data-motion", "still");
  expect(await court.evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0);
  await checkAnimationReplay(page, court, "Replay court animation", "courtSettles", { touch: Boolean(testInfo.project.use.hasTouch) });
  await expect(page.getByRole("heading", { name: "Available Courts", exact: true })).toBeVisible();
});
