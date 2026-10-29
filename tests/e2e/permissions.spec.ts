import { test, expect } from "@playwright/test";
import { createAndSignInPlayer, createTestGroup } from "./test-helpers";

test.describe("Permissions and Security Workflow", () => {
  test("organizers can rename guests but cannot inject a starting-rating correction", async ({ page }) => {
    const { groupId } = await createTestGroup(page, `Maintenance boundary ${Date.now()}`);
    await page.getByRole("button", { name: "Add Guest", exact: true }).click();
    await page.locator("#guest-player-name").fill("Maintenance Guest");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    const guest = page.locator("li").filter({ hasText: "Maintenance Guest" });
    await expect(guest).toBeVisible();
    await expect(guest).toContainText("3.5");
    await guest.locator("summary").click();
    await guest.getByRole("button", { name: "Edit guest", exact: true }).click();
    const modal = page.getByRole("dialog", { name: "Edit Guest" });
    await modal.locator("#edit-guest-name-input").fill("Should not save");
    let injected = false;
    await page.route("**/g/**", async route => {
      const request = route.request();
      if (request.method() === "POST" && request.headers()["next-action"]) {
        const data = JSON.parse(request.postData() ?? "[]");
        if (data[0]?.name === "Should not save" && data[0]?.groupId === groupId) {
          data[0].initialRating = 4;
          injected = true;
          await route.continue({ postData: JSON.stringify(data) });
          return;
        }
      }
      await route.continue();
    });
    await modal.getByRole("button", { name: "Save Changes", exact: true }).click();
    await expect(modal).toContainText("Invalid player update data");
    expect(injected).toBe(true);
    await expect(guest).toContainText("3.5");
    await page.unroute("**/g/**");
    await modal.locator("#edit-guest-name-input").fill("Maintained Guest");
    await modal.getByRole("button", { name: "Save Changes", exact: true }).click();
    await expect(modal).toHaveCount(0);
    await page.reload();
    const renamed = page.locator("li").filter({ hasText: "Maintained Guest" });
    await expect(renamed).toContainText("3.5");
    await expect(page.getByText("Should not save", { exact: true })).toHaveCount(0);
  });

  test.beforeEach(() => {
    test.setTimeout(90000);
  });

  test("protects private groups and organizer pages from unauthenticated access", async ({
    page,
    browser,
  }) => {
    // 1. Create a test group
    const groupName = `Security Test League ${Date.now()}`;
    const { groupId } = await createTestGroup(page, groupName);

    // Test protected routes in a separate unauthenticated context.
    const unauthenticatedContext = await browser.newContext();
    const unauthenticatedPage = await unauthenticatedContext.newPage();

    // Verify unauthenticated user cannot access private group dashboard and is redirected to player login
    await unauthenticatedPage.goto(`/g/${groupId}`);
    await expect(unauthenticatedPage).toHaveURL(new RegExp(`/player-login`));

    // Verify unauthenticated user cannot access session creation and is redirected to player login
    await unauthenticatedPage.goto(`/g/${groupId}/sessions/new`);
    await expect(unauthenticatedPage).toHaveURL(new RegExp(`/player-login`));

    // Verify homepage does not render legacy organizer PIN sign in
    await unauthenticatedPage.goto("/");
    await expect(unauthenticatedPage.locator("text=Legacy organizer PIN sign in")).not.toBeVisible();

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
    await page.locator("[data-testid='rating-tick-2']").click();
    await page.click("form button[type='submit']:has-text('Add')");

    // Guest Taylor should appear in the roster
    const guestItem = page.locator("li").filter({ hasText: "Guest Taylor" });
    await expect(guestItem).toBeVisible();
    await expect(guestItem).toContainText("Rating: 2 (");

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
    await expect(page.locator("li").filter({ hasText: publicUser.name }).getByRole("link", { name: `@${publicUser.username}` })).toBeVisible();

    // Open dropdown for linked player
    const linkedItem = page.locator("li").filter({ hasText: publicUser.name });
    await expect(linkedItem).toContainText("3.5");
    await page.reload();
    await expect(linkedItem).toContainText("3.5");
    await linkedItem.locator("summary").click();

    // "View profile" should now be present in the dropdown for organizer/host
    const viewProfileLink = linkedItem.locator("a:has-text('View profile')");
    await expect(viewProfileLink).toBeVisible();
    await expect(viewProfileLink).toHaveClass(/hover:bg-\[#ccff00\]/);
    await expect(viewProfileLink).toHaveClass(/text-black/);

    // "Link to public player" should no longer be present
    await expect(linkedItem.locator("button:has-text('Link to public player')")).not.toBeVisible();

    // "Make a group organizer" should now be available since they have an account
    await expect(linkedItem.locator("button:has-text('Make a group organizer')")).toBeVisible();
  });

  test("allows host to link guest player to an account already in the roster by merging", async ({
    page,
    browser,
  }) => {
    // 1. Create a public player in another session
    const otherContext = await browser.newContext();
    const otherPage = await otherContext.newPage();
    const publicUser = await createAndSignInPlayer(otherPage);
    await otherContext.close();

    // 2. Create a test group with host
    const groupName = `Merge Guest Test Group ${Date.now()}`;
    await createTestGroup(page, groupName);

    // 3. Add publicUser to the roster
    await page.fill("#roster-player-username", publicUser.username);
    await page.click("button:text-is('Add')");
    const publicUserItem = page.locator("li").filter({ hasText: publicUser.name });
    await expect(publicUserItem).toBeVisible();

    // 4. Add a guest player to the roster
    await page.click("button[type='button']:has-text('Add Guest')");
    await page.fill("#guest-player-name", "Guest Jordan");
    await page.click("form button[type='submit']:has-text('Add')");

    const guestItem = page.locator("li").filter({ hasText: "Guest Jordan" });
    await expect(guestItem).toBeVisible();

    // 5. Open options dropdown for Guest Jordan and click "Link to public player"
    await guestItem.locator("summary").click();
    const linkButton = guestItem.locator("button:has-text('Link to public player')");
    await expect(linkButton).toBeVisible();
    await linkButton.click();

    // 6. Verify modal appears and search for publicUser
    const modal = page.locator("div[role='dialog'][aria-labelledby='link-guest-title']");
    await expect(modal).toBeVisible();
    await expect(modal.locator("#link-guest-title")).toContainText("Link Guest Jordan");

    await modal.locator("#link-player-search-input").fill(publicUser.username);
    await modal.locator("button[type='submit']:has-text('Search')").click();

    // 7. Verify "In Roster" label appears and "Merge" button is placed next to it
    await expect(modal.getByText("In Roster")).toBeVisible();
    const mergeButton = modal.locator(`[data-testid='link-target-${publicUser.username}']`);
    await expect(mergeButton).toBeVisible();
    await expect(mergeButton).toHaveText("Merge");

    // 8. Click "Merge"
    await mergeButton.click();

    // 9. Modal should close, guest should be removed from roster, and publicUser remains
    await expect(modal).not.toBeVisible({ timeout: 15000 });
    await expect(page.locator("li").filter({ hasText: "Guest Jordan" })).not.toBeVisible();
    await expect(page.locator("li").filter({ hasText: publicUser.name })).toBeVisible();
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
    await page.click("button:text-is('Add')");
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
    const editGuestBtn = guestItem.locator("button:has-text('Edit guest')");
    await expect(editGuestBtn).toBeVisible();
    await expect(guestItem.locator("button:has-text('Remove player')")).toBeVisible();

    // Click Edit guest and update
    await editGuestBtn.click();
    const editModal = page.locator("div[role='dialog']:has-text('Edit Guest')");
    await expect(editModal).toBeVisible();
    const guestInput = editModal.locator("#edit-guest-name-input");
    await expect(guestInput).toHaveValue("Guest Sam");
    await guestInput.fill("Guest Samantha");
    await editModal.locator("button:has-text('Save Changes')").click();

    await expect(page.locator("p[role='status']")).toContainText('Guest "Guest Samantha" updated');
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
    await expect(samanthaItem.locator("button:has-text('Edit guest')")).toBeVisible();
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
    await expect(mergeModal).not.toBeVisible({ timeout: 15000 });
    await expect(page.locator("p[role='status']")).toContainText('Merged guest players into "Sam Master".');

    // Roster should now contain "Sam Master" and neither "Guest Samantha" nor "Guest Samuel"
    await expect(page.locator("li").filter({ hasText: "Sam Master" })).toBeVisible();
    await expect(page.locator("li").filter({ hasText: "Guest Samantha" })).not.toBeVisible();
    await expect(page.locator("li").filter({ hasText: "Guest Samuel" })).not.toBeVisible();

    // 13. Verify confirmation dialog before removing a guest player
    const samMasterItem = page.locator("li").filter({ hasText: "Sam Master" });
    await samMasterItem.locator("summary").click();
    const removeGuestBtn = samMasterItem.locator("button:has-text('Remove player')");
    await expect(removeGuestBtn).toBeVisible();
    await removeGuestBtn.click();

    // Confirmation dialog appears with the required message
    const removeGuestModal = page.locator("div[role='alertdialog']");
    await expect(removeGuestModal).toBeVisible();
    await expect(removeGuestModal).toContainText('Are you sure you want to remove "Sam Master"? They have played 0 games.');

    // Cancelling leaves the guest player on the roster
    await removeGuestModal.locator("button:has-text('Cancel')").click();
    await expect(removeGuestModal).not.toBeVisible();
    await expect(page.locator("li").filter({ hasText: "Sam Master" })).toBeVisible();

    // Confirming removes the guest player from the roster
    await samMasterItem.locator("summary").click();
    await removeGuestBtn.click();
    await expect(removeGuestModal).toBeVisible();
    await removeGuestModal.locator("[data-testid='confirm-remove-guest-button']").click();

    await expect(removeGuestModal).not.toBeVisible();
    await expect(page.locator("p[role='status']")).toContainText("Player removed from the group.");
    await expect(page.locator("li").filter({ hasText: "Sam Master" })).not.toBeVisible();
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
    await page.click("button[data-testid='select-normal-session-button']");
    await page.click("button[data-testid='continue-to-pairings-button']");
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
    await page.click("button:text-is('Add')");
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

  test("allows players to view public profiles fully and restricts private profiles to display name and username", async ({
    page,
    browser,
  }) => {
    // 1. Create a public player and a private player in separate browser contexts
    const publicContext = await browser.newContext();
    const publicPage = await publicContext.newPage();
    const publicUser = await createAndSignInPlayer(publicPage, {
      name: "Public Champion",
    });

    const privateContext = await browser.newContext();
    const privatePage = await privateContext.newPage();
    const privateUser = await createAndSignInPlayer(privatePage, {
      name: "Private Legend",
    });

    // Make privateUser private via their profile page
    await privatePage.goto("/players");
    const privacyBtn = privatePage.getByRole("button", { name: /Account visibility: currently Public/ });
    await expect(privacyBtn).toBeVisible();
    await privacyBtn.click();
    await expect(privatePage.getByText("Profile is now Private")).toBeVisible();

    // 2. In the host page, create a test group with unique name
    const groupName = `Profile Visibility Group ${Date.now()}`;
    const { groupId } = await createTestGroup(page, groupName);

    // 3. Add publicUser and privateUser to the roster
    await page.fill("#roster-player-username", publicUser.username);
    await page.click("button:text-is('Add')");
    await expect(page.locator("li").filter({ hasText: publicUser.name })).toBeVisible({ timeout: 15000 });

    await page.fill("#roster-player-username", privateUser.username);
    await page.click("button:text-is('Add')");
    await expect(page.locator("li").filter({ hasText: privateUser.name })).toBeVisible({ timeout: 15000 });

    // 4. In the roster, both should have an underlined link for their username in (@username)
    await expect(page.locator(`text=${publicUser.name} (@${publicUser.username})`)).toBeVisible();
    await expect(page.locator(`text=${privateUser.name} (@${privateUser.username})`)).toBeVisible();

    const publicLink = page.locator("li").filter({ hasText: publicUser.name }).getByRole("link", { name: `@${publicUser.username}` });
    await expect(publicLink).toBeVisible();

    // Verify organizer sees "View profile" in three dots dropdown
    const publicItem = page.locator("li").filter({ hasText: publicUser.name });
    await publicItem.locator("summary").click();
    const publicViewProfileLink = publicItem.locator("a:has-text('View profile')");
    await expect(publicViewProfileLink).toBeVisible();
    await expect(publicViewProfileLink).toHaveClass(/hover:bg-\[#ccff00\]/);
    await expect(publicViewProfileLink).toHaveClass(/text-black/);
    await publicItem.locator("summary").click(); // close

    // 5. Click public user link -> leads to /players/[username] and shows full profile
    await publicLink.click();
    await page.waitForURL(new RegExp(`/players/${publicUser.username}`));
    await expect(page.locator("h1")).toContainText(publicUser.name);
    await expect(page.getByText(`@${publicUser.username}`, { exact: true })).toBeVisible();
    await expect(page.getByText("Public", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Rating over time" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Past Sessions" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Go to session" })).not.toBeVisible();
    await expect(page.getByText("This Profile is Private")).not.toBeVisible();

    // Navigate back to the group page
    await page.goBack();
    await page.waitForURL(new RegExp(`/g/${groupId}`));

    // 6. Click private user link -> leads to /players/[username] and only shows display name and username
    const privateLink = page.locator("li").filter({ hasText: privateUser.name }).getByRole("link", { name: `@${privateUser.username}` });
    await expect(privateLink).toBeVisible();
    await privateLink.click();
    await page.waitForURL(new RegExp(`/players/${privateUser.username}`));
    await expect(page.locator("h1")).toContainText(privateUser.name);
    await expect(page.getByText(`@${privateUser.username}`, { exact: true })).toBeVisible();
    await expect(page.getByText("This Profile is Private")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Rating over time" })).not.toBeVisible();
    await expect(page.getByRole("heading", { name: "Past Sessions" })).not.toBeVisible();

    // 7. For a non-organizer viewing the roster, verify there is a "View profile" button on the right side
    await publicPage.goto(`/g/${groupId}`);
    const nonOrgRow = publicPage.locator("li").filter({ hasText: privateUser.name });
    await expect(nonOrgRow.locator("summary")).not.toBeVisible();
    const viewProfileBtn = nonOrgRow.getByRole("link", { name: "View profile" });
    await expect(viewProfileBtn).toBeVisible();

    await publicContext.close();
    await privateContext.close();
  });

  test("rejects invalid custom signup ratings without creating an account", async ({ page }) => {
  test.setTimeout(60000);
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
  await expect(page).toHaveURL(/\/setup/, { timeout: 15000 });
  await page.goto("/players");
  await expect(page.getByText(/current rating 3.75/)).toBeVisible();
});

test("does not include groups in recent groups if player is not part of them even after looking at them", async ({
  page,
  browser,
}) => {
  const groupName = `Public Recent Test ${Date.now()}`;
  const { groupId } = await createTestGroup(page, groupName);

  // Group starts as Private in toggle with info tooltip
  const privateToggleBtn = page.getByRole("button", { name: "Private", exact: true });
  const publicToggleBtn = page.getByRole("button", { name: "Public", exact: true });
  await expect(privateToggleBtn).toHaveAttribute("aria-pressed", "true");
  await expect(publicToggleBtn).toHaveAttribute("aria-pressed", "false");

  const infoBtn = page.getByTestId("group-visibility-info-button");
  await expect(infoBtn).toBeVisible();

  // Focus to display tooltip
  await infoBtn.focus();
  const tooltip = page.getByTestId("group-visibility-tooltip");
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText("Players can find and join this group");
  await expect(tooltip).toContainText("This group is private and hidden from search");

  // Blur hides tooltip
  await infoBtn.blur();
  await expect(tooltip).toBeHidden();

  // Toggle to Public
  await publicToggleBtn.click();
  await expect(publicToggleBtn).toHaveAttribute("aria-pressed", "true");
  await expect(privateToggleBtn).toHaveAttribute("aria-pressed", "false");

  const playerContext = await browser.newContext();
  const playerPage = await playerContext.newPage();
  await createAndSignInPlayer(playerPage);

  // Visitor looks at the public group without joining
  await playerPage.goto(`/g/${groupId}`);
  await expect(playerPage.locator("h1")).toContainText(groupName);
  await expect(playerPage.getByRole("button", { name: "Join Group Now" })).toBeVisible();

  // Go to homepage: group must NOT be in recent groups
  await playerPage.goto("/");
  await expect(playerPage.getByRole("heading", { name: /FAIR ROUNDS/ })).toBeVisible();
  await expect(playerPage.getByText(groupName)).not.toBeVisible();
  await expect(playerPage.getByText(/Your Recent Groups/)).not.toBeVisible();

  // Now join the group
  await playerPage.goto(`/g/${groupId}`);
  await playerPage.getByRole("button", { name: "Join Group Now" }).click();
  await expect(playerPage.getByRole("button", { name: "Group options" })).toBeVisible();

  // Return to homepage: group MUST now appear in recent groups
  await playerPage.goto("/");
  await expect(playerPage.getByText(/Your Recent Groups/)).toBeVisible();
  await expect(playerPage.getByText(groupName)).toBeVisible();

  await playerContext.close();
});

test("non-host member can leave a group from group dashboard via three dots menu with confirmation", async ({
  page,
  browser,
}) => {
  const groupName = `Leave From Group Dashboard ${Date.now()}`;
  const { groupId } = await createTestGroup(page, groupName);

  const publicToggleBtn = page.getByRole("button", { name: "Public", exact: true });
  await publicToggleBtn.click();
  await expect(publicToggleBtn).toHaveAttribute("aria-pressed", "true");

  const playerContext = await browser.newContext();
  const playerPage = await playerContext.newPage();
  await createAndSignInPlayer(playerPage);

  // Non-host joins the group
  await playerPage.goto(`/g/${groupId}`);
  await playerPage.getByRole("button", { name: "Join Group Now" }).click();
  await expect(playerPage.getByRole("button", { name: "Join Group Now" })).not.toBeVisible();

  // The 3 dots button is present for group member
  const optionsBtn = playerPage.getByRole("button", { name: "Group options" });
  await expect(optionsBtn).toBeVisible();
  await optionsBtn.click();

  // Only "Leave Group" is in the dropdown (no "Delete Group")
  const leaveMenuItem = playerPage.getByTestId("leave-group-menu-item");
  await expect(leaveMenuItem).toBeVisible();
  await expect(playerPage.getByTestId("delete-group-menu-item")).not.toBeVisible();

  // Clicking Leave Group opens confirmation modal
  await leaveMenuItem.click();
  await expect(playerPage.getByRole("alertdialog")).toBeVisible();
  await expect(playerPage.getByText(`Are you sure you want to leave "${groupName}"?`)).toBeVisible();

  // Cancel closes the dialog without leaving
  await playerPage.getByRole("button", { name: "Cancel" }).click();
  await expect(playerPage.getByRole("alertdialog")).not.toBeVisible();
  await expect(optionsBtn).toBeVisible();

  // Open again and confirm leaving
  await optionsBtn.click();
  await playerPage.getByTestId("leave-group-menu-item").click();
  await expect(playerPage.getByRole("alertdialog")).toBeVisible();
  await playerPage.getByTestId("confirm-leave-group-button").click();

  // User is redirected to /players and group is not in their groups
  await expect(playerPage).toHaveURL(/\/players/);
  await expect(playerPage.getByText(groupName)).not.toBeVisible();

  // Returning to public group dashboard shows visitor join card and NO 3 dots button
  await playerPage.goto(`/g/${groupId}`);
  await expect(playerPage.getByRole("button", { name: "Join Group Now" })).toBeVisible();
  await expect(playerPage.getByRole("button", { name: "Group options" })).not.toBeVisible();

  await playerContext.close();
});

test("non-host member can leave a group from find groups page with confirmation modal", async ({
  page,
  browser,
}) => {
  const groupName = `Leave From Find Groups ${Date.now()}`;
  const { groupId } = await createTestGroup(page, groupName);

  const publicToggleBtn = page.getByRole("button", { name: "Public", exact: true });
  await publicToggleBtn.click();
  await expect(publicToggleBtn).toHaveAttribute("aria-pressed", "true");

  const playerContext = await browser.newContext();
  const playerPage = await playerContext.newPage();
  await createAndSignInPlayer(playerPage);

  // Join the group first
  await playerPage.goto(`/g/${groupId}`);
  await playerPage.getByRole("button", { name: "Join Group Now" }).click();
  await expect(playerPage.getByRole("button", { name: "Group options" })).toBeVisible();

  // Navigate to Find Groups page
  await playerPage.goto(`/players/groups?q=${encodeURIComponent(groupName)}`);
  await expect(playerPage.getByRole("heading", { name: "Find a group" })).toBeVisible();

  await playerPage.fill("input[placeholder*='Search by group name']", groupName);
  await playerPage.click("button:has-text('Search')");

  // Find the group card
  const groupArticle = playerPage.locator("article", { hasText: groupName });
  await expect(groupArticle).toBeVisible({ timeout: 10000 });
  // Member badge should be visible next to group name
  await expect(groupArticle.getByText("Member")).toBeVisible();

  // Leave button should be where joined was
  const leaveBtn = groupArticle.getByRole("button", { name: "Leave", exact: true });
  await expect(leaveBtn).toBeVisible();

  // Clicking "Leave" opens confirmation modal (same as in group options menu)
  await leaveBtn.click();
  await expect(playerPage.getByRole("alertdialog")).toBeVisible();
  await expect(playerPage.getByText(`Are you sure you want to leave "${groupName}"?`)).toBeVisible();

  // Cancel closes the dialog without leaving
  await playerPage.getByRole("button", { name: "Cancel" }).click();
  await expect(playerPage.getByRole("alertdialog")).not.toBeVisible();
  await expect(leaveBtn).toBeVisible();

  // Click again and confirm leaving
  await leaveBtn.click();
  await expect(playerPage.getByRole("alertdialog")).toBeVisible();
  await playerPage.getByTestId("confirm-leave-group-button").click();

  // After leaving and refreshing, it now shows "Join" instead of "Member" / "Leave"
  await expect(groupArticle.getByRole("button", { name: "Join" })).toBeVisible();
  await expect(groupArticle.getByText("Member")).not.toBeVisible();
  await expect(groupArticle.getByRole("button", { name: "Leave", exact: true })).not.toBeVisible();

  // Verify host sees Host badge and no leave button on find groups page
  await page.goto(`/players/groups?q=${encodeURIComponent(groupName)}`);
  const hostGroupArticle = page.locator("article", { hasText: groupName });
  await expect(hostGroupArticle.getByText("Host")).toBeVisible({ timeout: 10000 });
  await expect(hostGroupArticle.getByRole("button", { name: "Leave", exact: true })).not.toBeVisible();

  await playerContext.close();
});

test("non-host member can leave a group from profile page with confirmation modal", async ({
  page,
  browser,
}) => {
  const groupName = `Leave From Profile ${Date.now()}`;
  const { groupId } = await createTestGroup(page, groupName);

  const publicToggleBtn = page.getByRole("button", { name: "Public", exact: true });
  await publicToggleBtn.click();
  await expect(publicToggleBtn).toHaveAttribute("aria-pressed", "true");

  const playerContext = await browser.newContext();
  const playerPage = await playerContext.newPage();
  await createAndSignInPlayer(playerPage);

  // Join the group first
  await playerPage.goto(`/g/${groupId}`);
  await playerPage.getByRole("button", { name: "Join Group Now" }).click();
  await expect(playerPage.getByRole("button", { name: "Group options" })).toBeVisible();

  // Navigate to Profile page
  await playerPage.goto("/players");
  await expect(playerPage.getByRole("heading", { name: "My Groups" })).toBeVisible();

  const groupRow = playerPage.locator("li", { hasText: groupName });
  await expect(groupRow).toBeVisible();

  // Leave button is present
  const leaveBtn = groupRow.getByRole("button", { name: "Leave", exact: true });
  await expect(leaveBtn).toBeVisible();

  // Clicking "Leave" opens confirmation modal
  await leaveBtn.click();
  await expect(playerPage.getByRole("alertdialog")).toBeVisible();
  await expect(playerPage.getByText(`Are you sure you want to leave "${groupName}"?`)).toBeVisible();

  // Cancel closes the dialog without leaving
  await playerPage.getByRole("button", { name: "Cancel" }).click();
  await expect(playerPage.getByRole("alertdialog")).not.toBeVisible();
  await expect(leaveBtn).toBeVisible();

  // Click again and confirm leaving
  await leaveBtn.click();
  await expect(playerPage.getByRole("alertdialog")).toBeVisible();
  await playerPage.getByTestId("confirm-leave-group-button").click();

  // Dialog closes and group is removed from My Groups
  await expect(playerPage.getByRole("alertdialog")).not.toBeVisible();
  await expect(playerPage.getByText(groupName)).not.toBeVisible();

  await playerContext.close();
});

test("find players workflow from homepage shows public and private players with limited private profiles", async ({
  page,
  browser,
}) => {
  // 1. Create and sign in User A (public)
  const userA = await createAndSignInPlayer(page);

  // 2. In a separate context, create User B and switch to private
  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();
  const userB = await createAndSignInPlayer(pageB);

  // Switch User B to private
  await pageB.goto("/players");
  const privacyToggle = pageB.locator("button[title='Click to switch to Private']");
  await expect(privacyToggle).toBeVisible();
  await privacyToggle.click();
  await expect(pageB.getByText("Profile is now Private")).toBeVisible();
  await contextB.close();

  // 3. User A goes to home page
  await page.goto("/");
  const findGroupsBtn = page.getByRole("link", { name: "Find Groups" });
  const findPlayersBtn = page.getByRole("link", { name: "Find Players" });

  await expect(findGroupsBtn).toBeVisible();
  await expect(findPlayersBtn).toBeVisible();

  // 4. Click Find Players
  await findPlayersBtn.click();
  await expect(page).toHaveURL("/players/find");
  await expect(page.getByRole("heading", { name: "Find Players" })).toBeVisible();

  // 5. Search for User B (private)
  await page.fill("#player-search", userB.username);
  await page.click("button:has-text('Search')");

  const userBCard = page.locator(`[data-testid='player-card-${userB.username}']`);
  await expect(userBCard).toBeVisible();
  await expect(userBCard).toContainText(userB.name);
  await expect(userBCard).toContainText(`@${userB.username}`);
  await expect(userBCard).toContainText("Private");
  await expect(userBCard).toContainText("Rating:");

  // 6. View User B's private profile
  await userBCard.getByRole("link", { name: "View Profile" }).click();
  await expect(page).toHaveURL(`/players/${userB.username}`);
  await expect(page.getByText("This Profile is Private")).toBeVisible();
  await expect(page.getByText("Rating over time")).not.toBeVisible();
  await expect(page.getByText("Past Sessions")).not.toBeVisible();

  // 7. Go back to Find Players and search for User A (public)
  await page.goto("/players/find");
  await page.fill("#player-search", userA.username);
  await page.click("button:has-text('Search')");

  const userACard = page.locator(`[data-testid='player-card-${userA.username}']`);
  await expect(userACard).toBeVisible();
  await expect(userACard).toContainText(userA.name);
  await expect(userACard).toContainText(`@${userA.username}`);
  await expect(userACard).toContainText("Public");
  await expect(userACard).toContainText("Rating:");

  // 8. Test Back button from Find Players returns to Home
  const backFromPlayersBtn = page.getByRole("link", { name: "Go back" });
  await expect(backFromPlayersBtn).toBeVisible();
  await backFromPlayersBtn.click();
  await expect(page).toHaveURL("/");

  // 9. Test Back button from Find Groups returns to Home
  await findGroupsBtn.click();
  await expect(page).toHaveURL("/players/groups");
  const backFromGroupsBtn = page.getByRole("link", { name: "Go back" });
  await expect(backFromGroupsBtn).toBeVisible();
  await backFromGroupsBtn.click();
  await expect(page).toHaveURL("/");
});
});
