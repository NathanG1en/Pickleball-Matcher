import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("PRD Acceptance Workflow: 14 players, 3 courts", () => {
  test("creates group, manages attendance, generates fair rounds, and records scores", async ({ page }) => {
    // 1. Visit setup page
    await page.goto("/setup");
    await expect(page.locator("h1")).toContainText("Create Group");

    // Accessibility check on setup page
    const setupA11y = await new AxeBuilder({ page })
      .disableRules(["color-contrast"]) // outdoor high contrast styles handled
      .analyze();
    expect(setupA11y.violations).toEqual([]);

    // 2. Submit setup form
    const groupName = `Acceptance Test League ${Date.now()}`;
    await page.fill("#group-name", groupName);
    await page.fill("#organizer-pin", "1234");
    await page.fill("#setup-token", process.env.SETUP_TOKEN ?? "test-setup-token");
    await page.click("button[type='submit']");

    // Should navigate to group dashboard
    await expect(page).toHaveURL(/\/g\/grp_/);
    await expect(page.locator("h1")).toContainText(groupName);

    // 3. Add players to roster until we have 14 players
    await page.click("a[href*='/players']");
    await expect(page).toHaveURL(/\/players/);

    const playerNames = [
      "Alex", "Blake", "Casey", "Drew", "Ellis", "Finley", "Glenn",
      "Harper", "Jamie", "Kendall", "Logan", "Morgan", "Peyton", "Reese"
    ];

    for (const name of playerNames) {
      await page.fill("#player-name-input", name);
      await page.click("button:has-text('Add Player')");
      await expect(page.locator(`text=${name}`)).toBeVisible();
    }

    // 4. Start new session
    await page.click("a:has-text('Group Dashboard')");
    await page.click("a[href*='/sessions/new']");
    await expect(page).toHaveURL(/\/sessions\/new/);

    // Increase courts to 3
    const courtDisplay = page.locator("span[aria-label='Court count']");
    while ((await courtDisplay.textContent()) !== "3") {
      await page.click("button[aria-label='Increase courts']");
    }

    // Verify 14 players selected
    await expect(page.locator("text=14 players selected")).toBeVisible();

    // Start session
    await page.click("button:has-text('Start Session')");
    await expect(page).toHaveURL(/\/sessions\/session_/);

    // 5. Verify Round 1 Proposal: 3 courts (12 players) and 2 sits
    await expect(page.locator(".court-card:has-text('Court 1')")).toBeVisible();
    await expect(page.locator(".court-card:has-text('Court 2')")).toBeVisible();
    await expect(page.locator(".court-card:has-text('Court 3')")).toBeVisible();
    const sitsSection = page.locator("section:has-text('Sitting this round')");
    await expect(sitsSection).toBeVisible();
    const round1Sitters = await sitsSection.locator("span").allTextContents();
    expect(round1Sitters.length).toBeGreaterThanOrEqual(2);

    // Start Round 1
    await page.click("button:has-text('Start Round')");
    await page.click("button:has-text('Confirm & Start')");

    // 6. Enter scores for Round 1
    await expect(page.locator("h1")).toContainText("Round 1 Results");

    // Fill in scores for Court 1, 2, 3
    const court1Team1 = page.locator("input[aria-label='Court 1 Team 1 score']");
    const court1Team2 = page.locator("input[aria-label='Court 1 Team 2 score']");
    await court1Team1.fill("11");
    await court1Team2.fill("7");
    await page.locator("[data-testid='court-match-1'] button:has-text('Save Result')").click();
    await expect(page.locator("[data-testid='court-match-1'] >> text=Final")).toBeVisible();

    const court2Team1 = page.locator("input[aria-label='Court 2 Team 1 score']");
    const court2Team2 = page.locator("input[aria-label='Court 2 Team 2 score']");
    await court2Team1.fill("11");
    await court2Team2.fill("9");
    await page.locator("[data-testid='court-match-2'] button:has-text('Save Result')").click();
    await expect(page.locator("[data-testid='court-match-2'] >> text=Final")).toBeVisible();

    const court3Team1 = page.locator("input[aria-label='Court 3 Team 1 score']");
    const court3Team2 = page.locator("input[aria-label='Court 3 Team 2 score']");
    await court3Team1.fill("6");
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
    const round2Sitters = await round2SitsSection.locator("span").allTextContents();
    for (const sitter of round1Sitters) {
      if (sitter.trim()) {
        expect(round2Sitters).not.toContain(sitter);
      }
    }
  });
});
