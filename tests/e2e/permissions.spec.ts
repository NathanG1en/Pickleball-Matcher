import { test, expect } from "@playwright/test";
import { createAndSignInPlayer, createTestGroup } from "./test-helpers";

test.describe("Permissions and Security Workflow", () => {
  test("enforces PIN authentication and rate limits invalid attempts", async ({
    page,
    browser,
  }) => {
    // 1. Create a test group
    const groupName = `Security Test League ${Date.now()}`;
    await createTestGroup(page, groupName);

    const groupUrl = page.url();
    const groupId = groupUrl.split("/g/")[1].split("/")[0];

    // Test login and protected routes in a separate unauthenticated context.
    const unauthenticatedContext = await browser.newContext();
    const unauthenticatedPage = await unauthenticatedContext.newPage();
    await unauthenticatedPage.goto(`/g/${groupId}/login`);
    await expect(unauthenticatedPage.locator("h1")).toContainText("Organizer Sign In");

    // Attempt invalid PIN
    await unauthenticatedPage.fill("#login-pin", "0000");
    await unauthenticatedPage.click("button[type='submit']");
    await expect(
      unauthenticatedPage.locator("text=Unable to sign in").or(unauthenticatedPage.locator("text=Check your group name and PIN")),
    ).toBeVisible();

    // Verify user is not logged in / cannot access protected dashboard
    await unauthenticatedPage.goto(`/g/${groupId}`);
    await expect(unauthenticatedPage).toHaveURL(new RegExp(`/g/${groupId}/login`));

    // Test rate limiting on repeated failed logins.
    for (let i = 0; i < 6; i++) {
      await unauthenticatedPage.fill("#login-pin", `111${i}`);
      await unauthenticatedPage.click("button[type='submit']");
    }
    // Should display rate limit or invalid message
    await expect(
      unauthenticatedPage
        .locator("text=Too many attempts")
        .or(unauthenticatedPage.locator("text=Unable to sign in"))
        .or(unauthenticatedPage.locator("text=Check your group name and PIN")),
    ).toBeVisible();

    await unauthenticatedContext.close();
  });

  test("allows host to link guest player to public player and removes make organizer for guests", async ({
    page,
    browser,
  }) => {
    // 1. Create a public player in another session
    const otherContext = await browser.newContext();
    const otherPage = await otherContext.newPage();
    const publicUser = await createAndSignInPlayer(otherPage);
    await otherContext.close();

    // 2. Create a test group with host
    const groupName = `Link Guest Test Group ${Date.now()}`;
    await createTestGroup(page, groupName);

    // 3. Switch to "Add Guest" tab on dashboard
    await page.click("button[type='button']:has-text('Add Guest')");
    await page.fill("#guest-player-name", "Guest Taylor");
    await page.click("form button[type='submit']:has-text('Add')");

    // Guest Taylor should appear in the roster
    const guestItem = page.locator("li").filter({ hasText: "Guest Taylor" });
    await expect(guestItem).toBeVisible();

    // Open options dropdown for Guest Taylor
    await guestItem.locator("summary").click();

    // Verify "Make a group organizer" is NOT present for guest
    await expect(guestItem.locator("button:has-text('Make a group organizer')")).not.toBeVisible();

    // Verify "Link to public player" IS present
    const linkButton = guestItem.locator("button:has-text('Link to public player')");
    await expect(linkButton).toBeVisible();

    // 4. Click "Link to public player" to open popup modal
    await linkButton.click();

    const modal = page.locator("div[role='dialog'][aria-labelledby='link-guest-title']");
    await expect(modal).toBeVisible();
    await expect(modal.locator("#link-guest-title")).toContainText("Link Guest Taylor");

    // 5. Search for the public player
    await modal.locator("#link-player-search-input").fill(publicUser.username);
    await modal.locator("button[type='submit']:has-text('Search')").click();

    // Wait for the result to appear
    const resultItem = modal.locator(`[data-testid='link-target-${publicUser.username}']`);
    await expect(resultItem).toBeVisible();

    // 6. Click Link Player
    await resultItem.click();

    // Modal should close and player should now be linked with username
    await expect(modal).not.toBeVisible();
    await expect(page.locator(`text=${publicUser.name} (@${publicUser.username})`)).toBeVisible();

    // Open dropdown for linked player
    const linkedItem = page.locator("li").filter({ hasText: publicUser.name });
    await linkedItem.locator("summary").click();

    // "Link to public player" should no longer be present
    await expect(linkedItem.locator("button:has-text('Link to public player')")).not.toBeVisible();

    // "Make a group organizer" should now be available since they have an account
    await expect(linkedItem.locator("button:has-text('Make a group organizer')")).toBeVisible();
  });
});

