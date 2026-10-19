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

    // 11. Add a guest player and verify organizer can edit guest name from three dots
    const addGuestBtn = page.locator("button:has-text('Add Guest')");
    await expect(addGuestBtn).toBeVisible();
    await addGuestBtn.click();
    await page.fill("#guest-player-name", "Guest Sam");
    await page.locator("button:text-is('Add')").click();
    await expect(page.locator("p[role='status']")).toContainText('Guest player "Guest Sam" added to the roster.', { timeout: 10000 });

    const guestItem = page.locator("li").filter({ hasText: "Guest Sam" });
    await expect(guestItem).toBeVisible();

    // Organizer opens three dots for guest
    await guestItem.locator("summary").click();
    const editGuestBtn = guestItem.locator("button:has-text('Edit guest name')");
    await expect(editGuestBtn).toBeVisible();
    await expect(guestItem.locator("button:has-text('Remove player')")).toBeVisible();

    // Click Edit guest name and update
    await editGuestBtn.click();
    const editModal = page.locator("div[role='dialog']:has-text('Edit Guest Name')");
    await expect(editModal).toBeVisible();
    const guestInput = editModal.locator("#edit-guest-name-input");
    await expect(guestInput).toHaveValue("Guest Sam");
    await guestInput.fill("Guest Samantha");
    await editModal.locator("button:has-text('Save Changes')").click();

    await expect(page.locator("p[role='status']")).toContainText('Guest name updated to "Guest Samantha".');
    await expect(page.locator("li").filter({ hasText: "Guest Samantha" })).toBeVisible();

    // 12. Add a second guest player and verify organizer can merge 2+ guests together
    await addGuestBtn.click();
    await page.fill("#guest-player-name", "Guest Samuel");
    await page.locator("button:text-is('Add')").click();
    await expect(page.locator("p[role='status']")).toContainText('Guest player "Guest Samuel" added to the roster.', { timeout: 10000 });

    const samanthaItem = page.locator("li").filter({ hasText: "Guest Samantha" });
    const samuelItem = page.locator("li").filter({ hasText: "Guest Samuel" });
    await expect(samanthaItem).toBeVisible();
    await expect(samuelItem).toBeVisible();

    // Open three dots for Guest Samantha
    await samanthaItem.locator("summary").click();
    const mergeBtn = samanthaItem.locator("button:has-text('Merge with another guest player')");
    await expect(mergeBtn).toBeVisible();
    await expect(samanthaItem.locator("button:has-text('Edit guest name')")).toBeVisible();
    await expect(samanthaItem.locator("button:has-text('Remove player')")).toBeVisible();

    // Click Merge with another guest player
    await mergeBtn.click();
    const mergeModal = page.locator("div[role='dialog']:has-text('Merge Guest Players')");
    await expect(mergeModal).toBeVisible();

    // Name field should be auto-populated with "Guest Samantha"
    const mergedNameInput = mergeModal.locator("[data-testid='merge-guest-name-input']");
    await expect(mergedNameInput).toHaveValue("Guest Samantha");

    // Select second guest (Guest Samuel) to merge together
    const samuelCheckbox = mergeModal.locator("input[type='checkbox']").nth(1);
    await samuelCheckbox.check();

    // Change merged name
    await mergedNameInput.fill("Sam Master");

    // Click Merge Players to open confirmation
    const submitMergeBtn = mergeModal.locator("[data-testid='merge-guest-submit-button']");
    await submitMergeBtn.click();

    // Confirmation appears saying "Are you sure you want to merge these players together: ..."
    const confirmDialog = page.locator("[data-testid='merge-confirm-dialog']");
    await expect(confirmDialog).toBeVisible();
    await expect(page.locator("[data-testid='merge-confirm-message']")).toContainText(
      "Are you sure you want to merge these players together:",
    );
    await expect(page.locator("[data-testid='merge-confirm-message']")).toContainText("Guest Samantha");
    await expect(page.locator("[data-testid='merge-confirm-message']")).toContainText("Guest Samuel");

    // Test clicking "No" cancels confirmation and returns to the modal
    const noBtn = page.locator("[data-testid='merge-confirm-no']");
    await noBtn.click();
    await expect(confirmDialog).not.toBeVisible();
    await expect(submitMergeBtn).toBeVisible();

    // Click Merge Players again, check "Do not ask me again", and click "Yes"
    await submitMergeBtn.click();
    await expect(confirmDialog).toBeVisible();
    const doNotAskCheckbox = page.locator("[data-testid='merge-do-not-ask-again']");
    await expect(doNotAskCheckbox).toBeVisible();
    await doNotAskCheckbox.check();

    const yesBtn = page.locator("[data-testid='merge-confirm-yes']");
    await yesBtn.click();

    // Modal closes and status confirms merge
    await expect(mergeModal).not.toBeVisible();
    await expect(page.locator("p[role='status']")).toContainText('Merged guest players into "Sam Master".');

    // Roster should now contain "Sam Master" and neither "Guest Samantha" nor "Guest Samuel"
    await expect(page.locator("li").filter({ hasText: "Sam Master" })).toBeVisible();
    await expect(page.locator("li").filter({ hasText: "Guest Samantha" })).not.toBeVisible();
    await expect(page.locator("li").filter({ hasText: "Guest Samuel" })).not.toBeVisible();
  });

  test("restricts session deletion to host/organizers and requires confirmation", async ({
    page,
    browser,
  }) => {
    // 1. Create a group as host
    const groupName = `Session Delete Perms ${Date.now()}`;
    const { groupId } = await createTestGroup(page, groupName);

    // 2. Add players and start a session
    const addGuestButton = page.locator("button:has-text('Add Guest')");
    await expect(addGuestButton).toBeVisible();
    await addGuestButton.click();
    for (const name of ["P1", "P2", "P3"]) {
      await page.fill("#guest-player-name", name);
      await page.locator("button:text-is('Add')").click();
      await expect(page.locator("#guest-player-name")).toHaveValue("");
    }

    await page.click("a[href*='/sessions/new']");
    await expect(page).toHaveURL(/\/sessions\/new/);
    await page.click("button:has-text('Start Session')");
    await page.waitForURL(/\/sessions\/session_/);
    const sessionUrl = page.url();

    // Verify host sees the session options menu button
    const optionsButton = page.locator("[data-testid='session-options-menu-button']");
    await expect(optionsButton).toBeVisible();

    // 3. Create a non-organizer player in another browser context and view the session
    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();
    const memberUser = await createAndSignInPlayer(memberPage);

    // Host adds member to group
    await page.goto(`/g/${groupId}`);
    await page.fill("#roster-player-username", memberUser.username);
    await page.click("button:has-text('Find & Add')");
    await expect(page.locator("li").filter({ hasText: memberUser.name })).toBeVisible();

    // Member navigates directly to the session
    await memberPage.goto(sessionUrl);

    // Member should NOT see the session options menu button
    await expect(memberPage.locator("[data-testid='session-options-menu-button']")).not.toBeVisible();
    await memberContext.close();

    // 4. Host deletes the session with confirmation from within the session
    await page.goto(sessionUrl);
    await expect(optionsButton).toBeVisible();
    await optionsButton.click();

    const deleteMenuItem = page.locator("[data-testid='delete-session-menu-item']");
    await expect(deleteMenuItem).toBeVisible();
    await deleteMenuItem.click();

    const confirmModal = page.locator("[role='alertdialog']");
    await expect(confirmModal).toBeVisible();
    await expect(confirmModal).toContainText("Delete Session");

    // Cancel first
    await confirmModal.locator("button:has-text('Cancel')").click();
    await expect(confirmModal).not.toBeVisible();
    expect(page.url()).toBe(sessionUrl);

    // Confirm delete
    await optionsButton.click();
    await expect(deleteMenuItem).toBeVisible();
    await deleteMenuItem.click();
    await expect(confirmModal).toBeVisible();
    await confirmModal.locator("button:has-text('Delete Session')").click();

    // Redirected to group dashboard and session is deleted
    await page.waitForURL(/\/g\/[^/]+$/);
    await expect(page.locator("h2:has-text('Ready to Play?')")).toBeVisible();
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
