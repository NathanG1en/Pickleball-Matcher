import { test, expect } from "@playwright/test";
import { createAndSignInPlayer, createTestGroup } from "./test-helpers";

test("players follow a live session without reloading and always see where they play", async ({ page, browser }) => {
  test.setTimeout(120_000);
  const groupName = `Player Live ${Date.now()}`;
  const { groupId } = await createTestGroup(page, groupName);

  // Organizer pre-adds regulars as guests, including Alice.
  await page.locator("button:has-text('Add Guest')").click();
  for (const name of ["Alice Ace", "Bob", "Cara", "Dan", "Eve", "Finn"]) {
    await page.fill("#guest-player-name", name);
    await page.locator("button:text-is('Add')").click();
    await expect(page.locator("p[role='status']")).toContainText(`Guest player "${name}" added to the roster.`);
  }

  // A player with an account joins through the invite link.
  const playerContext = await browser.newContext();
  const player = await playerContext.newPage();
  await createAndSignInPlayer(player);
  await player.goto(`/g/${groupId}/join`);
  await player.getByRole("button", { name: "Join Group Now" }).click();
  await expect(player).toHaveURL(new RegExp(`/g/${groupId}$`));

  // The real Alice opens the share link signed out and joins under her roster name.
  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  await guest.goto(`/g/${groupId}/join`);
  await expect(guest.getByText("Already on the roster? Use the name your organizer added")).toBeVisible();
  await guest.fill("#guest-join-name", "alice ace");
  await guest.getByRole("button", { name: "Join as Guest" }).click();
  await expect(guest).toHaveURL(new RegExp(`/g/${groupId}$`));

  // She took her existing spot: still one Alice and 8 players (host + 6 guests + player).
  await page.reload();
  await expect(page.getByRole("heading", { name: /Roster \(/ })).toContainText("Roster (8)");
  await expect(page.getByText("Alice Ace", { exact: true })).toHaveCount(1);

  // Organizer starts a session; the player watches the session page.
  await page.click("a[href*='/sessions/new']");
  await page.click("button[data-testid='select-normal-session-button']");
  await expect(page.locator("text=8 players selected")).toBeVisible();
  await page.click("button[data-testid='continue-to-pairings-button']");
  await page.click("button:has-text('Start Session')");
  await expect(page).toHaveURL(/\/sessions\/session_/);
  const sessionPath = new URL(page.url()).pathname;

  await player.goto(sessionPath);
  await expect(player.getByText("Waiting for Next Round")).toBeVisible();

  await page.click("button:has-text('Start Round')");
  const confirm = page.locator("button:has-text('Confirm & Start')");
  if (await confirm.isVisible({ timeout: 2000 }).catch(() => false)) await confirm.click();
  await expect(page.locator("input[aria-label='Court 1 Team 1 score']")).toBeVisible();

  // No reload: the player's page catches up on its own and pins their assignment.
  const viewerCard = player.getByTestId("viewer-round-card");
  await expect(viewerCard).toBeVisible({ timeout: 15_000 });
  await expect(viewerCard).toContainText(/You're on Court [12]/);
  await expect(player.locator("[data-viewer-team='true']")).toHaveCount(1);

  // A saved score reaches the player too.
  await page.locator("input[aria-label='Court 1 Team 1 score']").fill("11");
  await page.locator("input[aria-label='Court 1 Team 2 score']").fill("6");
  await page.locator("[data-testid='court-match-1'] button:has-text('Save Result')").click();
  await expect(page.locator("[data-testid='court-match-1'] >> text=Final")).toBeVisible();
  await expect(player.getByTestId("court-match-1").getByText("Final")).toBeVisible({ timeout: 15_000 });

  // Home is one tap from the court for the player, and lists the group for the guest.
  await player.goto("/");
  const liveLink = player.getByTestId("home-live-session");
  await expect(liveLink).toContainText(groupName);
  await expect(liveLink).toHaveAttribute("href", sessionPath);
  await guest.goto("/");
  await expect(guest.getByRole("heading", { name: "Your groups" })).toBeVisible();
  await expect(guest.getByTestId("home-live-session")).toContainText(groupName);

  await playerContext.close();
  await guestContext.close();
});
