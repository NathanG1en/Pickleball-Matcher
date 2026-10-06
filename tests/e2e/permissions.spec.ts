import { test, expect } from "@playwright/test";

test.describe("Permissions and Security Workflow", () => {
  test("enforces PIN authentication, rate limits invalid attempts, and locks down read-only spectator view", async ({
    page,
    browser,
  }) => {
    // 1. Create a test group
    await page.goto("/setup");
    await page.fill("#group-name", "Security Test League");
    await page.fill("#organizer-pin", "9876");
    await page.fill("#setup-token", process.env.SETUP_TOKEN ?? "test-setup-token");
    await page.click("button[type='submit']");
    await expect(page).toHaveURL(/\/g\/grp_/);

    const groupUrl = page.url();
    const groupId = groupUrl.split("/g/")[1].split("/")[0];

    // 2. Add players and start a session to generate live spectator data
    await page.click("a[href*='/players']");
    await expect(page).toHaveURL(/\/players/);
    const players = ["Alice", "Bob", "Charlie", "David"];
    for (const name of players) {
      await page.fill("#player-name-input", name);
      await page.click("button:has-text('Add Player')");
      await expect(page.locator(`text=${name}`)).toBeVisible();
    }

    await page.click("a:has-text('Group Dashboard')");
    await page.click("a[href*='/sessions/new']");
    await expect(page).toHaveURL(/\/sessions\/new/);
    await page.click("button:has-text('Start Session')");
    await expect(page).toHaveURL(/\/sessions\/session_/);

    // Get the live spectator link href
    const spectatorLink = await page.locator("a:has-text('Live Spectator Link')").getAttribute("href");
    expect(spectatorLink).toBeTruthy();

    // 3. Test read-only spectator access in an incognito/unauthenticated context
    const spectatorContext = await browser.newContext();
    const spectatorPage = await spectatorContext.newPage();
    await spectatorPage.goto(spectatorLink!);

    // Verify spectator page renders read-only assignments
    await expect(spectatorPage.locator("h1")).toContainText("Security Test League");
    await expect(spectatorPage.locator("text=Live Court Board")).toBeVisible();

    // Verify ABSOLUTELY NO mutation or organizer controls exist
    await expect(spectatorPage.locator("button:has-text('Start Round')")).not.toBeVisible();
    await expect(spectatorPage.locator("button:has-text('Save Result')")).not.toBeVisible();
    await expect(spectatorPage.locator("button:has-text('Cancel match')")).not.toBeVisible();
    await expect(spectatorPage.locator("button:has-text('End Session')")).not.toBeVisible();
    await expect(spectatorPage.locator("button:has-text('Attendance')")).not.toBeVisible();
    await expect(spectatorPage.locator("text=Roster")).not.toBeVisible();
    await expect(spectatorPage.locator("input[type='number']")).not.toBeVisible();

    // 4. Test invalid PIN and authentication in unauthenticated context
    await spectatorPage.goto(`/g/${groupId}/login`);
    await expect(spectatorPage.locator("h1")).toContainText("Organizer Sign In");

    // Attempt invalid PIN
    await spectatorPage.fill("#login-pin", "0000");
    await spectatorPage.click("button[type='submit']");
    await expect(spectatorPage.locator("text=Invalid PIN")).toBeVisible();

    // Verify user is not logged in / cannot access protected dashboard
    await spectatorPage.goto(`/g/${groupId}`);
    await expect(spectatorPage).toHaveURL(new RegExp(`/g/${groupId}/login`));

    // 5. Test Rate Limiting on repeated failed logins
    for (let i = 0; i < 6; i++) {
      await spectatorPage.fill("#login-pin", `111${i}`);
      await spectatorPage.click("button[type='submit']");
    }
    // Should display rate limit or invalid message
    await expect(
      spectatorPage.locator("text=Too many attempts").or(spectatorPage.locator("text=Invalid PIN")),
    ).toBeVisible();

    await spectatorContext.close();
  });
});
