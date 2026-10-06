import postgres from "postgres";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { RepositoryConflictError } from "@/lib/db/postgres-repositories";
import { PostgresRepositories } from "@/lib/db/postgres-repositories";
import type { StartedRoundRecord } from "@/lib/domain/types";

const sql = postgres(
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  { prepare: false, onnotice: () => undefined },
);
const repository = new PostgresRepositories(sql);

const scoreBreakdown = {
  playingTime: 0,
  consecutiveSit: 0,
  partnerRepeat: 0,
  skillBalance: 0,
  opponentRepeat: 0,
  tieBreak: 0,
  total: 0,
};

async function seedPlayers() {
  await sql`insert into groups (id, name, organizer_pin_hash, public_share_id)
            values ('group-1', 'Tuesday Pickleball', 'hash', 'share-1')`;
  await sql`insert into players (id, group_id, name) values
            ('a', 'group-1', 'A'), ('b', 'group-1', 'B'),
            ('c', 'group-1', 'C'), ('d', 'group-1', 'D')`;
}

function roundRecord(): StartedRoundRecord {
  const now = new Date("2026-10-06T12:00:00.000Z");
  return {
    round: {
      id: "round-1",
      sessionId: "session-1",
      roundNumber: 1,
      status: "started",
      seed: 1,
      scoreBreakdown,
      createdAt: now,
      startedAt: now,
      completedAt: null,
      version: 1,
    },
    matches: [
      {
        id: "match-1",
        roundId: "round-1",
        courtNumber: 1,
        status: "pending",
        team1Score: null,
        team2Score: null,
        completedAt: null,
        version: 1,
      },
    ],
    matchPlayers: [
      { matchId: "match-1", playerId: "a", team: 1, ratingBefore: null, ratingAfter: null },
      { matchId: "match-1", playerId: "b", team: 1, ratingBefore: null, ratingAfter: null },
      { matchId: "match-1", playerId: "c", team: 2, ratingBefore: null, ratingAfter: null },
      { matchId: "match-1", playerId: "d", team: 2, ratingBefore: null, ratingAfter: null },
    ],
    sits: [],
  };
}

describe("PostgresRepositories", () => {
  beforeEach(async () => {
    await sql`truncate groups cascade`;
    await seedPlayers();
  });

  afterAll(async () => {
    await sql.end();
  });

  it("rolls back an incomplete round start", async () => {
    await repository.insertSession(
      {
        id: "session-1",
        groupId: "group-1",
        courtCount: 1,
        status: "active",
        currentRoundNumber: 0,
        startedAt: new Date("2026-10-06T12:00:00.000Z"),
        endedAt: null,
        version: 1,
      },
      [],
    );
    const valid = roundRecord();
    const invalid: StartedRoundRecord = {
      ...valid,
      matchPlayers: valid.matchPlayers.map((member, index) =>
        index === 3 ? { ...member, team: 3 as 1 } : member,
      ),
    };

    await expect(
      repository.transaction((transaction) => transaction.insertStartedRound(invalid)),
    ).rejects.toBeDefined();

    expect(await sql`select id from rounds`).toHaveLength(0);
    expect(await sql`select id from matches`).toHaveLength(0);
  });

  it("rejects a stale aggregate version without changing the session", async () => {
    const session = {
      id: "session-1",
      groupId: "group-1",
      courtCount: 1,
      status: "active" as const,
      currentRoundNumber: 0,
      startedAt: new Date("2026-10-06T12:00:00.000Z"),
      endedAt: null,
      version: 1,
    };
    await repository.insertSession(session, []);
    await repository.updateSession({ ...session, currentRoundNumber: 1, version: 2 });

    await expect(
      repository.updateSession({ ...session, currentRoundNumber: 2, version: 2 }),
    ).rejects.toBeInstanceOf(RepositoryConflictError);
    await expect(repository.getSession("session-1")).resolves.toMatchObject({
      currentRoundNumber: 1,
      version: 2,
    });
  });

  it("treats a repeated round ID as an idempotent insert", async () => {
    await repository.insertSession(
      {
        id: "session-1",
        groupId: "group-1",
        courtCount: 1,
        status: "active",
        currentRoundNumber: 0,
        startedAt: new Date("2026-10-06T12:00:00.000Z"),
        endedAt: null,
        version: 1,
      },
      [],
    );
    const record = roundRecord();

    await repository.transaction((transaction) => transaction.insertStartedRound(record));
    await repository.transaction((transaction) => transaction.insertStartedRound(record));

    expect(await sql`select id from rounds where id = 'round-1'`).toHaveLength(1);
    expect(await sql`select id from matches where id = 'match-1'`).toHaveLength(1);
  });

  it("returns replay matches in completion-time then ID order", async () => {
    await repository.insertSession(
      {
        id: "session-1",
        groupId: "group-1",
        courtCount: 1,
        status: "active",
        currentRoundNumber: 0,
        startedAt: new Date("2026-10-06T12:00:00.000Z"),
        endedAt: null,
        version: 1,
      },
      [],
    );
    const base = roundRecord();
    const first: StartedRoundRecord = {
      ...base,
      matches: [
        {
          ...base.matches[0],
          id: "match-b",
          status: "completed",
          team1Score: 11,
          team2Score: 7,
          completedAt: new Date("2026-10-06T12:05:00.000Z"),
        },
      ],
      matchPlayers: base.matchPlayers.map((item) => ({ ...item, matchId: "match-b" })),
    };
    const second: StartedRoundRecord = {
      ...first,
      round: { ...first.round, id: "round-2", roundNumber: 2 },
      matches: [{ ...first.matches[0], id: "match-a", roundId: "round-2" }],
      matchPlayers: first.matchPlayers.map((item) => ({ ...item, matchId: "match-a" })),
    };
    await repository.transaction((transaction) => transaction.insertStartedRound(first));
    await repository.transaction((transaction) => transaction.insertStartedRound(second));

    const matches = await repository.listReplayMatches("group-1");

    expect(matches.map((match) => match.id)).toEqual(["match-a", "match-b"]);
  });
});
