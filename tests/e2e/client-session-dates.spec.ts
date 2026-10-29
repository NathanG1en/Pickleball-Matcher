import postgres from "postgres";
import { test, expect } from "@playwright/test";
import { createTestGroup } from "./test-helpers";

const instant = "2026-10-29T03:55:00.000Z";
for (const [timezoneId, localDate] of [["America/New_York", "Oct 28, 2026"], ["Pacific/Auckland", "Oct 29, 2026"]] as const) {
  test.describe(timezoneId, () => {
    test.use({ timezoneId, locale: "en-US" });
    test("profile session dates follow the browser across UTC midnight", async ({ page }, testInfo) => {
      test.setTimeout(120_000);
      const hydrationErrors: string[] = [];
      page.on("pageerror", error => { if (/hydration|server rendered/i.test(error.message)) hydrationErrors.push(error.message); });
      const { groupId, hostUsername } = await createTestGroup(page, `Local dates ${Date.now()}`);
      const sql = postgres(process.env.TEST_DATABASE_URL!, { max: 1, prepare: false });
      const sessions: { id: string; name: string | null }[] = [];
      try {
        for (const name of [null, "Evening Club"]) {
          await page.goto(`/g/${groupId}`);
          await page.getByTestId("start-new-session-button").click();
          await page.getByTestId("select-open-play-button").click();
          await page.getByTestId("start-open-play-button").click();
          await expect(page).toHaveURL(/\/sessions\/session_/);
          const id = page.url().split("/sessions/")[1].split("?")[0];
          page.once("dialog", dialog => dialog.accept());
          await page.getByTestId("end-session-button").click();
          await expect(page.getByText("Completed", { exact: true })).toBeVisible();
          // Only this newly created fixture is changed; application/public history is untouched.
          await sql`update sessions set started_at = ${instant}, ended_at = ${instant}, name = ${name} where id = ${id} and group_id = ${groupId}`;
          sessions.push({ id, name });
        }
        await page.goto(`/g/${groupId}`);
        for (const session of sessions) {
          const item = page.getByTestId(`past-session-item-${session.id}`);
          await expect(item.getByRole("button", { name: session.name ? `${session.name} · ${localDate}` : `Session from ${localDate}`, exact: true })).toBeVisible();
        }
        for (const route of ["/players", `/players/${hostUsername}`]) {
          await page.goto(route);
          for (const session of sessions) {
            const item = page.getByTestId(`player-session-${session.id}`);
            await expect(item.getByRole("heading", { level: 3 })).toHaveText(session.name ? `${session.name} · ${localDate}` : localDate);
            await expect(item.locator("time")).toHaveAttribute("datetime", instant);
          }
          await page.reload();
          await expect(page.getByTestId(`player-session-${sessions[0].id}`).getByRole("heading", { level: 3 })).toHaveText(localDate);
        }
        expect(hydrationErrors).toEqual([]);
        await page.screenshot({ path: testInfo.outputPath("local-profile-dates.png"), fullPage: true });
      } finally { await sql.end(); }
    });
  });
}
