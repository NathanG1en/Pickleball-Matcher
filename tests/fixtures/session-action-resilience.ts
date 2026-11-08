import { randomUUID } from "node:crypto";
import { hash } from "bcryptjs";
import postgres from "postgres";
import { expect, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { createTestGroup } from "../e2e/test-helpers";

export type SessionAction = "start" | "save" | "next";
const password = "Password123";
const fixtureTime = new Date("2026-10-01T12:00:00Z");

export function isResilienceDatabaseSupported(): boolean {
  const value = process.env.TEST_DATABASE_URL;
  const url = value ? new URL(value) : undefined;
  return Boolean(
    url &&
    ["postgres:", "postgresql:"].includes(url.protocol) &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
    url.pathname === "/test_db" &&
    [...url.searchParams.keys()].every(key => key === "sslmode") &&
    process.env.DISPOSABLE_POSTGRES_TESTS === "1"
  );
}

/** These tests install narrowly scoped failure triggers; remote databases are forbidden. */
export function resilienceDatabase() {
  if (!isResilienceDatabaseSupported()) {
    throw new Error("Session action resilience requires explicitly disposable loopback test_db; refusing fixture writes or failure triggers elsewhere.");
  }
  return postgres(process.env.TEST_DATABASE_URL!, { max: 2, prepare: false, onnotice: () => {} });
}

export interface ResilienceFixture {
  sql: postgres.Sql;
  groupId: string;
  shadowGroupId: string;
  sessionId: string;
  sessionPath: string;
  accountIds: string[];
  secondaryId: string;
  secondaryUsername: string;
}

export async function createResilienceFixture(page: Page, sql: postgres.Sql): Promise<ResilienceFixture> {
  await page.context().addInitScript(() => {
    window.localStorage.setItem("pickleball_confirm_matchups", "true");
  });
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const { groupId, hostUsername } = await createTestGroup(page, `Action resilience ${suffix}`);
  const [host] = await sql<{ id: string }[]>`select id from player_accounts where username = ${hostUsername}`;
  if (!host) throw new Error("UI-created host account missing");
  const accountIds = [host.id, ...Array.from({ length: 11 }, (_, i) => `usr_resilience_${suffix}_${i}`)];
  const shadowGroupId = `grp_resilience_shadow_${suffix}`;
  const passwordHash = await hash(password, 10);
  await sql.begin(async transaction => {
    // postgres.js's TransactionSql type omits the callable tag signature.
    const tx = transaction as unknown as postgres.Sql;
    for (let i = 1; i < accountIds.length; i++) {
      await tx`insert into player_accounts
        (id, username, name, password_hash, skill_level, initial_rating, rating, rated_games_played, created_at)
        values (${accountIds[i]}, ${`res_${suffix}_${i}`}, ${`Resilience Player ${i}`},
          ${passwordHash}, 'intermediate', 1000, 1000, 0, ${fixtureTime})`;
      await tx`insert into players (id, group_id, account_id, name, initial_rating, rating, rated_games_played, active, created_at)
        values (${`ply_resilience_${suffix}_${i}`}, ${groupId}, ${accountIds[i]}, ${`Resilience Player ${i}`},
          1000, 1000, 0, true, ${fixtureTime})`;
    }
    // Separate group aliases exercise account-wide propagation, including inactive roster rows.
    await tx`insert into groups (id, name, organizer_pin_hash, owner_account_id, created_at)
      values (${shadowGroupId}, ${`Action resilience shadow ${suffix}`}, ${passwordHash},
        ${host.id}, ${fixtureTime})`;
    for (let i = 0; i < accountIds.length; i++) {
      await tx`insert into players (id, group_id, account_id, name, initial_rating, rating, rated_games_played, active, created_at)
        values (${`ply_resilience_alias_${suffix}_${i}`}, ${shadowGroupId}, ${accountIds[i]},
          ${`Shared Resilience ${i}`}, 1000, 1000, 0, ${i !== 11}, ${fixtureTime})`;
    }
  });
  await page.reload();
  const secondary = page.getByRole("listitem").filter({
    has: page.getByRole("link", { name: `@res_${suffix}_1`, exact: true }),
  });
  await secondary.locator("summary").click();
  await secondary.getByRole("button", { name: "Make a group organizer", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Player is now a group organizer.");
  await page.getByTestId("start-new-session-button").click();
  await page.getByTestId("select-normal-session-button").click();
  // The existing setup defaults to two courts. Explicitly exercise THREE doubles courts.
  await page.getByRole("button", { name: "Increase courts", exact: true }).click();
  await expect(page.getByLabel("Court count", { exact: true })).toHaveText("3");
  await page.getByTestId("continue-to-pairings-button").click();
  await page.getByRole("button", { name: "Start Session", exact: true }).click();
  await expect(page).toHaveURL(/\/sessions\/session_/);
  // Ensure the confirmMatchups dialog is active so the two-step action interception works predictably
  await page.evaluate((gid) => {
    window.localStorage.setItem("pickleball_confirm_matchups", "true");
    window.localStorage.setItem(`pickleball_confirm_matchups_${gid}`, "true");
    window.dispatchEvent(new Event(`pickleball_confirm_matchups_changed_${gid}`));
  }, groupId);
  const sessionPath = new URL(page.url()).pathname;
  const sessionId = sessionPath.split("/").at(-1)!;
  const [session] = await sql<{ court_count: number }[]>`select court_count from sessions where id = ${sessionId}`;
  expect(session.court_count).toBe(3);
  return { sql, groupId, shadowGroupId, sessionId, sessionPath, accountIds,
    secondaryId: accountIds[1], secondaryUsername: `res_${suffix}_1` };
}

export async function secondaryOrganizer(browser: Browser, fixture: ResilienceFixture, baseURL: string) {
  const context = await browser.newContext({ baseURL });
  await context.addInitScript(() => {
    window.localStorage.setItem("pickleball_confirm_matchups", "true");
  });
  const page = await context.newPage();
  try {
    await page.goto(`/player-login?next=${encodeURIComponent(fixture.sessionPath)}`);
    await page.locator("#player-login-username").fill(fixture.secondaryUsername);
    await page.locator("#player-login-password").fill(password);
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await expect(page).toHaveURL(fixture.sessionPath);
    await page.evaluate((gid) => {
      window.localStorage.setItem("pickleball_confirm_matchups", "true");
      window.localStorage.setItem(`pickleball_confirm_matchups_${gid}`, "true");
      window.dispatchEvent(new Event(`pickleball_confirm_matchups_changed_${gid}`));
    }, fixture.groupId);
    return { context, page };
  } catch (error) {
    await context.close();
    throw error;
  }
}

export async function fillThreeScores(page: Page, reverse = false) {
  for (let court = 1; court <= 3; court++) {
    await page.getByRole("spinbutton", { name: `Court ${court} Team 1 score`, exact: true }).fill(reverse ? "5" : "11");
    await page.getByRole("spinbutton", { name: `Court ${court} Team 2 score`, exact: true }).fill(reverse ? "11" : "5");
  }
}

export async function actionButton(page: Page, action: SessionAction): Promise<Locator> {
  if (action === "start") {
    const confirmBtn = page.getByRole("button", { name: "Confirm & Start", exact: true });
    if (!(await confirmBtn.isVisible({ timeout: 500 }).catch(() => false))) {
      const startBtn = page.getByRole("button", { name: "Start Round", exact: true });
      if (await startBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await startBtn.click();
      }
    }
    return confirmBtn;
  }
  return action === "save" ? page.getByTestId("save-all-scores-button") : page.getByTestId("save-and-start-next-round-button");
}

export async function prepareAction(page: Page, action: SessionAction) {
  if (action !== "start") {
    await (await actionButton(page, "start")).click();
    await waitForAction(page, "start");
    await fillThreeScores(page);
  }
  return actionButton(page, action);
}

export async function waitForAction(page: Page, action: SessionAction) {
  if (action === "next") {
    await expect(page.getByRole("heading", { name: "Round 2", exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("spinbutton", { name: "Court 1 Team 1 score", exact: true })).toBeEnabled();
  } else {
    await expect(page.getByRole("heading", { name: "Round 1", exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('[data-testid^="court-match-"]')).toHaveCount(3);
    if (action === "save") for (let court = 1; court <= 3; court++) {
      await expect(page.getByTestId(`court-match-${court}`)).toContainText("Final", { timeout: 30_000 });
    }
  }
}

export async function scopedState(fixture: ResilienceFixture) {
  const { sql, accountIds } = fixture;
  const groups = [fixture.groupId, fixture.shadowGroupId];
  const [sessions, rounds, matches, snapshots, sits, attendance, accounts, players, chemistry, permissions] = await Promise.all([
    sql`select id, group_id, status, current_round_number, version, court_count, court_player_counts, stay_together_pairs
      from sessions where group_id = any(${groups}::text[]) order by id`,
    sql`select r.id, r.session_id, r.round_number, r.status, r.version, r.seed, r.score_breakdown, r.completed_at
      from rounds r join sessions s on s.id = r.session_id where s.group_id = any(${groups}::text[]) order by r.id`,
    sql`select m.id, m.round_id, m.court_number, m.status, m.team1_score, m.team2_score, m.version, m.rated, m.completed_at
      from matches m join rounds r on r.id = m.round_id join sessions s on s.id = r.session_id
      where s.group_id = any(${groups}::text[]) order by m.court_number`,
    sql`select mp.* from match_players mp join players p on p.id = mp.player_id
      where p.group_id = any(${groups}::text[]) order by mp.match_id, mp.team, mp.player_id`,
    sql`select rs.* from round_sits rs join players p on p.id = rs.player_id
      where p.group_id = any(${groups}::text[]) order by rs.round_id, rs.player_id`,
    sql`select a.* from session_attendance a join sessions s on s.id = a.session_id
      where s.group_id = any(${groups}::text[]) order by a.session_id, a.player_id`,
    sql`select id, initial_rating, rating, rated_games_played from player_accounts
      where id = any(${accountIds}::text[]) order by id`,
    sql`select id, group_id, account_id, active, initial_rating, rating, rated_games_played from players
      where account_id = any(${accountIds}::text[]) order by id`,
    sql`select account_id_1, account_id_2, matches_played, wins, synergy_score, weight_sum, contribution_sum, weight_sq_sum from player_synergy
      where account_id_1 = any(${accountIds}::text[]) or account_id_2 = any(${accountIds}::text[])
      order by account_id_1, account_id_2`,
    sql`select group_id, account_id from group_organizers where group_id = any(${groups}::text[]) order by group_id, account_id`,
  ]);
  return { sessions, rounds, matches, snapshots, sits, attendance, accounts, players, chemistry, permissions };
}

export async function assertCommitted(fixture: ResilienceFixture, action: SessionAction, before: Awaited<ReturnType<typeof scopedState>>) {
  const after = await scopedState(fixture);
  const completed = action === "next";
  expect(after.rounds).toHaveLength(completed ? 2 : 1);
  expect(after.matches).toHaveLength(completed ? 6 : 3);
  expect(after.snapshots).toHaveLength(completed ? 24 : 12);
  expect(new Set(after.snapshots.map(snapshot => snapshot.player_id)).size).toBe(12);
  expect(after.sits).toEqual(before.sits);
  expect(after.attendance).toEqual(before.attendance);
  expect(after.permissions).toEqual(before.permissions);
  const firstRound = after.rounds.find(round => round.round_number === 1)!;
  expect(firstRound.status).toBe(completed ? "completed" : "started");
  expect(after.sessions[0].current_round_number).toBe(completed ? 2 : 1);
  expect(after.sessions[0].version).toBe(Number(before.sessions[0].version) + (action === "save" ? 0 : 1));
  if (action !== "start") {
    const assignments = (snapshots: readonly (typeof after.snapshots)[number][]) => snapshots.map(member => ({
      match_id: member.match_id, player_id: member.player_id, team: member.team,
    }));
    expect(assignments(after.snapshots.filter(member => before.matches.some(match => match.id === member.match_id)))).toEqual(assignments(before.snapshots));
    expect(firstRound.seed).toBe(before.rounds[0].seed);
    expect(firstRound.score_breakdown).toEqual(before.rounds[0].score_breakdown);
  }
  for (const match of after.matches) {
    const pending = action === "start" || match.round_id !== firstRound.id;
    expect(match.status).toBe(pending ? "pending" : "completed");
    expect(match.version).toBe(pending ? 1 : 2);
    expect([match.team1_score, match.team2_score]).toEqual(pending ? [null, null] : [11, 5]);
  }
  if (completed) {
    const nextRound = after.rounds.find(round => round.round_number === 2)!;
    expect(nextRound.status).toBe("started");
    expect(nextRound.version).toBe(1);
    const members = after.snapshots.filter(member => after.matches.some(match => match.id === member.match_id && match.round_id === nextRound.id));
    expect(new Set(members.map(member => member.player_id)).size).toBe(12);
  }
  for (const account of after.accounts) {
    expect(account.rated_games_played).toBe(action === "start" ? 0 : 1);
    for (const alias of after.players.filter(player => player.account_id === account.id)) {
      expect(alias.rating).toBe(account.rating);
      expect(alias.rated_games_played).toBe(account.rated_games_played);
    }
  }
  for (const snapshot of after.snapshots) {
    const pending = action === "start" || !after.matches.some(match => match.id === snapshot.match_id && match.status === "completed");
    expect(snapshot.rating_before === null).toBe(pending);
    expect(snapshot.rating_after === null).toBe(pending);
  }
  expect(after.chemistry).toHaveLength(action === "next" ? 6 : 0);
  for (const chemistry of after.chemistry) expect(chemistry.matches_played).toBe(1);
  return after;
}

/** Real PostgreSQL exception, after at least part of the action transaction has run. */
export async function installFailure(fixture: ResilienceFixture, action: SessionAction) {
  const { sql } = fixture;
  // CREATE/DROP TRIGGER takes table locks, independently of the trigger's row
  // predicate. Serialize failure-fixture DDL across browser workers so the test
  // machinery itself cannot deadlock while real app transactions remain parallel.
  const lease = await sql.reserve();
  const ddl = lease as unknown as postgres.Sql;
  const unlock = async () => {
    try { await ddl`select pg_advisory_unlock(hashtextextended('pickleball:e2e:session-failure-ddl', 0))`; }
    finally { lease.release(); }
  };
  try { await ddl`select pg_advisory_lock(hashtextextended('pickleball:e2e:session-failure-ddl', 0))`; }
  catch (error) { lease.release(); throw error; }
  const name = `resilience_${randomUUID().replaceAll("-", "")}`;
  // Chemistry replays touch every account's aggregate. Do not put a trigger there:
  // an unrelated fixture replay could then trip this fixture's injected failure.
  const table = action === "next" ? "rounds" : "matches";
  const condition = action === "next"
    ? `NEW.session_id = '${fixture.sessionId.replaceAll("'", "''")}' AND NEW.status = 'completed'`
    : `NEW.court_number = 2 AND EXISTS (SELECT 1 FROM rounds WHERE id = NEW.round_id AND session_id = '${fixture.sessionId.replaceAll("'", "''")}')`;
  try {
    await ddl.unsafe(`CREATE FUNCTION public.${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF ${condition} THEN RAISE EXCEPTION 'Injected scoped session action failure'; END IF; RETURN NEW; END $$`);
    await ddl.unsafe(`CREATE TRIGGER ${name} AFTER INSERT OR UPDATE ON public.${table} FOR EACH ROW EXECUTE FUNCTION public.${name}()`);
  } catch (error) {
    try { await ddl.unsafe(`DROP FUNCTION IF EXISTS public.${name}() CASCADE`); }
    finally { await unlock(); }
    throw error;
  }
  return async () => {
    try {
      await ddl.unsafe(`DROP TRIGGER IF EXISTS ${name} ON public.${table}`);
      await ddl.unsafe(`DROP FUNCTION IF EXISTS public.${name}()`);
    } finally { await unlock(); }
  };
}

export function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

export async function closeSecondary(secondary: { context: BrowserContext } | undefined) {
  await secondary?.context.close();
}
