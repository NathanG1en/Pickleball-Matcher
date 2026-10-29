import { test, expect } from "@playwright/test";
import { createTestGroup } from "./test-helpers";

for (const surface of ["session", "dashboard"] as const) {
  test(`Open Play completion from ${surface} succeeds without a chemistry replay error`, async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    const { groupId } = await createTestGroup(page, `Completion regression ${Date.now()}`);
    await page.getByTestId("start-new-session-button").click();
    await page.getByTestId("select-open-play-button").click();
    await page.getByTestId("start-open-play-button").click();
    await expect(page).toHaveURL(/\/sessions\/session_/);
    const sessionUrl = page.url();
    if (surface === "dashboard") {
      await page.goto(`/g/${groupId}`);
      await page.getByTestId("end-session-now-button").click();
    } else {
      page.once("dialog", dialog => dialog.accept());
      await page.getByTestId("end-session-button").click();
    }
    const replayError = page.getByRole("alert").filter({ hasText: "Chemistry replay requires a transaction" });
    // Capture the actual pre-fix symptom if it appears; the success assertion must still fail.
    await expect.poll(async () => {
      if (await replayError.count()) return true;
      return surface === "dashboard"
        ? await page.getByTestId("end-session-now-button").count() === 0
        : await page.getByText("Completed", { exact: true }).count() > 0;
    }).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("completion-result.png"), fullPage: true });
    await expect(replayError).toHaveCount(0);
    await page.goto(sessionUrl);
    await expect(page.getByText("Completed", { exact: true })).toBeVisible();
    await expect(page.getByTestId("end-session-button")).toHaveCount(0);
  });
}
