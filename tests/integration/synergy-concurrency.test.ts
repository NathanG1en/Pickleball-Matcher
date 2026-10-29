import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { PostgresRepositories } from "@/lib/db/postgres-repositories";
import { SessionService } from "@/lib/domain/session-service";
import { submitOpenPlayGameAction, updateOpenPlayGameAction, endOpenPlaySessionAction } from "@/app/actions/open-play";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/app/actions/action-context", async importOriginal => ({
  ...await importOriginal<typeof import("@/app/actions/action-context")>(),
  getActionRepository: () => repository,
  getActivePlayerAccountId: async () => "account-a",
  getActiveOrganizerSession: async () => null,
  requireOrganizer: async () => null,
}));

const schema = `chemistry_concurrency_${randomUUID().replaceAll("-", "")}`;
// Use a direct test connection: poolers may override startup search_path.
const testUrl = new URL(process.env.TEST_DATABASE_URL!);
testUrl.hostname = testUrl.hostname.replace("-pooler", "");
const connectionString = testUrl.toString();
const admin = postgres(connectionString, { max: 1, prepare: false, onnotice: () => {} });
const sql = postgres(connectionString, { max: 3, max_lifetime: 0, prepare: false, onnotice: () => {},
  connection: { search_path: schema, application_name: schema } });
const repository = new PostgresRepositories(sql);
const service = new SessionService(repository, {
  now: () => new Date(), nextId: kind => `${kind}_${randomUUID()}`, nextSeed: () => 1,
});

beforeAll(async () => {
  // Clone table definitions only. All test data and writes stay in this owned schema.
  await admin.unsafe(`create schema "${schema}"`);
  for (const table of ["groups", "player_accounts", "players", "group_organizers", "sessions", "session_attendance", "rounds", "matches", "match_players", "round_sits", "player_synergy"]) {
    await admin.unsafe(`create table "${schema}"."${table}" (like public."${table}" including all)`);
  }
  // Set and verify each direct connection explicitly before any fixture writes.
  const connections = await Promise.all([sql.reserve(), sql.reserve(), sql.reserve()]);
  try {
    for (const connection of connections) {
      await connection.unsafe(`set search_path to "${schema}"`);
      await connection`select set_config('application_name', ${schema}, false)`;
      const [identity] = await connection`select current_schema() as schema`;
      if (identity.schema !== schema) throw new Error("Test schema isolation failed; refusing fixture writes.");
    }
  } finally {
    connections.forEach(connection => connection.release());
  }
});
afterAll(async () => {
  await sql.end();
  // The generated, fixed-prefix identifier can refer only to this test's schema.
  await admin.unsafe(`drop schema if exists "${schema}" cascade`);
  await admin.end();
});

it("serializes a normal correction behind an Open Play edit before taking player or match-player locks", async () => {
  for (const groupId of ["normal", "open"]) {
    await repository.insertGroup({ id: groupId, name: groupId, organizerPinHash: "fixture", ownerAccountId: "account-a", createdAt: new Date() });
  }
  for (const id of ["a", "b", "c", "d"]) {
    await repository.createPlayerAccount({ id: `account-${id}`, username: id, name: id,
      passwordHash: "fixture", skillLevel: "intermediate", initialRating: 1000, createdAt: new Date() });
    for (const groupId of ["normal", "open"]) {
      await repository.createPlayer({ id: `${groupId}-${id}`, groupId, accountId: `account-${id}`, name: id,
        initialRating: 1000, rating: 1000, ratedGamesPlayed: 0, active: true });
    }
  }
  const session = await service.startSession({ groupId: "normal", courtCount: 1,
    playerIds: ["a", "b", "c", "d"].map(id => `normal-${id}`) });
  const proposal = await service.proposeRound(session.id, 1);
  const round = await service.startRound(session.id, proposal);
  const match = (await repository.listStartedRounds(session.id))[0].matches[0];
  await service.recordResult({ matchId: match.id, team1Score: 11, team2Score: 5 });
  await service.completeRound(round.id);
  await repository.insertSession({ id: "open-session", groupId: "open", type: "open_play", status: "active", courtCount: 1,
    currentRoundNumber: 1, version: 1, startedAt: new Date(), endedAt: null },
  ["a", "b", "c", "d"].map(id => ({ sessionId: "open-session", playerId: `open-${id}`, joinedRound: 1, leftRound: null })));
  const gameInput = { groupId: "open", sessionId: "open-session", team1PlayerIds: ["open-a", "open-b"],
    team2PlayerIds: ["open-c", "open-d"], team1Score: 11, team2Score: 5 };
  const submitted = await submitOpenPlayGameAction(gameInput);
  if (!submitted.ok) throw new Error(submitted.error);

  let entered = false;
  let resume!: () => void;
  const paused = new Promise<void>(resolve => { resume = resolve; });
  const original = PostgresRepositories.prototype.updateMatchPlayers;
  const hook = vi.spyOn(PostgresRepositories.prototype, "updateMatchPlayers").mockImplementationOnce(async function (this: PostgresRepositories, matchId, members) {
    await original.call(this, matchId, members);
    entered = true;
    await paused;
  });
  try {
    const edit = updateOpenPlayGameAction({ ...gameInput, matchId: submitted.data.id, team1Score: 5, team2Score: 11 });
    await expect.poll(() => entered, { timeout: 5000 }).toBe(true);
    const correction = service.recordResult({ matchId: match.id, team1Score: 5, team2Score: 11 });
    await expect.poll(async () => {
      const waiting = await admin`select 1 from pg_stat_activity where application_name = ${schema} and wait_event_type = 'Lock'`;
      return waiting.length;
    }, { timeout: 5000 }).toBeGreaterThan(0);
    resume();
    const [savedEdit, savedCorrection] = await Promise.all([edit, correction]);
    expect(savedEdit.ok).toBe(true);
    expect(savedCorrection).toMatchObject({ team1Score: 5, team2Score: 11 });
    const pairs = await repository.listPairSynergies(["account-a", "account-b", "account-c", "account-d"]);
    expect(pairs.reduce((sum, pair) => sum + pair.matchesPlayed, 0)).toBe(4);
  } finally {
    resume();
    hook.mockRestore();
  }
}, 30_000);

it("finishes Open Play and replays chemistry inside the same transaction", async () => {
  await repository.insertGroup({ id: "completion", name: "Completion fixture", organizerPinHash: "fixture", createdAt: new Date() });
  await repository.insertSession({ id: "completion-session", groupId: "completion", type: "open_play", status: "active", courtCount: 1,
    currentRoundNumber: 1, version: 1, startedAt: new Date(), endedAt: null }, []);
  await repository.insertStartedRound({ round: { id: "completion-round", sessionId: "completion-session", roundNumber: 1, status: "started", seed: 1,
    scoreBreakdown: { playingTime: 0, consecutiveSit: 0, partnerRepeat: 0, skillBalance: 0, opponentRepeat: 0, tieBreak: 0, total: 0 },
    createdAt: new Date(), startedAt: new Date(), completedAt: null, version: 1 }, matches: [], matchPlayers: [], sits: [] });
  const accounts = ["account-a", "account-b", "account-c", "account-d"];
  const before = await repository.listPairSynergies(accounts);
  const result = await endOpenPlaySessionAction({ groupId: "completion", sessionId: "completion-session" });
  expect(result).toMatchObject({ ok: true, data: { status: "completed", version: 2 } });
  expect(await repository.getSession("completion-session")).toMatchObject({ status: "completed" });
  expect((await repository.listStartedRounds("completion-session"))[0].round.status).toBe("completed");
  expect(await repository.listPairSynergies(accounts)).toEqual(before);
});
