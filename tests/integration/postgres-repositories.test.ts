import postgres from "postgres";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { RepositoryConflictError } from "@/lib/db/postgres-repositories";
import { PostgresRepositories } from "@/lib/db/postgres-repositories";
import type { StartedRoundRecord, TournamentRecord } from "@/lib/domain/types";

const testDbUrl = process.env.TEST_DATABASE_URL;
if (!testDbUrl) {
  throw new Error("TEST_DATABASE_URL is required to run postgres repositories tests.");
}

const sql = postgres(
  testDbUrl || "",
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
  await sql`insert into groups (id, name, organizer_pin_hash)
            values ('group-1', 'Tuesday Pickleball', 'hash')`;
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
    await sql`truncate groups, player_accounts cascade`;
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

  it("writes round, matches, members and sits in two statements inside the caller transaction", async () => {
    await repository.insertSession({
      id: "session-1", groupId: "group-1", courtCount: 1, status: "active",
      currentRoundNumber: 0, startedAt: new Date("2026-10-06T12:00:00Z"), endedAt: null, version: 1,
    }, []);
    await sql`insert into players (id, group_id, name) values ('sitting', 'group-1', 'Sitting')`;
    let capture = false;
    let statements = 0;
    const client = postgres(testDbUrl!, { prepare: true, onnotice: () => {}, debug: () => { if (capture) statements++; } });
    try {
      const isolated = new PostgresRepositories(client);
      const record = { ...roundRecord(), sits: [{ roundId: "round-1", playerId: "sitting" }] };
      await isolated.transaction(async transaction => {
        capture = true;
        try { await transaction.insertStartedRound(record); } finally { capture = false; }
      });
      expect(statements).toBe(2);
      const [persisted] = await isolated.listStartedRounds("session-1");
      expect(persisted.round).toEqual(record.round);
      expect(persisted.matches).toEqual(record.matches.map(match => ({ ...match, rated: true })));
      expect(persisted.matchPlayers).toEqual(record.matchPlayers);
      expect(persisted.sits).toEqual(record.sits);
    } finally { await client.end(); }
  });

  it("persists rounds with no children and preserves idempotent early return for an ignored invalid payload", async () => {
    await repository.insertSession({
      id: "session-1", groupId: "group-1", courtCount: 1, status: "active",
      currentRoundNumber: 0, startedAt: new Date("2026-10-06T12:00:00Z"), endedAt: null, version: 1,
    }, []);
    const record = { ...roundRecord(), matches: [], matchPlayers: [], sits: [] };
    await repository.transaction(transaction => transaction.insertStartedRound(record));
    // The existing-ID check must ignore the replacement payload entirely.
    const ignored = { ...roundRecord(), round: { ...record.round, roundNumber: -1 },
      matches: [{ ...roundRecord().matches[0], courtNumber: -1 }] };
    await repository.transaction(transaction => transaction.insertStartedRound(ignored));
    const [persisted] = await repository.listStartedRounds("session-1");
    expect(persisted).toEqual({ round: record.round, matches: [], matchPlayers: [], sits: [] });
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

  it("loads ordered history in one command while preserving empty rounds, dates, nulls and numeric boundaries", async () => {
    await repository.insertSession({
      id: "session-1", groupId: "group-1", courtCount: 2, status: "active",
      currentRoundNumber: 0, startedAt: new Date("2026-10-06T12:00:00Z"), endedAt: null, version: 1,
    }, []);
    await sql`insert into players (id, group_id, name) values ('sitting', 'group-1', 'Sitting')`;
    const base = roundRecord();
    const completedAt = new Date("2026-10-06T12:05:00.123Z");
    const matches = [
      { ...base.matches[0], id: "history-match-z", roundId: "history-round-z", rated: true,
        status: "completed" as const, team1Score: 11, team2Score: 7, completedAt },
      { ...base.matches[0], id: "history-match-a", roundId: "history-round-z", courtNumber: 2, rated: false },
    ];
    const members = matches.flatMap((match, court) => base.matchPlayers.map((member, index) => ({
      ...member, matchId: match.id, ratingBefore: court === 0 && index === 0 ? Infinity : null,
      ratingAfter: court === 0 && index === 0 ? NaN : null,
    })));
    const first: StartedRoundRecord = { round: { ...base.round, id: "history-round-z" },
      matches, matchPlayers: [...members].reverse(), sits: [{ roundId: "history-round-z", playerId: "sitting" }] };
    const second: StartedRoundRecord = { round: { ...base.round, id: "history-round-a", roundNumber: 2 }, matches: [], matchPlayers: [], sits: [] };
    await repository.transaction(async transaction => {
      await transaction.insertStartedRound(first);
      await transaction.insertStartedRound(second);
    });
    let capture = false;
    let statements = 0;
    const client = postgres(testDbUrl!, { prepare: true, onnotice: () => {}, debug: () => { if (capture) statements++; } });
    try {
      const isolated = new PostgresRepositories(client);
      const result = await isolated.transaction(async transaction => {
        capture = true;
        try { return await transaction.listStartedRounds("session-1"); } finally { capture = false; }
      });
      expect(statements).toBe(1);
      expect(result).toEqual([{ ...first, matchPlayers: members.toSorted((a, b) => a.matchId.localeCompare(b.matchId) || a.team - b.team || a.playerId.localeCompare(b.playerId)) }, second]);
      expect(result[0].matches[0].completedAt).toBeInstanceOf(Date);
      expect(result[0].matches[0].completedAt?.getTime()).toBe(completedAt.getTime());
      expect(result[0].matchPlayers.find(member => member.matchId === matches[0].id && member.playerId === "a")?.ratingBefore).toBe(Infinity);
      expect(Number.isNaN(result[0].matchPlayers.find(member => member.matchId === matches[0].id && member.playerId === "a")?.ratingAfter)).toBe(true);
      expect(await isolated.listStartedRounds("missing")).toEqual([]);
    } finally { await client.end(); }
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

  it("preserves replay filtering, complete doubles teams, ordering and chemistry eligibility", async () => {
    const time = new Date("2026-10-06T12:05:00.000Z");
    for (const id of ["normal", "open"]) {
      await repository.insertSession({
        id, groupId: "group-1", courtCount: 1, status: "active",
        type: id === "open" ? "open_play" : "regular",
        currentRoundNumber: 0, startedAt: time, endedAt: null, version: 1,
      }, []);
    }
    let roundNumber = 0;
    const insert = async (id: string, options: {
      status?: "completed" | "cancelled" | "pending";
      rated?: boolean; completedAt?: Date | null; sessionId?: string;
      completedRound?: boolean; teams?: readonly (1 | 2)[];
    } = {}) => {
      const base = roundRecord();
      const sessionId = options.sessionId ?? "normal";
      const completedAt = options.completedAt === undefined ? time : options.completedAt;
      const teams = options.teams ?? [1, 1, 2, 2];
      await repository.transaction(transaction => transaction.insertStartedRound({
        round: { ...base.round, id: `round-${id}`, sessionId, roundNumber: ++roundNumber,
          status: options.completedRound ? "completed" : "started" },
        matches: [{ ...base.matches[0], id, roundId: `round-${id}`,
          status: options.status ?? "completed", rated: options.rated ?? true,
          team1Score: options.status === "cancelled" ? null : 11,
          team2Score: options.status === "cancelled" ? null : 7, completedAt }],
        // Reverse insertion order deliberately; replay teams are sorted by ID.
        matchPlayers: base.matchPlayers.slice(0, teams.length).map((member, index) => ({
          ...member, matchId: id, team: teams[index],
        })).reverse(), sits: [],
      }));
    };
    await insert("z-completed", { completedRound: true });
    await insert("a-started");
    await insert("b-cancelled", { status: "cancelled", completedRound: true });
    await insert("c-open", { sessionId: "open" });
    await insert("early", { completedAt: new Date(time.getTime() - 60_000) });
    await insert("skip-unrated", { rated: false });
    await insert("skip-pending", { status: "pending" });
    await insert("skip-no-time", { status: "cancelled", completedAt: null });
    await insert("skip-singles", { teams: [1, 2] });
    await insert("skip-uneven", { teams: [1, 2, 2, 2] });
    await insert("skip-empty", { teams: [] });
    const replay = await repository.listReplayMatches("group-1");
    expect(replay).toEqual([
      ["early", false, "completed"], ["a-started", false, "completed"],
      ["b-cancelled", true, "cancelled"], ["c-open", true, "completed"],
      ["z-completed", true, "completed"],
    ].map(([id, synergyEligible, status]) => ({
      id, groupId: "group-1", synergyEligible, status,
      completedAt: id === "early" ? new Date(time.getTime() - 60_000) : time,
      team1: ["a", "b"], team2: ["c", "d"],
      team1Score: status === "cancelled" ? 0 : 11,
      team2Score: status === "cancelled" ? 0 : 7,
    })));
    expect(await repository.listReplayMatches()).toEqual(replay);
    expect(await repository.listReplayMatches("other-group")).toEqual([]);
  });

  it("creates, reads, and updates tournaments with JSON serialization", async () => {
    const tournament = {
      id: "tr_test_1",
      groupId: "group-1",
      name: "Summer Championship",
      status: "active" as const,
      divisions: ["mens_singles" as const, "womens_doubles" as const],
      brackets: {
        mens_singles: {
          division: "mens_singles" as const,
          participants: [
            { id: "a", name: "A", playerIds: ["a"] },
            { id: "b", name: "B", playerIds: ["b"] },
          ],
          matches: [],
          roundNames: ["Finals"],
        },
      },
      createdAt: new Date("2026-10-10T12:00:00.000Z"),
      updatedAt: new Date("2026-10-10T12:00:00.000Z"),
    };

    await repository.createTournament(tournament);

    const fetched = await repository.getTournament("tr_test_1");
    expect(fetched).not.toBeNull();
    expect(fetched?.name).toBe("Summer Championship");
    expect(fetched?.divisions).toEqual(["mens_singles", "womens_doubles"]);
    expect(fetched?.brackets["mens_singles"]?.participants.length).toBe(2);

    const list = await repository.listTournaments("group-1");
    expect(list.some((t) => t.id === "tr_test_1")).toBe(true);
  });

  it("creates, retrieves, and updates a team tournament with teamData", async () => {
    const teamTournament: TournamentRecord = {
      id: "tr_team_test_1",
      groupId: "group-1",
      name: "Battle of the Dink",
      status: "active",
      format: "team_dual",
      divisions: [],
      brackets: {},
      teamData: {
        pairs: [{ id: "pr_1", player1Id: "a", player2Id: "b" }],
        teams: [
          { id: "t1", name: "Team Red", color: "#ef4444", pairIds: ["pr_1"], soloPlayerIds: [] },
          { id: "t2", name: "Team Blue", color: "#3b82f6", pairIds: [], soloPlayerIds: ["c", "d"] },
        ],
        lines: [
          {
            id: "line_1",
            lineNumber: 1,
            name: "Line 1 - Doubles",
            type: "doubles",
            team1PlayerIds: ["a", "b"],
            team2PlayerIds: ["c", "d"],
            team1Score: 11,
            team2Score: 9,
            status: "completed",
          },
        ],
        format: "dual_meet",
        scoringType: "games_won",
      },
      createdAt: new Date("2026-10-24T12:00:00.000Z"),
      updatedAt: new Date("2026-10-24T12:00:00.000Z"),
    };

    await repository.createTournament(teamTournament);

    const fetched = await repository.getTournament("tr_team_test_1");
    expect(fetched).not.toBeNull();
    expect(fetched?.name).toBe("Battle of the Dink");
    expect(fetched?.format).toBe("team_dual");
    expect(fetched?.teamData?.teams.length).toBe(2);
    expect(fetched?.teamData?.lines[0]?.status).toBe("completed");
    expect(fetched?.teamData?.lines[0]?.team1Score).toBe(11);

    const updated = {
      ...teamTournament,
      name: "Battle of the Dink - Finals",
      status: "completed" as const,
      updatedAt: new Date("2026-10-24T13:00:00.000Z"),
    };
    await repository.updateTournament(updated);

    const fetchedUpdated = await repository.getTournament("tr_team_test_1");
    expect(fetchedUpdated?.name).toBe("Battle of the Dink - Finals");
    expect(fetchedUpdated?.status).toBe("completed");
  });

  it("deletes a guest player with 0 matches/games from the database when removed", async () => {
    await repository.createPlayer({
      id: "guest-zero",
      groupId: "group-1",
      name: "Guest Zero",
      initialRating: 1000,
      rating: 1000,
      ratedGamesPlayed: 0,
      active: true,
    });

    const removed = await repository.removePlayerFromGroup("guest-zero", "group-1");
    expect(removed).toBe(true);

    const rows = await sql`select id from players where id = 'guest-zero'`;
    expect(rows).toHaveLength(0);
  });

  it("soft-deletes a guest player who has played games when removed", async () => {
    await repository.createPlayer({
      id: "guest-played",
      groupId: "group-1",
      name: "Guest Played",
      initialRating: 1000,
      rating: 1050,
      ratedGamesPlayed: 2,
      active: true,
    });

    const removed = await repository.removePlayerFromGroup("guest-played", "group-1");
    expect(removed).toBe(true);

    const rows = await sql`select id, active from players where id = 'guest-played'`;
    expect(rows).toHaveLength(1);
    expect(rows[0].active).toBe(false);
  });

  it("soft-deletes a registered account player when removed even with 0 games", async () => {
    await sql`insert into player_accounts (id, username, name, password_hash, skill_level, initial_rating, rating, rated_games_played)
              values ('acc-member', 'member', 'Member User', 'hash', 'intermediate', 1000, 1000, 0)`;

    await repository.createPlayer({
      id: "player-member",
      groupId: "group-1",
      name: "Member User",
      initialRating: 1000,
      rating: 1000,
      ratedGamesPlayed: 0,
      active: true,
      accountId: "acc-member",
    });

    const removed = await repository.removePlayerFromGroup("player-member", "group-1");
    expect(removed).toBe(true);

    const rows = await sql`select id, active from players where id = 'player-member'`;
    expect(rows).toHaveLength(1);
    expect(rows[0].active).toBe(false);
  });
});

