import { expect, type Page } from "@playwright/test";

export interface TestPlayerAccount {
  username: string;
  name: string;
}

/**
 * Creates and authenticates a fresh player account in the browser session,
 * routing to `/setup` so the user can immediately create a group.
 */
export async function createAndSignInPlayer(
  page: Page,
  options?: { username?: string; name?: string; password?: string }
): Promise<TestPlayerAccount> {
  const ts = Date.now();
  const username = options?.username ?? `user_${ts}_${Math.floor(Math.random() * 1000)}`;
  const name = options?.name ?? `Test Player ${ts}`;
  const password = options?.password ?? "ValidPassword123!";

  await page.goto("/player-signup?next=%2Fsetup");
  await page.waitForSelector("form[data-hydrated='true']");
  await page.fill("#player-username", username);
  await page.fill("#player-name", name);
  await page.locator("#player-gender").selectOption({ value: "male" });
  await page.fill("#player-password", password);
  await page.click("button[type='submit']");

  // Wait for client-side navigation to /setup
  await expect(page).toHaveURL(/\/setup/);
  await expect(page.locator("h1")).toContainText("Create Group");

  return { username, name };
}

/**
 * Helper that signs up a player account and creates a test group on `/setup`.
 */
export async function createTestGroup(
  page: Page,
  groupName: string
): Promise<{ groupName: string; groupId: string }> {
  await createAndSignInPlayer(page);
  await page.waitForSelector("form[data-hydrated='true']");
  await page.fill("#group-name", groupName);
  await page.click("button[type='submit']");
  await expect(page).toHaveURL(/\/g\/grp_/);
  const groupId = page.url().split("/g/")[1].split("/")[0];
  return { groupName, groupId };
}
