import { test, expect } from "@playwright/test";
import { createAndSignInPlayer, createTestGroup } from "./test-helpers";

test.describe("Open Play Workflow", () => {
  test("host starts open play session, adds guests and players, submits games, and views in profile", async ({
    page,
    browser,
  }) => {
    // 1. Create a test group with host
    const groupName = `Open Play League ${Date.now()}`;
    const { groupId } = await createTestGroup(page, groupName);

    // 2. Add player Bob to the group roster
    const rosterLink = page.locator("a:has-text('Manage Roster')");
    await expect(rosterLink).toBeVisible();
    await rosterLink.click();
    await expect(page).toHaveURL(new RegExp(`/g/${groupId}/players`));

    await page.fill("#player-name-input", "Bob");
    await page.click("button:has-text('Add Player')");
    await expect(page.locator("text=Bob")).toBeVisible();

    // 3. Navigate back to group dashboard
    await page.goto(`/g/${groupId}`);
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

    // 7. Add Guest player "Guest Gary"
    await page.fill("#guest-name-input", "Guest Gary");
    await page.click("button:has-text('+ Guest')");
    await expect(page.locator("[data-testid='open-play-attendees']").getByText("Guest Gary")).toBeVisible();

    // 8. Add group player Bob from roster
    const rosterSelect = page.locator("#roster-player-select");
    await rosterSelect.selectOption({ index: 1 });
    await page.click("button:has-text('+ Add')");
    await expect(page.locator("[data-testid='open-play-attendees']").getByText("Bob")).toBeVisible();

    // 9. Second player signs up and joins open play in another browser context
    const playerContext = await browser.newContext();
    const playerPage = await playerContext.newPage();
    await createAndSignInPlayer(playerPage);

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

    // 10. Submit a game (Doubles: Host & Bob vs Second Player & Guest Gary)
    const submitCard = page.locator("[data-testid='submit-game-card']");
    await expect(submitCard).toBeVisible();

    // Team 1: Host and Bob
    const t1p1 = submitCard.locator("select[aria-label='Team 1 Player 1']");
    const t1p2 = submitCard.locator("select[aria-label='Team 1 Player 2']");
    await t1p1.selectOption({ index: 1 });
    await t1p2.selectOption({ index: 2 });

    // Team 2: Second Player and Guest Gary
    const t2p1 = submitCard.locator("select[aria-label='Team 2 Player 1']");
    const t2p2 = submitCard.locator("select[aria-label='Team 2 Player 2']");
    await t2p1.selectOption({ index: 3 });
    await t2p2.selectOption({ index: 4 });

    // Scores: 11 to 9
    await submitCard.locator("input[aria-label='Team 1 Score']").fill("11");
    await submitCard.locator("input[aria-label='Team 2 Score']").fill("9");

    await submitCard.locator("button[data-testid='submit-game-button']").click();

    // Verify game is recorded in Games Played list
    const matchesList = page.locator("[data-testid='open-play-matches-list']");
    await expect(matchesList).toBeVisible();
    await expect(matchesList).toContainText("11 – 9");

    // 11. Host ends open play session
    const endSessionBtn = page.locator("button[data-testid='end-session-button']");
    page.once("dialog", (dialog) => dialog.accept());
    await endSessionBtn.click();

    await expect(page.locator("text=Completed")).toBeVisible();

    // 12. Check Host's profile sessions info
    await page.goto("/players");
    await expect(page.locator("h2:has-text('Past Sessions')")).toBeVisible();

    // Session must be listed as "Open Play"
    const openPlayListing = page.locator("article h3 a:has-text('Open Play')");
    await expect(openPlayListing).toBeVisible();

    // Link must point to the session URL
    const sessionId = sessionUrl.split("/sessions/")[1];
    await expect(openPlayListing).toHaveAttribute("href", `/g/${groupId}/sessions/${sessionId}`);

    // Must have all the same information as a normal session (group name, rating, W-L)
    const sessionArticle = page.locator(`article[data-testid='player-session-${sessionId}']`);
    await expect(sessionArticle).toContainText(groupName);
    await expect(sessionArticle).toContainText("1W – 0L");
    await expect(sessionArticle).toContainText("Rating");

    await playerContext.close();
  });
});
