import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Resilience and Safe Drafts", () => {
  test("retains unsaved draft scores on validation failure, handles stale versions, and passes a11y audits", async ({
    page,
    context,
  }) => {
    // 1. Create group
    await page.goto("/setup");
    const groupName = `Resilience League ${Date.now()}`;
    await page.fill("#group-name", groupName);
    await page.fill("#organizer-pin", "3456");
    await page.fill("#setup-token", process.env.SETUP_TOKEN ?? "test-setup-token");
    await page.click("button[type='submit']");
    await expect(page).toHaveURL(/\/g\/grp_/);

    // 2. Add 4 players
    await page.click("a[href*='/players']");
    await expect(page).toHaveURL(/\/players/);
    const players = ["Harper", "Riley", "Jordan", "Taylor"];
    for (const name of players) {
      await page.fill("#player-name-input", name);
      await page.click("button:has-text('Add Player')");
      await expect(page.locator(`text=${name}`)).toBeVisible();
    }

    // 3. Start a session
    await page.click("a:has-text('Group Dashboard')");
    await page.click("a[href*='/sessions/new']");
    await expect(page).toHaveURL(/\/sessions\/new/);

    // Accessibility check on session setup view
    const sessionSetupA11y = await new AxeBuilder({ page })
      .disableRules(["color-contrast"])
      .analyze();
    expect(sessionSetupA11y.violations).toEqual([]);

    await page.click("button:has-text('Start Session')");
    await expect(page).toHaveURL(/\/sessions\/session_/);
    const sessionUrl = page.url();

    // 4. Start Round 1
    await page.click("button:has-text('Start Round')");
    await page.click("button:has-text('Confirm & Start')");
    await expect(page.locator("h1")).toContainText("Round 1 Results");

    // Accessibility check on active score entry view
    const scoreEntryA11y = await new AxeBuilder({ page })
      .disableRules(["color-contrast"])
      .analyze();
    expect(scoreEntryA11y.violations).toEqual([]);

    // 5. Safe draft score retention on validation failure (tied scores: 11 - 11)
    const t1Input = page.locator("input[aria-label='Court 1 Team 1 score']");
    const t2Input = page.locator("input[aria-label='Court 1 Team 2 score']");

    await t1Input.fill("11");
    await t2Input.fill("11");
    await page.locator("button:has-text('Save Result')").click();

    // Assert validation error is shown
    await expect(page.locator("text=cannot end in a tie")).toBeVisible();

    // Assert inputs were NOT wiped out
    await expect(t1Input).toHaveValue("11");
    await expect(t2Input).toHaveValue("11");

    // Fix the score to valid (11 - 9)
    await t2Input.fill("9");
    await page.locator("button:has-text('Save Result')").click();
    await expect(page.locator("text=Final")).toBeVisible();

    // 6. Stale second tab handling
    const page2 = await context.newPage();
    await page2.goto(sessionUrl);
    await expect(page2.locator("h1")).toContainText("Round 1 Results");

    // Tab 1 advances to Round 2
    await page.click("button:has-text('Next Round')");
    await expect(page.locator("h1")).toContainText("Round 2");

    // Tab 2 (still on Round 1 view) tries to advance or submit
    await page2.click("button:has-text('Next Round')");

    // Tab 2 should either show an error or refresh cleanly to Round 2 without crashing
    await page2.reload();
    await expect(page2.locator("h1")).toContainText("Round 2");

    await page2.close();
  });
});
