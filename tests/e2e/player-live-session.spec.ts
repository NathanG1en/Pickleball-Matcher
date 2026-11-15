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

  // Home is one tap from the court for the player, and signed-out guests see the welcome screen while their group dashboard retains live session access.
  await player.goto("/");
  const liveLink = player.getByTestId("home-live-session");
  await expect(liveLink).toContainText(groupName);
  await expect(liveLink).toHaveAttribute("href", sessionPath);
  await guest.goto("/");
  await expect(guest.getByRole("link", { name: "Sign In to Play →", exact: true })).toBeVisible();
  await expect(guest.getByRole("heading", { name: "Your groups" })).toHaveCount(0);
  await guest.goto(`/g/${groupId}`);
  await expect(guest.locator("text=Session In Progress")).toBeVisible();

  await playerContext.close();
  await guestContext.close();
});

test("a player can head home early, is warned before leaving the group mid-game, and shared links keep their group", async ({ page, browser }) => {
  test.setTimeout(150_000);
  const groupName = `Head Home ${Date.now()}`;
  const { groupId } = await createTestGroup(page, groupName);
  await page.locator("button:has-text('Add Guest')").click();
  // Nine players on two courts, so one leaving still fills both courts.
  for (const name of ["Bea", "Cal", "Dot", "Eli", "Fay", "Gus", "Hal"]) {
    await page.fill("#guest-player-name", name);
    await page.locator("button:text-is('Add')").click();
    await expect(page.locator("p[role='status']")).toContainText(`Guest player "${name}" added to the roster.`);
  }
  const playerContext = await browser.newContext();
  const player = await playerContext.newPage();
  const jordan = await createAndSignInPlayer(player);
  await player.goto(`/g/${groupId}/join`);
  await player.getByRole("button", { name: "Join Group Now" }).click();
  await expect(player).toHaveURL(new RegExp(`/g/${groupId}$`));

  await page.goto(`/g/${groupId}`);
  await page.click("a[href*='/sessions/new']");
  await page.click("button[data-testid='select-normal-session-button']");
  await expect(page.locator("text=9 players selected")).toBeVisible();
  await page.click("button[data-testid='continue-to-pairings-button']");
  await page.click("button:has-text('Start Session')");
  await expect(page).toHaveURL(/\/sessions\/session_/);
  const sessionPath = new URL(page.url()).pathname;
  await page.click("button:has-text('Start Round')");
  const confirm = page.locator("button:has-text('Confirm & Start')");
  if (await confirm.isVisible({ timeout: 2000 }).catch(() => false)) await confirm.click();
  await expect(page.locator("input[aria-label='Court 1 Team 1 score']")).toBeVisible();

  // The player says they're heading home after this round.
  await player.goto(sessionPath);
  await player.getByTestId("leave-after-game-button").click();
  await expect(player.getByTestId("my-attendance")).toContainText("You're out from Round 2");
  await expect(player.getByTestId("stay-in-session-button")).toBeVisible();

  // Leaving the whole group mid-game warns about the live session.
  await player.goto(`/g/${groupId}`);
  await player.getByRole("button", { name: "Group options" }).click();
  await player.getByTestId("leave-group-menu-item").click();
  await expect(player.getByTestId("leave-group-live-warning")).toContainText("A session is running");
  await player.getByRole("alertdialog").getByRole("button", { name: "Cancel" }).click();

  // The organizer's open page was built before the player left; starting the next round
  // names who left, refreshes, and the retry leaves them out.
  for (const court of [1, 2]) {
    await page.locator(`input[aria-label='Court ${court} Team 1 score']`).fill("11");
    await page.locator(`input[aria-label='Court ${court} Team 2 score']`).fill(String(4 + court));
  }
  // Save & Start updates optimistically, so wait for the server's answer each time.
  const actionResponse = () => page.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname === sessionPath);
  const stale = page.getByRole("alert").filter({ hasText: `out of date: ${jordan.name} left` });
  let answered = actionResponse();
  await page.getByTestId("save-and-start-next-round-button").click();
  await answered;
  await expect(stale).toBeVisible();
  await expect(page.getByTestId("save-and-start-next-round-button")).toBeEnabled({ timeout: 15_000 });
  answered = actionResponse();
  await page.getByTestId("save-and-start-next-round-button").click();
  await answered;
  await expect(page.getByRole("heading", { name: "Round 2", exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(stale).toHaveCount(0);
  await expect(page.locator("[data-testid^='court-match-']").filter({ hasText: jordan.name })).toHaveCount(0);

  // A signed-in non-member opening the session link is offered the join page, then lands on the session.
  const outsiderContext = await browser.newContext();
  const outsider = await outsiderContext.newPage();
  await createAndSignInPlayer(outsider);
  await outsider.goto(sessionPath);
  await expect(outsider).toHaveURL(new RegExp(`/g/${groupId}/join\\?next=`));
  await outsider.getByRole("button", { name: "Join Group Now" }).click();
  await expect(outsider).toHaveURL(sessionPath);

  // A signed-out visitor sees which group the link belongs to, with a way to join.
  const anonContext = await browser.newContext();
  const anon = await anonContext.newPage();
  await anon.goto(sessionPath);
  await expect(anon.getByTestId("login-group-context")).toContainText(groupName);
  await expect(anon.getByTestId("login-join-group-link")).toHaveAttribute("href", `/g/${groupId}/join?next=${encodeURIComponent(sessionPath)}`);

  await playerContext.close();
  await outsiderContext.close();
  await anonContext.close();
});
