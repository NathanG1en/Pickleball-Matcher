import { test, expect } from "@playwright/test";
import { createAndSignInPlayer, createTestGroup } from "./test-helpers";

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
    const t1p1 = submitCard.locator("select[aria-label='Team 1 Player 1']");
    const t1p2 = submitCard.locator("select[aria-label='Team 1 Player 2']");

    // Verify player dropdown options are ordered alphabetically (excluding prompt option)
    const t1p1Options = await t1p1.locator("option").allInnerTexts();
    const selectableOptions = t1p1Options.slice(1);
    const sortedSelectableOptions = [...selectableOptions].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    expect(selectableOptions).toEqual(sortedSelectableOptions);

    // Verify logged-in user is already autopopulated as the first player (t1p1)
    const selectedHostOption = await t1p1.locator("option:checked").innerText();
    expect(selectedHostOption).toContain(hostName);

    // Verify player selected in t1p1 cannot be selected in other dropdowns (disabled)
    await expect(t1p2.locator(`option:has-text('${hostName}')`)).toBeDisabled();

    await t1p2.selectOption({ label: "Bob" });

    // Team 2: Second Player and Guest Gary
    const t2p1 = submitCard.locator("select[aria-label='Team 2 Player 1']");
    const t2p2 = submitCard.locator("select[aria-label='Team 2 Player 2']");

    // Both players 1 and 2 should be disabled in t2p1
    await expect(t2p1.locator(`option:has-text('${hostName}')`)).toBeDisabled();
    await expect(t2p1.locator("option:has-text('Bob')")).toBeDisabled();

    await t2p1.selectOption({ label: secondPlayer.name });
    await t2p2.selectOption({ label: "Guest Gary" });

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
    const t1p1AfterGame = await t1p1.locator("option:checked").innerText();
    expect(t1p1AfterGame).toContain(hostName);
    await expect(t1p2).not.toHaveValue("");
    await expect(t2p1).not.toHaveValue("");
    await expect(t2p2).not.toHaveValue("");

    // Verify players are editable via select dropdown
    const origT2P2 = await t2p2.inputValue();
    expect(origT2P2).toBeTruthy();

    // Submit second game with same teams and same order of players (11 to 8)
    await submitCard.locator("input[aria-label='Team 1 Score']").fill("11");
    await submitCard.locator("input[aria-label='Team 2 Score']").fill("8");
    await submitCard.locator("button[data-testid='submit-game-button']").click();

    // Verify both games are displayed in Games Played list
    await expect(matchesList.locator("article")).toHaveCount(2);
    await expect(matchesList).toContainText("11 – 8");

    // Delete the second game
    const deleteBtn = matchesList.locator("button:has-text('Delete')").last();
    await expect(deleteBtn).toBeVisible();
    page.once("dialog", (dialog) => dialog.accept());
    await deleteBtn.click();

    // Verify game 2 is removed from the screen (only 1 game remains, and 11-8 is gone)
    await expect(matchesList.locator("article")).toHaveCount(1);
    await expect(matchesList).not.toContainText("11 – 8");
    await expect(matchesList).toContainText("11 – 9");

    // 11. Host ends open play session
    const endSessionBtn = page.locator("button[data-testid='end-session-button']");
    page.once("dialog", (dialog) => dialog.accept());
    await endSessionBtn.click();

    await expect(page.locator("text=Completed")).toBeVisible({ timeout: 15000 });

    // 12. Check Host's profile sessions info
    await page.goto("/players");
    await expect(page.locator("h2:has-text('Past Sessions')")).toBeVisible();

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
});
