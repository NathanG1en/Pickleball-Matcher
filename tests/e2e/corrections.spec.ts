import { test, expect } from "@playwright/test";
import { createTestGroup } from "./test-helpers";

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
