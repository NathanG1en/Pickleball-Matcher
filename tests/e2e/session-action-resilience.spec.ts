import { test, expect, type Page, type Route } from "@playwright/test";
import {
  actionButton, assertCommitted, closeSecondary, createResilienceFixture, deferred,
  fillThreeScores, installFailure, isResilienceDatabaseSupported, prepareAction, resilienceDatabase, scopedState,
  secondaryOrganizer, waitForAction, type ResilienceFixture, type SessionAction,
} from "../fixtures/session-action-resilience";

test.skip(
  !isResilienceDatabaseSupported(),
  "Session action resilience requires explicitly disposable loopback test_db; refusing fixture writes or failure triggers elsewhere."
);

const actions: SessionAction[] = ["start", "save", "next"];
const isAction = (route: Route) => route.request().method() === "POST" && Boolean(route.request().headers()["next-action"]);

/** Capture the actual submitted action without replacing the service or its replay logic. */
async function interceptAction(page: Page, operation: (route: Route) => Promise<void>) {
  await page.route("**/*", async route => {
    if (isAction(route)) await operation(route);
    else await route.continue();
  });
}

async function recoverView(page: Page, fixture: ResilienceFixture, action: SessionAction) {
  await page.goto(fixture.sessionPath);
  if (action === "start") return actionButton(page, action);
  await fillThreeScores(page);
  return actionButton(page, action);
}

for (const action of actions) {
  test(`${action}: organizer permission revoked after rendering is rejected by the real server`, async ({ page, browser, baseURL }) => {
    test.setTimeout(45_000);
    const sql = resilienceDatabase();
    let secondary: Awaited<ReturnType<typeof secondaryOrganizer>> | undefined;
    try {
      const fixture = await createResilienceFixture(page, sql);
      await prepareAction(page, action);
      secondary = await secondaryOrganizer(browser, fixture, baseURL!);
      if (action !== "start") await fillThreeScores(secondary.page);
      const button = await actionButton(secondary.page, action);
      await sql`delete from group_organizers where group_id = ${fixture.groupId} and account_id = ${fixture.secondaryId}`;
      const before = await scopedState(fixture);
      await button.click();
      await expect(secondary.page.getByRole("alert").filter({ hasText: "Not authorized" })).toBeVisible();
      expect(await scopedState(fixture)).toEqual(before);
      // The owner retains permission and can still complete the same operation.
      await (await actionButton(page, action)).click();
      await waitForAction(page, action);
      await assertCommitted(fixture, action, before);
    } finally {
      await closeSecondary(secondary);
      await sql.end();
    }
  });

  test(`${action}: actual server failure rolls back the entire three-court action and retry succeeds`, async ({ page }) => {
    test.setTimeout(45_000);
    const sql = resilienceDatabase();
    let removeFailure: (() => Promise<void>) | undefined;
    try {
      const fixture = await createResilienceFixture(page, sql);
      const button = await prepareAction(page, action);
      const before = await scopedState(fixture);
      removeFailure = await installFailure(fixture, action);
      await button.click();
      await expect(page.getByRole("alert").filter({ hasText: "Injected scoped session action failure" })).toBeVisible();
      expect(await scopedState(fixture)).toEqual(before);
      if (action !== "start") for (let court = 1; court <= 3; court++) {
        await expect(page.getByRole("spinbutton", { name: `Court ${court} Team 1 score`, exact: true })).toHaveValue("11");
        await expect(page.getByRole("spinbutton", { name: `Court ${court} Team 2 score`, exact: true })).toHaveValue("5");
      }
      await removeFailure();
      removeFailure = undefined;
      await (await recoverView(page, fixture, action)).click();
      await waitForAction(page, action);
      await assertCommitted(fixture, action, before);
    } finally {
      await removeFailure?.();
      await sql.end();
    }
  });

  test(`${action}: slow and dropped request keeps persisted data unchanged and can be retried`, async ({ page }) => {
    test.setTimeout(45_000);
    const sql = resilienceDatabase();
    const reached = deferred();
    const release = deferred();
    try {
      const fixture = await createResilienceFixture(page, sql);
      const button = await prepareAction(page, action);
      const before = await scopedState(fixture);
      await interceptAction(page, async route => {
        reached.resolve();
        await release.promise;
        await route.abort("connectionreset");
      });
      await button.click();
      await reached.promise;
      // The gate is held while inspecting the actual disabled pending UI and database.
      const pendingButton = action === "start"
        ? page.getByRole("button", { name: "Start Round", exact: true })
        : action === "next" ? page.locator(".mobile-action-bar button").last() : button;
      await expect(pendingButton).toBeDisabled();
      expect(await scopedState(fixture)).toEqual(before);
      release.resolve();
      await expect(page.getByRole("alert").filter({ hasText: /Failed to (start round|save match results|advance to next round)/ })).toBeVisible();
      expect(await scopedState(fixture)).toEqual(before);
      await page.unrouteAll({ behavior: "wait" });
      await (await recoverView(page, fixture, action)).click();
      await waitForAction(page, action);
      await assertCommitted(fixture, action, before);
    } finally {
      release.resolve();
      await page.unrouteAll({ behavior: "wait" });
      await sql.end();
    }
  });

  test(`${action}: rapid repeated clicks commit one logical action`, async ({ page }) => {
    test.setTimeout(45_000);
    const sql = resilienceDatabase();
    try {
      const fixture = await createResilienceFixture(page, sql);
      const button = await prepareAction(page, action);
      const before = await scopedState(fixture);
      await button.evaluate(element => {
        if (!(element instanceof HTMLButtonElement)) throw new Error("Expected a native action button");
        element.click(); element.click(); element.click();
      });
      await waitForAction(page, action);
      await page.reload();
      const after = await assertCommitted(fixture, action, before);
      expect(after.rounds.find(round => round.round_number === 1)!.version).toBe(action === "next" ? 2 : 1);
    } finally { await sql.end(); }
  });

  test(`${action}: refresh while request is paused recovers the persisted pre-action view`, async ({ page }) => {
    test.setTimeout(45_000);
    const sql = resilienceDatabase();
    const reached = deferred();
    const release = deferred();
    let wasAborted = false;
    try {
      const fixture = await createResilienceFixture(page, sql);
      const button = await prepareAction(page, action);
      const before = await scopedState(fixture);
      await interceptAction(page, async route => {
        reached.resolve();
        await release.promise;
        try { await route.abort("aborted"); } catch (error) {
          // Navigation can dispose a paused route before Playwright releases it.
          if (!/closed|cancel|invalid interception/i.test(String(error))) throw error;
        }
        wasAborted = true;
      });
      await button.click();
      await reached.promise;
      expect(await scopedState(fixture)).toEqual(before);
      const navigation = page.reload();
      release.resolve();
      await navigation;
      await page.unrouteAll({ behavior: "wait" });
      expect(wasAborted).toBe(true);
      expect(await scopedState(fixture)).toEqual(before);
      await (await recoverView(page, fixture, action)).click();
      await waitForAction(page, action);
      await assertCommitted(fixture, action, before);
    } finally {
      release.resolve();
      await page.unrouteAll({ behavior: "wait" });
      await sql.end();
    }
  });

  test(`${action}: committed response lost, refresh and exact stale retry preserve control behavior`, async ({ page }) => {
    test.setTimeout(45_000);
    const sql = resilienceDatabase();
    let captured: { url: string; headers: Record<string, string>; body: string } | undefined;
    const committed = deferred();
    try {
      const fixture = await createResilienceFixture(page, sql);
      const button = await prepareAction(page, action);
      const before = await scopedState(fixture);
      await interceptAction(page, async route => {
        const request = route.request();
        captured = { url: request.url(), headers: request.headers(), body: request.postData() ?? "" };
        const response = await route.fetch();
        expect(response.ok()).toBe(true);
        // route.fetch waits for the real action to commit; abort only its delivery.
        committed.resolve();
        await route.abort("connectionreset");
      });
      await button.click();
      await committed.promise;
      const afterCommit = await assertCommitted(fixture, action, before);
      await expect(page.getByRole("alert").filter({ hasText: /Failed to/ })).toBeVisible();
      await page.unrouteAll({ behavior: "wait" });
      await page.reload();
      await waitForAction(page, action);
      expect(await scopedState(fixture)).toEqual(afterCommit);
      if (!captured) throw new Error("The actual action request was not captured");
      const replay = await page.request.post(captured.url, { headers: captured.headers, data: captured.body });
      expect(replay.ok()).toBe(true);
      const responseBody = await replay.text();
      const afterRetry = await scopedState(fixture);
      expect(responseBody).toContain(action === "save" ? "match changed" : "session changed");
      expect(afterRetry).toEqual(afterCommit);
    } finally {
      committed.resolve();
      await page.unrouteAll({ behavior: "wait" });
      await sql.end();
    }
  });

  test(`${action}: independently authenticated organizers overlap stale submissions atomically`, async ({ page, browser, baseURL }) => {
    test.setTimeout(45_000);
    const sql = resilienceDatabase();
    let secondary: Awaited<ReturnType<typeof secondaryOrganizer>> | undefined;
    const hostReached = deferred();
    const otherReached = deferred();
    const release = deferred();
    const hostFinished = deferred();
    const otherFinished = deferred();
    const bodies: string[] = [];
    try {
      const fixture = await createResilienceFixture(page, sql);
      const hostButton = await prepareAction(page, action);
      secondary = await secondaryOrganizer(browser, fixture, baseURL!);
      if (action !== "start") await fillThreeScores(secondary.page);
      const otherButton = await actionButton(secondary.page, action);
      const before = await scopedState(fixture);
      const submit = async (route: Route, reached: ReturnType<typeof deferred>, finished: ReturnType<typeof deferred>) => {
        reached.resolve();
        await release.promise;
        const response = await route.fetch();
        expect(response.ok()).toBe(true);
        bodies.push(await response.text());
        await route.fulfill({ response });
        finished.resolve();
      };
      await interceptAction(page, route => submit(route, hostReached, hostFinished));
      await interceptAction(secondary.page, route => submit(route, otherReached, otherFinished));
      await Promise.all([hostButton.click(), otherButton.click()]);
      await Promise.all([hostReached.promise, otherReached.promise]);
      expect(await scopedState(fixture)).toEqual(before);
      release.resolve();
      await Promise.all([hostFinished.promise, otherFinished.promise]);
      expect(bodies).toHaveLength(2);
      {
        // startRound has an optimistic version check but no session lock. When
        // both transactions read the old version, the unique round key rejects
        // the loser; a later reader instead gets the explicit stale-version error.
        const conflict = action === "start" ? /session changed|duplicate key value violates unique constraint/ : action === "next" ? /session changed/ : /match changed/;
        expect(bodies.filter(body => conflict.test(body))).toHaveLength(1);
      }
      await page.unrouteAll({ behavior: "wait" });
      await secondary.page.unrouteAll({ behavior: "wait" });
      await page.reload();
      await secondary.page.reload();
      await waitForAction(page, action);
      await waitForAction(secondary.page, action);
      const after = await assertCommitted(fixture, action, before);
      expect(after.rounds.find(round => round.round_number === 1)!.version).toBe(action === "next" ? 2 : 1);
    } finally {
      release.resolve();
      await page.unrouteAll({ behavior: "wait" });
      await secondary?.page.unrouteAll({ behavior: "wait" });
      await closeSecondary(secondary);
      await sql.end();
    }
  });
}

test("shared accounts scoring in two groups retain account, alias, snapshot and chemistry consistency", async ({ page }) => {
  test.setTimeout(45_000);
  const sql = resilienceDatabase();
  try {
    const fixture = await createResilienceFixture(page, sql);
    await prepareAction(page, "save");
    const before = await scopedState(fixture);
    await page.getByTestId("save-all-scores-button").click();
    await waitForAction(page, "save");
    await page.getByTestId("save-and-start-next-round-button").click();
    await waitForAction(page, "next");
    const first = await assertCommitted(fixture, "next", before);
    // Only this fixture's previously inactive alias is activated for its second session.
    await sql`update players set active = true where group_id = ${fixture.shadowGroupId} and account_id = ${fixture.accountIds[11]}`;
    await page.goto(`/g/${fixture.shadowGroupId}`);
    await page.getByTestId("start-new-session-button").click();
    await page.getByTestId("select-normal-session-button").click();
    await page.getByRole("button", { name: "Increase courts", exact: true }).click();
    await page.getByTestId("continue-to-pairings-button").click();
    await page.getByRole("button", { name: "Start Session", exact: true }).click();
    await expect(page).toHaveURL(/\/sessions\/session_/);
    await prepareAction(page, "save");
    await page.getByTestId("save-all-scores-button").click();
    await waitForAction(page, "save");
    await page.getByTestId("save-and-start-next-round-button").click();
    await waitForAction(page, "next");
    const after = await scopedState(fixture);
    expect(after.sessions).toHaveLength(2);
    expect(after.rounds).toHaveLength(4);
    expect(after.matches).toHaveLength(12);
    expect(after.attendance).toHaveLength(24);
    expect(after.snapshots).toHaveLength(48);
    expect(after.sits).toHaveLength(0);
    expect(after.permissions).toEqual(first.permissions);
    expect(after.snapshots.filter(snapshot => first.snapshots.some(original => original.match_id === snapshot.match_id))).toEqual(first.snapshots);
    for (const account of after.accounts) {
      expect(account.rated_games_played).toBe(2);
      for (const player of after.players.filter(alias => alias.account_id === account.id)) {
        expect(player.rating).toBe(account.rating);
        expect(player.rated_games_played).toBe(2);
      }
    }
    for (const snapshot of after.snapshots.filter(member => after.matches.some(match => match.id === member.match_id && match.status === "completed"))) {
      expect(snapshot.rating_before).not.toBeNull();
      expect(snapshot.rating_after).not.toBeNull();
    }
    expect(after.chemistry.reduce((sum, pair) => sum + Number(pair.matches_played), 0)).toBe(12);
    const pendingMatches = after.matches.filter(match => match.status === "pending");
    expect(pendingMatches).toHaveLength(6);
    expect(after.matches.filter(match => match.status === "completed")).toHaveLength(6);
    for (const match of pendingMatches) {
      expect(match.version).toBe(1);
      expect([match.team1_score, match.team2_score]).toEqual([null, null]);
    }
    for (const snapshot of after.snapshots.filter(member => pendingMatches.some(match => match.id === member.match_id))) {
      expect(snapshot.rating_before).toBeNull();
      expect(snapshot.rating_after).toBeNull();
    }
    for (const match of after.matches.filter(match => match.status === "completed")) {
      expect(match.status).toBe("completed");
      expect(match.version).toBe(2);
      expect([match.team1_score, match.team2_score]).toEqual([11, 5]);
    }
    await page.reload();
    expect(await scopedState(fixture)).toEqual(after);
  } finally { await sql.end(); }
});

test("combined Save & Start reconciles versions across consecutive rounds without a refresh", async ({ page }) => {
  test.setTimeout(45_000);
  const sql = resilienceDatabase();
  try {
    const fixture = await createResilienceFixture(page, sql);
    await prepareAction(page, "save");
    for (const roundNumber of [2, 3]) {
      await fillThreeScores(page);
      const response = page.waitForResponse(response => response.request().method() === "POST" && Boolean(response.request().headers()["next-action"]));
      await page.getByTestId("save-and-start-next-round-button").click();
      expect((await response).ok()).toBe(true);
      await expect(page.getByRole("heading", { name: `Round ${roundNumber}`, exact: true })).toBeVisible();
      await expect(page.getByRole("spinbutton", { name: "Court 1 Team 1 score", exact: true })).toBeEnabled();
      await expect(page.getByRole("alert").filter({ hasText: /session changed|round changed|failed/i })).toHaveCount(0);
      const state = await scopedState(fixture);
      expect(state.rounds).toHaveLength(roundNumber);
      expect(state.sessions[0].version).toBe(roundNumber + 1);
      expect(state.rounds.filter(round => round.status === "started")).toHaveLength(1);
    }
    await page.reload();
    await expect(page.getByRole("heading", { name: "Round 3", exact: true })).toBeVisible();
  } finally { await sql.end(); }
});
