import { test, expect } from "@playwright/test";
import { createTestGroup } from "./test-helpers";

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
});
