import postgres from "postgres";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

const sql = postgres(
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  { prepare: false, onnotice: () => undefined },
);

async function seedCore() {
  await sql`insert into groups (id, name, organizer_pin_hash, public_share_id)
            values ('group-1', 'Tuesday Pickleball', 'hash', 'share-1')`;
  await sql`insert into players (id, group_id, name) values
            ('a', 'group-1', 'A'), ('b', 'group-1', 'B'),
            ('c', 'group-1', 'C'), ('d', 'group-1', 'D')`;
  await sql`insert into sessions (id, group_id, court_count, status)
            values ('session-1', 'group-1', 1, 'active')`;
  await sql`insert into rounds (id, session_id, round_number, status, seed, score_breakdown, started_at)
            values ('round-1', 'session-1', 1, 'started', 1, '{}', now())`;
  await sql`insert into matches (id, round_id, court_number, status)
            values ('match-1', 'round-1', 1, 'pending')`;
}

describe("initial PostgreSQL schema", () => {
  beforeEach(async () => {
    await sql`truncate groups cascade`;
    await seedCore();
  });

  afterAll(async () => {
    await sql.end();
  });

  it("enforces foreign keys", async () => {
    await expect(
      sql`insert into players (id, group_id, name) values ('orphan', 'missing', 'Orphan')`,
    ).rejects.toMatchObject({ code: "23503" });
  });

  it("enforces unique round numbers and court numbers", async () => {
    await expect(
      sql`insert into rounds (id, session_id, round_number, status, seed, score_breakdown, started_at)
          values ('round-duplicate', 'session-1', 1, 'started', 2, '{}', now())`,
    ).rejects.toMatchObject({ code: "23505" });
    await expect(
      sql`insert into matches (id, round_id, court_number, status)
          values ('match-duplicate', 'round-1', 1, 'pending')`,
    ).rejects.toMatchObject({ code: "23505" });
  });

  it("enforces valid statuses, team numbers, and non-tied completed scores", async () => {
    await expect(
      sql`insert into match_players (match_id, player_id, team)
          values ('match-1', 'a', 3)`,
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      sql`update matches set status = 'completed', team1_score = 11, team2_score = 11,
          completed_at = now()
          where id = 'match-1'`,
    ).rejects.toMatchObject({ code: "23514" });
  });

  it("allows each player only one match membership and one sit per round", async () => {
    await sql`insert into match_players (match_id, player_id, team)
              values ('match-1', 'a', 1)`;
    await expect(
      sql`insert into match_players (match_id, player_id, team)
          values ('match-1', 'a', 2)`,
    ).rejects.toMatchObject({ code: "23505" });
    await sql`insert into round_sits (round_id, player_id) values ('round-1', 'b')`;
    await expect(
      sql`insert into round_sits (round_id, player_id) values ('round-1', 'b')`,
    ).rejects.toMatchObject({ code: "23505" });
  });

  it("denies direct anonymous writes through row-level security", async () => {
    await expect(
      sql.begin(async (transaction) => {
        await transaction.unsafe("set local role anon");
        await transaction.unsafe(
          "insert into groups (id, name, organizer_pin_hash, public_share_id) values ('group-anon', 'Nope', 'hash', 'share-anon')",
        );
      }),
    ).rejects.toBeDefined();
  });
});
