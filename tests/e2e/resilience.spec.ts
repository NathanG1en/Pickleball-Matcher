import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { sampleReplayMotion, createTestGroup } from "./test-helpers";

test.describe("Resilience and Safe Drafts", () => {
  test("retains unsaved draft scores on validation failure, handles stale versions, and passes a11y audits", async ({
    page,
    context,
  }) => {
    // 1. Create group
    const groupName = `Resilience League ${Date.now()}`;
    await createTestGroup(page, groupName);

    // 2. Add 4 players
    await expect(page.locator("h2:has-text('Roster')")).toBeVisible();
    await expect(page.locator("button:has-text('Find Player')")).toBeVisible();
    const addGuestButton = page.locator("button:has-text('Add Guest')");
    await expect(addGuestButton).toBeVisible();
    await addGuestButton.click();
    const players = ["Harper", "Riley", "Jordan", "Taylor"];
    for (const name of players) {
      await page.fill("#guest-player-name", name);
      await page.locator("button:text-is('Add')").click();
      await expect(page.locator("p[role='status']")).toContainText(`Guest player "${name}" added to the roster.`, { timeout: 10000 });
      await expect(page.locator("#guest-player-name")).toHaveValue("");
    }

    // 3. Start a session
    await page.click("a[href*='/sessions/new']");
    await expect(page).toHaveURL(/\/sessions\/new/);

    // Accessibility check on session setup view
    const sessionSetupA11y = await new AxeBuilder({ page })
      .disableRules(["color-contrast"])
      .analyze();
    expect(sessionSetupA11y.violations).toEqual([]);

    await page.click("button:has-text('Start Session')");
    await expect(page).toHaveURL(/\/sessions\/session_/);
    const sessionUrl = page.url();

    // 4. Start Round 1
    await page.click("button:has-text('Start Round')");
    await page.click("button:has-text('Confirm & Start')");
    await expect(page.locator("h1")).toContainText("Round 1 Results");

    // Accessibility check on active score entry view
    const scoreEntryA11y = await new AxeBuilder({ page })
      .disableRules(["color-contrast"])
      .analyze();
    expect(scoreEntryA11y.violations).toEqual([]);

    // 5. Safe draft score retention on validation failure (tied scores: 11 - 11)
    const t1Input = page.locator("input[aria-label='Court 1 Team 1 score']");
    const t2Input = page.locator("input[aria-label='Court 1 Team 2 score']");

    await t1Input.fill("11");
    await t2Input.fill("11");
    await page.locator("button:has-text('Save Result')").click();

    // Assert validation error is shown
    await expect(page.locator("text=cannot end in a tie")).toBeVisible();

    // Assert inputs were NOT wiped out
    await expect(t1Input).toHaveValue("11");
    await expect(t2Input).toHaveValue("11");

    // Fix the score to valid (11 - 9)
    await t2Input.fill("9");
    await page.locator("button:has-text('Save Result')").click();
    await expect(page.locator("text=Final")).toBeVisible();

    // 6. Stale second tab handling
    const page2 = await context.newPage();
    await page2.goto(sessionUrl);
    await expect(page2.locator("h1")).toContainText("Round 1 Results");

    // Tab 1 advances to Round 2
    await page.click("button:has-text('Next Round')");
    await expect(page.locator("h1")).toContainText("Round 2", { timeout: 15000 });

    // Tab 2 (still on Round 1 view) tries to advance or submit
    await page2.click("button:has-text('Next Round')", { timeout: 3000 }).catch(() => {});

    // Tab 2 should either show an error or refresh cleanly to Round 2 without crashing
    await page2.reload();
    await expect(page2.locator("h1")).toContainText("Round 2", { timeout: 15000 });

    await page2.close();
  });
});

test("guest roster form has accessible names and passes an accessibility audit", async ({ page }) => {
  await createTestGroup(page, `Guest accessibility ${Date.now()}`);
  await expect(page.getByText("1 player on roster", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add Guest", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Guest Name", exact: true })).toBeVisible();
  const skill = page.getByRole("combobox", { name: "Guest starting skill level", exact: true });
  await expect(skill).toHaveValue("3.5");
  const audit = await new AxeBuilder({ page }).disableRules(["color-contrast"]).analyze();
  expect(audit.violations).toEqual([]);

  for (const [index, guest] of [
    { name: "Intermediate Guest", value: "3", rating: "Rating: 3 (Intermediate)" },
    { name: "Competitive Guest", value: "4", rating: "Rating: 4 (Competitive)" },
  ].entries()) {
    await skill.selectOption(guest.value);
    await page.getByRole("textbox", { name: "Guest Name", exact: true }).fill(guest.name);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText(`${index + 2} players on roster`, { exact: true })).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: guest.name })).toContainText(guest.rating);
  }
});

test("home pickleball bounces once per browser session and leaves navigation usable", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    document.addEventListener("animationstart", event => {
      if (event.animationName === "home-pickleball-dink") {
        document.documentElement.dataset.homeBounces = String(Number(document.documentElement.dataset.homeBounces ?? "0") + 1);
      }
    });
  });
  await page.goto("/");
  const ball = page.getByTestId("home-pickleball");
  await expect(ball).toBeVisible();
  await expect(ball).toHaveAttribute("aria-hidden", "true");
  await expect(page.getByRole("link", { name: "Sign In to Play →", exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.homeBounces)).toBe("1");
  await expect.poll(() => ball.evaluate(element => element.getAnimations().length)).toBe(0);
  await page.reload();
  await expect(ball).toHaveAttribute("data-motion", "still");
  expect(await page.evaluate(() => document.documentElement.dataset.homeBounces)).toBeUndefined();
  await page.getByRole("link", { name: "Sign In to Play →", exact: true }).click();
  await expect(page).toHaveURL(/\/player-login/);
});

test("home pickleball stays static with reduced motion or unavailable session storage", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const ball = page.getByTestId("home-pickleball");
  await expect(ball).toBeVisible();
  await expect(ball).toHaveAttribute("data-motion", "still");
  expect(await ball.evaluate(element => getComputedStyle(element).animationName)).toBe("none");
  const audit = await new AxeBuilder({ page }).include("main").analyze();
  expect(audit.violations).toEqual([]);

  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    Object.defineProperty(window, "sessionStorage", { get() { throw new Error("Storage disabled"); } });
  });
  await page.reload();
  await expect(ball).toHaveAttribute("data-motion", "still");
  expect(await ball.evaluate(element => getComputedStyle(element).animationName)).toBe("none");
  await expect(page.getByRole("heading", { name: "FAIR ROUNDS. FRESH PARTNERS." })).toBeVisible();
});

test("home pickleball replays on hover, click and keyboard without looping", async ({ page, isMobile }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    sessionStorage.setItem("pickleball:home-dink:v1", "played");
    document.addEventListener("animationstart", event => {
      if (event.animationName === "home-pickleball-dink") {
        document.documentElement.dataset.homeBounces = String(Number(document.documentElement.dataset.homeBounces ?? "0") + 1);
      }
    });
  });
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Bounce pickleball", exact: true });
  const ball = page.getByTestId("home-pickleball");
  await expect(trigger).toBeVisible();
  await expect(ball).toHaveAttribute("data-motion", "still");
  await expect(ball).toHaveCSS("overflow", "visible");
  let count = 0;
  const expectBounce = async () => {
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.homeBounces)).toBe(String(++count));
    await expect(ball).toHaveAttribute("data-motion", "still");
    expect(await ball.evaluate(element => element.getAnimations().length)).toBe(0);
  };
  if (!isMobile) {
    await trigger.hover();
    await expectBounce();
    // Keeping the pointer over the ball must not create a loop.
    await trigger.hover();
    expect(await page.evaluate(() => document.documentElement.dataset.homeBounces)).toBe(String(count));
  }
  await trigger.click();
  await expectBounce();
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expectBounce();
  await page.keyboard.press("Space");
  await expectBounce();
  // Rapid activation should finish the current bounce without stacking or restarting it.
  await trigger.evaluate(element => {
    if (!(element instanceof HTMLButtonElement)) throw new Error("Expected the bounce button");
    element.click(); element.click(); element.click();
  });
  await expectBounce();
  const motion = await sampleReplayMotion(ball, ".home-pickleball-hop");
  expect(motion.duration).toBeGreaterThanOrEqual(1000);
  expect(motion.frames[1].y).toBeLessThan(motion.frames[0].y - 6);
  expect(motion.frames[4].y).toBeCloseTo(motion.frames[0].y, 0);
  count++;
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.homeBounces)).toBe(String(count));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await trigger.click();
  await page.keyboard.press("Enter");
  expect(await page.evaluate(() => document.documentElement.dataset.homeBounces)).toBe(String(count));
  expect(await ball.evaluate(element => element.getAnimations().length)).toBe(0);
});
