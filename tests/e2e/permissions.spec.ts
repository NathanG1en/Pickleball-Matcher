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

  test("allows host to transfer host role to another organizer with group name confirmation", async ({
    page,
    browser,
  }) => {
    // 1. Create a public player in another session to become organizer
    const otherContext = await browser.newContext();
    const otherPage = await otherContext.newPage();
    const coHost = await createAndSignInPlayer(otherPage);
    await otherContext.close();

    // 2. Create a test group with host
    const groupName = `Host Transfer League ${Date.now()}`;
    const hostUser = await createAndSignInPlayer(page);
    await page.waitForSelector("form[data-hydrated='true']");
    await page.fill("#group-name", groupName);
    await page.click("button[type='submit']");
    await expect(page).toHaveURL(/\/g\/grp_/);

    // 3. Find and add coHost to the group roster
    await page.fill("#roster-player-username", coHost.username);
    await page.click("button:has-text('Find & Add')");
    const coHostItem = page.locator("li").filter({ hasText: coHost.name });
    await expect(coHostItem).toBeVisible();

    // 4. Open dropdown for coHost and make them an organizer
    await coHostItem.locator("summary").click();
    // Before becoming an organizer, "Transfer host" should NOT be visible
    await expect(coHostItem.locator("button:has-text('Transfer host')")).not.toBeVisible();
    await coHostItem.locator("button:has-text('Make a group organizer')").click();
    await expect(coHostItem.getByText("Organizer", { exact: true })).toBeVisible();

    // 5. Open dropdown again: "Transfer host" should now be present in the same menu as "Remove player"
    await coHostItem.locator("summary").click();
    const transferButton = coHostItem.locator("button:has-text('Transfer host')");
    await expect(transferButton).toBeVisible();
    await expect(coHostItem.locator("button:has-text('Remove player')")).toBeVisible();

    // 6. Click "Transfer host"
    await transferButton.click();

    // 7. A confirmation popup modal should appear requiring group name
    const modal = page.locator("div[role='alertdialog']");
    await expect(modal).toBeVisible();
    await expect(modal.locator("h2")).toContainText("Transfer Host");
    const confirmButton = modal.locator("button[type='submit']:has-text('Transfer Host')");

    // Initially disabled
    await expect(confirmButton).toBeDisabled();

    // Fill incorrect group name: stays disabled
    const input = modal.locator("#confirm-group-name");
    await input.fill("Wrong Group Name");
    await expect(confirmButton).toBeDisabled();

    // Fill exact group name: becomes enabled
    await input.fill(groupName);
    await expect(confirmButton).toBeEnabled();

    // 8. Confirm transfer
    await confirmButton.click();

    // Modal should close
    await expect(modal).not.toBeVisible();

    // 9. CoHost now has the Host badge!
    await expect(coHostItem.getByText("Host", { exact: true })).toBeVisible();

    // 10. Original host now has Organizer badge and lost host privileges
    const originalHostItem = page.locator("li").filter({ hasText: hostUser.name });
    await expect(originalHostItem.getByText("Organizer", { exact: true })).toBeVisible();
    await expect(originalHostItem.getByText("Host", { exact: true })).not.toBeVisible();

    // Original host no longer has "Transfer host" in dropdown
    await coHostItem.locator("summary").click();
    await expect(coHostItem.locator("button:has-text('Transfer host')")).not.toBeVisible();
  });
});

test("rejects invalid custom signup ratings without creating an account", async ({ page }) => {
  await page.goto("/player-signup?next=%2Fsetup");
  await page.waitForSelector("form[data-hydrated='true']");
  await page.getByLabel("Username", { exact: true }).fill(`rating_${Date.now()}`);
  await page.getByLabel("Display name", { exact: true }).fill("Custom Rating Tester");
  await page.getByLabel("Password", { exact: true }).fill("ValidPassword123!");
  await page.getByRole("checkbox", { name: /Enter custom rating/ }).check();
  const rating = page.getByRole("spinbutton", { name: "Custom rating (2.0 – 8.0)" });
  for (const invalid of ["9", "1.9", ""]) {
    await rating.fill(invalid);
    await page.getByRole("button", { name: "Sign Up", exact: true }).click();
    await expect(page.getByText("Enter a rating between 2.0 and 8.0.", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/player-signup/);
    await expect(rating).toHaveValue(invalid);
  }
  await rating.fill("3.75");
  await page.getByRole("button", { name: "Sign Up", exact: true }).click();
  await expect(page).toHaveURL(/\/setup/);
  await page.goto("/players");
  await expect(page.getByText(/current rating 3.75/)).toBeVisible();
});
