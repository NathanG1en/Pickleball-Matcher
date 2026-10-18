import { test, expect } from "@playwright/test";
import { sampleReplayMotion, checkAnimationReplay, createAndSignInPlayer, createTestGroup } from "./test-helpers";

test.describe("Open Play Workflow", () => {
  test("host starts open play session, adds guests and players, submits games, and views in profile", async ({
    page,
    browser,
  }) => {
    test.setTimeout(90000);
    // 1. Create a test group with host
    const groupName = `Open Play League ${Date.now()}`;
    const { groupId, hostName } = await createTestGroup(page, groupName);

    // 2. Add player Bob to the group roster
    await expect(page.locator("h2:has-text('Roster')")).toBeVisible();
    await expect(page.locator("button:has-text('Find Player')")).toBeVisible();
    const addGuestButton = page.locator("button:has-text('Add Guest')");
    await expect(addGuestButton).toBeVisible();
    await addGuestButton.click();

    await page.fill("#guest-player-name", "Bob");
    await page.locator("button:text-is('Add')").click();
    await expect(page.locator("p[role='status']")).toContainText('Guest player "Bob" added to the roster.', { timeout: 10000 });
    await expect(page.locator("#guest-player-name")).toHaveValue("");

    // 3. Verify group dashboard ready to play
    await expect(page.locator("h2:has-text('Ready to Play?')")).toBeVisible();

    // 4. Verify Start Open Play button is next to Start New Session
    const startNewSessionBtn = page.locator("a[data-testid='start-new-session-button']");
    const startOpenPlayBtn = page.locator("button[data-testid='start-open-play-button']");

    await expect(startNewSessionBtn).toBeVisible();
    await expect(startOpenPlayBtn).toBeVisible();
    await expect(startOpenPlayBtn).toHaveText("Start Open Play");

    // 5. Host clicks Start Open Play
    await startOpenPlayBtn.click();
    await expect(page).toHaveURL(new RegExp(`/g/${groupId}/sessions/session_`));

    // 6. Verify Open Play session page loaded with Host checked in
    await expect(page.locator("h1")).toContainText("Open Play Session");
    await expect(page.locator("[data-testid='open-play-attendees']")).toBeVisible();

    // 7. Add Guest player "Guest Gary" with a selected rating
    await page.fill("#guest-name-input", "Guest Gary");
    await page.selectOption("#guest-rating-select", "4.0");
    await page.locator("form").filter({ has: page.locator("#guest-name-input") }).locator("button[type='submit']").click();
    await expect(page.locator("[data-testid='open-play-attendees']").getByText("Guest Gary")).toBeVisible();

    // 8. Add group player Bob from roster
    const rosterSelect = page.locator("#roster-player-select");
    await rosterSelect.selectOption({ index: 1 });
    await page.locator("form").filter({ has: page.locator("#roster-player-select") }).locator("button[type='submit']").click();
    await expect(page.locator("[data-testid='open-play-attendees']").getByText("Bob")).toBeVisible();

    // 9. Second player signs up and joins open play in another browser context
    const playerContext = await browser.newContext();
    const playerPage = await playerContext.newPage();
    const secondPlayer = await createAndSignInPlayer(playerPage);

    // Second player joins group via invite page
    await playerPage.goto(`/g/${groupId}/join`);
    const joinGroupBtn = playerPage.locator("button:has-text('Join Group Now')");
    await expect(joinGroupBtn).toBeVisible();
    await joinGroupBtn.click();
    await expect(playerPage).toHaveURL(new RegExp(`/g/${groupId}$`));
    await expect(playerPage.locator("h1")).toContainText(groupName);

    // Second player visits session and joins open play
    const sessionUrl = page.url();
    await playerPage.goto(sessionUrl);
    const joinOpenPlayBtn = playerPage.locator("button[data-testid='join-open-play-button']");
    await expect(joinOpenPlayBtn).toBeVisible();
    await joinOpenPlayBtn.click();
    await expect(playerPage.locator("text=You're Checked In")).toBeVisible();

    // Refresh host page to see all 4 players
    await page.reload();
    await expect(page.locator("[data-testid='open-play-attendees'] > div")).toHaveCount(4);

    // Verify attendee chips are ordered alphabetically
    const attendeeNames = await page.locator("[data-testid='open-play-attendees'] span.font-black.text-black").allInnerTexts();
    const sortedAttendeeNames = [...attendeeNames].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    expect(attendeeNames).toEqual(sortedAttendeeNames);

    // 10. Submit a game (Doubles: Host & Bob vs Second Player & Guest Gary)
    const submitCard = page.locator("[data-testid='submit-game-card']");
    await expect(submitCard).toBeVisible();

    // Verify manual autopopulate select card and repeat links are removed
    await expect(page.locator("[data-testid='autopopulate-player-select']")).toHaveCount(0);
    await expect(page.locator("button:has-text('Repeat')")).toHaveCount(0);

    // Team 1: Host and Bob
    const t1p1 = submitCard.locator("[data-testid='select-team-1-player-1']");
    const t1p2 = submitCard.locator("[data-testid='select-team-1-player-2']");

    // Verify logged-in user is already autopopulated as the first player (t1p1)
    await expect(t1p1).toContainText(hostName);

    // Verify player dropdown options are ordered alphabetically
    await t1p1.click();
    const t1p1OptionElements = page.locator("[role='option'] span.truncate");
    const selectableOptions = await t1p1OptionElements.allInnerTexts();
    const sortedSelectableOptions = [...selectableOptions].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    expect(selectableOptions).toEqual(sortedSelectableOptions);
    await page.keyboard.press("Escape");

    // Verify player filter above team selection has been removed
    await expect(page.locator("[data-testid='open-play-player-filter']")).toHaveCount(0);

    // Open Team 1 Player 2 filterable dropdown
    await t1p2.click();

    // Verify player selected in t1p1 cannot be selected in other dropdowns (disabled)
    await expect(page.locator("[role='option']").filter({ hasText: hostName })).toBeDisabled();

    // Verify player filter inside dropdown allows typing in to filter out players
    const dropdownSearchInput = page.locator("[data-testid='filterable-select-search']");
    await expect(dropdownSearchInput).toBeVisible();
    await dropdownSearchInput.fill("Gary");
    // Under filter "Gary", Gary is present in options, but Bob is filtered out
    await expect(page.locator("[role='option']").filter({ hasText: "Guest Gary" })).toHaveCount(1);
    await expect(page.locator("[role='option']").filter({ hasText: "Bob" })).toHaveCount(0);

    // Clear filter: Bob reappears
    await dropdownSearchInput.fill("");
    await expect(page.locator("[role='option']").filter({ hasText: "Bob" })).toHaveCount(1);

    // Select Bob from dropdown
    await page.locator("[role='option']").filter({ hasText: "Bob" }).click();
    await expect(t1p2).toContainText("Bob");

    // Team 2: Second Player and Guest Gary
    const t2p1 = submitCard.locator("[data-testid='select-team-2-player-1']");
    const t2p2 = submitCard.locator("[data-testid='select-team-2-player-2']");

    // Open t2p1: Both players 1 and 2 should be disabled
    await t2p1.click();
    await expect(page.locator("[role='option']").filter({ hasText: hostName })).toBeDisabled();
    await expect(page.locator("[role='option']").filter({ hasText: "Bob" })).toBeDisabled();

    await page.locator("[data-testid='filterable-select-search']").fill(secondPlayer.name);
    await page.locator("[role='option']").filter({ hasText: secondPlayer.name }).click();
    await expect(t2p1).toContainText(secondPlayer.name);

    // Open t2p2 and select Guest Gary
    await t2p2.click();
    await page.locator("[data-testid='filterable-select-search']").fill("Gary");
    await page.locator("[role='option']").filter({ hasText: "Guest Gary" }).click();
    await expect(t2p2).toContainText("Guest Gary");

    // Scores: 11 to 9
    await submitCard.locator("input[aria-label='Team 1 Score']").fill("11");
    await submitCard.locator("input[aria-label='Team 2 Score']").fill("9");

    await submitCard.locator("button[data-testid='submit-game-button']").click();

    // Verify game is recorded in Games Played list
    const matchesList = page.locator("[data-testid='open-play-matches-list']");
    await expect(matchesList).toBeVisible();
    await expect(matchesList).toContainText("11 – 9");

    // 10b. Verify player selects automatically remain autopopulated from the logged in user's last game
    // and logged-in user is still the first player (t1p1)
    await expect(t1p1).toContainText(hostName);
    await expect(t1p2).toContainText("Bob");
    const t2p1Text = await t2p1.innerText();
    const t2p2Text = await t2p2.innerText();
    expect([t2p1Text, t2p2Text].some((t) => t.includes(secondPlayer.name))).toBe(true);
    expect([t2p1Text, t2p2Text].some((t) => t.includes("Guest Gary"))).toBe(true);

    // Submit second game with same teams and same order of players (11 to 8)
    await submitCard.locator("input[aria-label='Team 1 Score']").fill("11");
    await submitCard.locator("input[aria-label='Team 2 Score']").fill("8");
    await submitCard.locator("button[data-testid='submit-game-button']").click();

    // Verify both games are displayed in Games Played list
    await expect(matchesList.locator("article")).toHaveCount(2);
    await expect(matchesList).toContainText("11 – 8");

    // Check group dashboard while Open Play is in progress
    await page.goto(`/g/${groupId}`);
    await expect(page.locator("text=Open Play in Progress")).toBeVisible();
    await expect(page.locator("h3:has-text('Recent Games')")).toBeVisible();
    await expect(page.locator("h3:has-text('Current Matchups')")).toHaveCount(0);
    const recentGamesContainer = page.locator("[data-testid='open-play-recent-games']");
    await expect(recentGamesContainer).toBeVisible();
    await expect(recentGamesContainer).toHaveClass(/max-h-\[136px\]/);
    await expect(recentGamesContainer).toHaveClass(/overflow-y-auto/);
    await expect(recentGamesContainer).toContainText("11 – 9");
    await expect(recentGamesContainer).toContainText("11 – 8");

    // Return to the session
    await page.goto(sessionUrl);

    // Delete the second game
    const deleteBtn = matchesList.locator("button:has-text('Delete')").last();
    await expect(deleteBtn).toBeVisible();
    page.once("dialog", (dialog) => dialog.accept());
    await deleteBtn.click();

    await expect(page.locator("text=Game deleted.")).toBeVisible();

    // Verify game 2 is removed from the screen (only 1 game remains, and 11-8 is gone)
    await expect(matchesList.locator("article")).toHaveCount(1);
    await expect(matchesList).not.toContainText("11 – 8");
    await expect(matchesList).toContainText("11 – 9");

    // Verify group dashboard no longer displays the deleted game and has no cancelled match badges
    await page.goto(`/g/${groupId}`);
    await expect(page.locator("text=Open Play in Progress")).toBeVisible();
    await expect(page.locator("[data-testid='open-play-recent-games']")).toContainText("11 – 9");
    await expect(page.locator("[data-testid='open-play-recent-games']")).not.toContainText("11 – 8");
    await expect(page.locator("text=Cancelled")).toHaveCount(0);

    // Host edits a guest player's name from the group roster three dots menu
    const bobRow = page.locator("li").filter({ hasText: "Bob" });
    const bobMenu = bobRow.locator("summary[aria-label='Options for Bob']");
    await expect(bobMenu).toBeVisible();
    await bobMenu.click();

    // Verify "Edit guest name" is present alongside "Remove player"
    const editGuestBtn = bobRow.locator("button:has-text('Edit guest name')");
    await expect(editGuestBtn).toBeVisible();
    await expect(bobRow.locator("button:has-text('Remove player')")).toBeVisible();

    await editGuestBtn.click();

    // Verify modal is displayed with input prefilled
    const editGuestModal = page.locator("div[role='dialog']:has-text('Edit Guest Name')");
    await expect(editGuestModal).toBeVisible();
    const guestNameInput = editGuestModal.locator("#edit-guest-name-input");
    await expect(guestNameInput).toHaveValue("Bob");

    await guestNameInput.fill("Bobby");
    await editGuestModal.locator("button:has-text('Save Changes')").click();

    await expect(page.locator("p[role='status']")).toContainText('Guest name updated to "Bobby".');
    await expect(page.locator("li").filter({ hasText: "Bobby" })).toBeVisible();

    // Return to session to end it
    await page.goto(sessionUrl);

    // 11. Host ends open play session
    const endSessionBtn = page.locator("button[data-testid='end-session-button']");
    page.once("dialog", (dialog) => dialog.accept());
    await endSessionBtn.click();

    await expect(page.locator("text=Completed")).toBeVisible({ timeout: 15000 });

    // 12. Check Host's profile sessions info and current rating
    await page.goto("/players");
    await expect(page.locator("h2:has-text('Past Sessions')")).toBeVisible();
    await expect(page.locator("text=current rating")).toBeVisible();
    await expect(page.locator("text=starting rating")).toHaveCount(0);

    // Session must be listed with (Open Play) next to group name
    const sessionId = sessionUrl.split("/sessions/")[1];
    const sessionArticle = page.locator(`article[data-testid='player-session-${sessionId}']`);
    await expect(sessionArticle).toBeVisible();
    await expect(sessionArticle).toContainText("Open Play");
    await expect(sessionArticle).toContainText(groupName);
    await expect(sessionArticle).toContainText("1W – 0L");

    // Session date title is plain text (not a link)
    const sessionTitle = sessionArticle.locator("h3");
    await expect(sessionTitle).toBeVisible();
    await expect(sessionArticle.locator("h3 a")).toHaveCount(0);

    // Go to session button must point to the session URL with ?from=profile
    const goToSessionBtn = sessionArticle.locator("a:has-text('Go to session')");
    await expect(goToSessionBtn).toBeVisible();
    await expect(goToSessionBtn).toHaveAttribute("href", `/g/${groupId}/sessions/${sessionId}?from=profile`);

    // Clicking Go to session navigates to session, where back button points to /players
    await goToSessionBtn.click();
    await expect(page).toHaveURL(`/g/${groupId}/sessions/${sessionId}?from=profile`);
    const backBtn = page.locator("a:has-text('Back')");
    await expect(backBtn).toBeVisible();
    await expect(backBtn).toHaveAttribute("href", "/players");
    await backBtn.click();
    await expect(page).toHaveURL("/players");

    await playerContext.close();
  });

  test("organizer and host can add, edit, and delete games after open play session is ended, while regular member cannot", async ({
    page,
    browser,
  }) => {
    test.setTimeout(90000);
    // 1. Create a test group with host
    const groupName = `Ended Open Play League ${Date.now()}`;
    const { groupId } = await createTestGroup(page, groupName);

    // Add player Bob to the group roster
    const addGuestButton = page.locator("button:has-text('Add Guest')");
    await expect(addGuestButton).toBeVisible();
    await addGuestButton.click();
    await page.fill("#guest-player-name", "Bob");
    await page.locator("button:text-is('Add')").click();
    await expect(page.locator("p[role='status']")).toContainText('Guest player "Bob" added to the roster.', { timeout: 10000 });

    // Host starts Open Play
    const startOpenPlayBtn = page.locator("button[data-testid='start-open-play-button']");
    await expect(startOpenPlayBtn).toBeVisible();
    await startOpenPlayBtn.click();
    await expect(page).toHaveURL(new RegExp(`/g/${groupId}/sessions/session_`));
    const sessionUrl = page.url();

    // Add guests to session: Charlie, Dana
    await page.fill("#guest-name-input", "Charlie");
    await page.locator("form").filter({ has: page.locator("#guest-name-input") }).locator("button[type='submit']").click();
    await expect(page.locator("[data-testid='open-play-attendees']").getByText("Charlie")).toBeVisible();

    await page.fill("#guest-name-input", "Dana");
    await page.locator("form").filter({ has: page.locator("#guest-name-input") }).locator("button[type='submit']").click();
    await expect(page.locator("[data-testid='open-play-attendees']").getByText("Dana")).toBeVisible();

    // Add Bob from roster
    const rosterSelect = page.locator("#roster-player-select");
    await rosterSelect.selectOption({ index: 1 });
    await page.locator("form").filter({ has: page.locator("#roster-player-select") }).locator("button[type='submit']").click();
    await expect(page.locator("[data-testid='open-play-attendees']").getByText("Bob")).toBeVisible();

    // Regular player signs up and joins group in second browser context
    const playerContext = await browser.newContext();
    const playerPage = await playerContext.newPage();
    await createAndSignInPlayer(playerPage);
    await playerPage.goto(`/g/${groupId}/join`);
    await playerPage.locator("button:has-text('Join Group Now')").click();
    await expect(playerPage).toHaveURL(new RegExp(`/g/${groupId}$`));

    // Host submits initial game 1 (Host & Bob vs Charlie & Dana: 11 - 5)
    const submitCard = page.locator("[data-testid='submit-game-card']");
    const t1p2 = submitCard.locator("[data-testid='select-team-1-player-2']");
    await t1p2.click();
    await page.locator("[data-testid='filterable-select-search']").fill("Bob");
    await page.locator("[role='option']").filter({ hasText: "Bob" }).click();

    const t2p1 = submitCard.locator("[data-testid='select-team-2-player-1']");
    await t2p1.click();
    await page.locator("[data-testid='filterable-select-search']").fill("Charlie");
    await page.locator("[role='option']").filter({ hasText: "Charlie" }).click();

    const t2p2 = submitCard.locator("[data-testid='select-team-2-player-2']");
    await t2p2.click();
    await page.locator("[data-testid='filterable-select-search']").fill("Dana");
    await page.locator("[role='option']").filter({ hasText: "Dana" }).click();

    await submitCard.locator("input[aria-label='Team 1 Score']").fill("11");
    await submitCard.locator("input[aria-label='Team 2 Score']").fill("5");
    await submitCard.locator("button[data-testid='submit-game-button']").click();

    const matchesList = page.locator("[data-testid='open-play-matches-list']");
    await expect(matchesList).toContainText("11 – 5");

    // Host ends the session
    const endSessionBtn = page.locator("button[data-testid='end-session-button']");
    page.once("dialog", (dialog) => dialog.accept());
    await endSessionBtn.click();
    await expect(page.getByText("Completed", { exact: true })).toBeVisible({ timeout: 15000 });

    // In playerPage (regular member), visit the ended session URL
    await playerPage.goto(sessionUrl);
    await expect(playerPage.getByText("Completed", { exact: true })).toBeVisible();
    // Regular player should NOT see Submit Game card, and should NOT see Edit or Delete buttons
    await expect(playerPage.locator("[data-testid='submit-game-card']")).toHaveCount(0);
    await expect(playerPage.locator("[data-testid^='edit-game-button-']")).toHaveCount(0);
    await expect(playerPage.locator("[data-testid^='delete-game-button-']")).toHaveCount(0);

    // On host page (ended session):
    // 1. Submit game card IS visible for host
    await expect(page.locator("[data-testid='submit-game-card']")).toBeVisible();
    await expect(page.locator("h2:has-text('Add Game')")).toBeVisible();

    // 2. Host adds a second game after session is ended (rematch: 11 - 8)
    const endedSubmitCard = page.locator("[data-testid='submit-game-card']");
    await endedSubmitCard.locator("input[aria-label='Team 1 Score']").fill("11");
    await endedSubmitCard.locator("input[aria-label='Team 2 Score']").fill("8");
    await endedSubmitCard.locator("button[data-testid='submit-game-button']").click();

    await expect(matchesList.locator("article")).toHaveCount(2);
    await expect(matchesList).toContainText("11 – 8");

    // 3. Host edits game 1 (change score from 11 - 5 to 11 - 9)
    const editBtn = matchesList.locator("[data-testid^='edit-game-button-']").first();
    await expect(editBtn).toBeVisible();
    await editBtn.click();

    const editForm = page.locator("[data-testid^='edit-game-form-']");
    await expect(editForm).toBeVisible();
    await editForm.locator("input[aria-label='Edit Team 2 Score']").fill("9");
    await editForm.locator("button[type='submit']").click();

    await expect(page.locator("text=Game updated successfully!")).toBeVisible();
    await expect(matchesList).toContainText("11 – 9");
    await expect(matchesList).not.toContainText("11 – 5");

    // 4. Host deletes game 2
    const deleteBtn = matchesList.locator("[data-testid^='delete-game-button-']").last();
    page.once("dialog", (dialog) => dialog.accept());
    await deleteBtn.click();

    await expect(page.locator("text=Game deleted.")).toBeVisible();
    await expect(matchesList.locator("article")).toHaveCount(1);
    await expect(matchesList).not.toContainText("11 – 8");

    await playerContext.close();
  });

  test("allows organizers and hosts to change session name, while regular members cannot", async ({
    page,
    browser,
  }) => {
    test.setTimeout(90000);
    const groupName = `Session Rename League ${Date.now()}`;
    const { groupId } = await createTestGroup(page, groupName);

    // Host starts open play session
    const startOpenPlayBtn = page.locator("button[data-testid='start-open-play-button']");
    await expect(startOpenPlayBtn).toBeVisible();
    await startOpenPlayBtn.click();
    await expect(page).toHaveURL(new RegExp(`/g/${groupId}/sessions/session_`));

    // Verify initial session name
    await expect(page.locator("h1")).toContainText("Open Play Session");

    // Host renames session using edit pencil
    const editSessionBtn = page.locator("button[aria-label='Edit session name']");
    await expect(editSessionBtn).toBeVisible();
    await editSessionBtn.click();

    const sessionNameInput = page.locator("#session-name-input");
    await expect(sessionNameInput).toBeVisible();
    await sessionNameInput.fill("Friday Night Open Play");
    await page.locator("button:text-is('Save')").click();

    // Verify session heading updated
    await expect(page.locator("h1")).toContainText("Friday Night Open Play");

    // Second player (regular member) visits session in separate browser context
    const playerContext = await browser.newContext();
    const playerPage = await playerContext.newPage();
    await createAndSignInPlayer(playerPage);

    // Join group
    await playerPage.goto(`/g/${groupId}/join`);
    const joinGroupBtn = playerPage.locator("button:has-text('Join Group Now')");
    await expect(joinGroupBtn).toBeVisible();
    await joinGroupBtn.click();
    await expect(playerPage).toHaveURL(new RegExp(`/g/${groupId}$`));

    // Visit session as regular member
    const sessionUrl = page.url();
    await playerPage.goto(sessionUrl);
    await expect(playerPage.locator("h1")).toContainText("Friday Night Open Play");
    // Regular member should NOT see edit session name button
    await expect(playerPage.locator("button[aria-label='Edit session name']")).not.toBeVisible();

    // Host checks group dashboard - active session card displays renamed session
    await page.goto(`/g/${groupId}`);
    await expect(page.locator("h2:has-text('Friday Night Open Play')")).toBeVisible();
    // Host should NOT see edit session name button on main group page
    await expect(page.locator("button[aria-label='Edit session name']")).toHaveCount(0);

    // End session
    await page.goto(sessionUrl);
    page.once("dialog", (dialog) => dialog.accept());
    await page.locator("button[data-testid='end-session-button']").click();
    await expect(page.getByText("Completed", { exact: true })).toBeVisible({ timeout: 15000 });

    // Check completed session view displays the renamed session name
    await expect(page.locator("h1")).toContainText("Friday Night Open Play");

    // Check past sessions list on group dashboard displays renamed session and date
    await page.goto(`/g/${groupId}`);
    const sessionId = sessionUrl.split("/sessions/")[1].split("?")[0];
    const pastSessionItem = page.locator(`[data-testid='past-session-item-${sessionId}']`);
    await expect(pastSessionItem).toContainText("Friday Night Open Play");
    const todayFormatted = new Date().toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    await expect(pastSessionItem).toContainText(todayFormatted);

    // Check player profile displays renamed session with date
    await page.goto("/players");
    const playerSession = page.locator(`article[data-testid='player-session-${sessionId}']`);
    await expect(playerSession).toContainText("Friday Night Open Play");
    await expect(playerSession).toContainText(todayFormatted);

    await playerContext.close();
  });
});

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`session sign-off only rolls after confirmed Open Play completion (${reducedMotion})`, async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion });
    await page.addInitScript(() => {
      document.addEventListener("animationstart", event => {
        if (event.animationName === "session-signoff-roll") document.documentElement.dataset.sessionRolls = String(Number(document.documentElement.dataset.sessionRolls ?? "0") + 1);
      });
    });
    await createTestGroup(page, `Open Play sign-off ${Date.now()}`);
    await page.getByRole("button", { name: "Start Open Play", exact: true }).click();
    await expect(page.getByTestId("end-session-button")).toBeVisible();
    page.once("dialog", dialog => dialog.dismiss());
    await page.getByTestId("end-session-button").click();
    await expect(page.getByTestId("session-signoff")).toHaveCount(0);
    if (reducedMotion === "no-preference") {
      await page.route(page.url(), route => route.request().method() === "POST" && route.request().headers()["next-action"] ? route.abort() : route.continue());
      page.once("dialog", dialog => dialog.accept());
      await page.getByTestId("end-session-button").click();
      await expect(page.getByRole("alert").filter({ hasText: "An unexpected error occurred while ending session." })).toBeVisible();
      await expect(page.getByTestId("session-signoff")).toHaveCount(0);
      await page.unrouteAll({ behavior: "wait" });
    }
    page.once("dialog", dialog => dialog.accept());
    await page.getByTestId("end-session-button").click();
    await expect(page.getByText("Completed", { exact: true })).toBeVisible();
    const art = page.getByTestId("session-signoff");
    await expect(art).toBeInViewport();
    await expect(art).toHaveAttribute("aria-hidden", "true");
    if (reducedMotion === "no-preference") {
      await expect.poll(() => page.evaluate(() => document.documentElement.dataset.sessionRolls)).toBe("1");
    }
    await expect(art).toHaveAttribute("data-motion", "still");
    expect(await page.evaluate(() => document.documentElement.dataset.sessionRolls)).toBe(reducedMotion === "reduce" ? undefined : "1");
    expect(await art.evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0);
    await page.reload();
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
