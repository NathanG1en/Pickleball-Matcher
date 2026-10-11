import { test, expect } from "@playwright/test";
import { createTestGroup } from "./test-helpers";

test.describe("Corrections and Replay Workflow", () => {
  test("handles match score corrections, cancellations, round undo, and attendance changes", async ({
    page,
  }) => {
    // 1. Create a group
    const groupName = `Corrections League ${Date.now()}`;
    await createTestGroup(page, groupName);

    // 2. Add 8 players for 2 courts
    await page.click("a:has-text('Manage Roster')");
    await expect(page).toHaveURL(/\/players/);
    const players = ["Charlie", "Dana", "Eli", "Frank", "Grace", "Henry", "Ivy"];
    for (const name of players) {
      await page.fill("#player-name-input", name);
      await page.click("button:has-text('Add Player')");
      await expect(page.locator(`text=${name}`)).toBeVisible();
    }

    // 3. Start a session with 2 courts and 8 players
    await page.click("a:has-text('Group Dashboard')");
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
    await page.locator("[data-testid='court-match-1'] button:has-text('Update Score')").click();
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
});
