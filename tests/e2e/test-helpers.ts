import { expect, type Page, type Locator } from "@playwright/test";

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
  await expect(page).toHaveURL(/\/setup/, { timeout: 25000 });
  await expect(page.locator("h1")).toContainText("Create Group");

  return { username, name };
}

/**
 * Helper that signs up a player account and creates a test group on `/setup`.
 */
export async function createTestGroup(
  page: Page,
  groupName: string
): Promise<{ groupName: string; groupId: string; hostName: string; hostUsername: string }> {
  const host = await createAndSignInPlayer(page);
  await page.waitForSelector("form[data-hydrated='true']");
  await page.fill("#group-name", groupName);
  await page.click("button[type='submit']");
  await expect(page).toHaveURL(/\/g\/grp_/, { timeout: 15000 });
  const groupId = page.url().split("/g/")[1].split("/")[0];
  return { groupName, groupId, hostName: host.name, hostUsername: host.username };
}

/** Checks that replay is cosmetic, keyboard accessible, and never stacks motion. */
export async function checkAnimationReplay(
  page: Page,
  art: Locator,
  buttonName: string,
  counter: string,
  { reducedMotion = false, touch = false } = {},
) {
  const button = page.getByRole("button", { name: buttonName, exact: true });
  await expect(button).toBeVisible();
  await expect(button).toHaveAttribute("type", "button");
  const originalUrl = page.url();
  const starts = () => page.evaluate(key => Number(document.documentElement.dataset[key] ?? "0"), counter);
  let expected = await starts();
  let requests = 0;
  const trackRequest = (request: import("@playwright/test").Request) => { if (request.method() === "POST") requests++; };
  page.on("request", trackRequest);
  try {
    await button.focus();
    await expect(button).toBeFocused();
    expect(await starts()).toBe(expected);
    for (const activation of ["pointer", "Enter", "Space", "rapid"]) {
      if (activation === "pointer") {
        if (touch) await button.tap();
        else await button.click();
      } else if (activation === "rapid") {
        await button.evaluate(element => {
          if (!(element instanceof HTMLButtonElement)) throw new Error("Replay needs a native button");
          element.click();
          element.click();
          element.click();
        });
      } else {
        await button.press(activation);
      }
      if (!reducedMotion) expected++;
      await expect.poll(starts).toBe(expected);
      await expect(art).toHaveAttribute("data-motion", "still");
      expect(await art.evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0);
    }
    await expect(page).toHaveURL(originalUrl);
    expect(requests).toBe(0);
  } finally {
    page.off("request", trackRequest);
  }
}

/** Samples the browser's actual path while keeping the illustration's layout fixed. */
export async function sampleReplayMotion(art: Locator, movingSelector?: string) {
  const motion = await art.evaluate((element, selector) => {
    const button = element.closest("button");
    if (!button) throw new Error("Expected a replay button");
    button.click();
    const animations = element.getAnimations({ subtree: true });
    if (!animations.length) throw new Error("Expected a replay animation");
    for (const animation of animations) animation.pause();
    const duration = Math.max(...animations.map(animation => Number(animation.effect?.getTiming().duration)));
    const moving = selector ? element.querySelector(selector) : element;
    if (!moving) throw new Error("Expected moving artwork");
    const frames = [0, 0.25, 0.5, 0.75, 0.95].map(progress => {
      for (const animation of animations) animation.currentTime = duration * progress;
      const box = moving.getBoundingClientRect();
      const canvas = element.getBoundingClientRect();
      return { x: box.x, y: box.y, cx: (box.x + box.right) / 2, cy: (box.y + box.bottom) / 2, right: box.right, bottom: box.bottom, canvas: { x: canvas.x, y: canvas.y, right: canvas.right, bottom: canvas.bottom } };
    });
    for (const animation of animations) { animation.currentTime = 0; animation.play(); }
    return { duration, frames };
  }, movingSelector);
  await expect(art).toHaveAttribute("data-motion", "still");
  return motion;
}
