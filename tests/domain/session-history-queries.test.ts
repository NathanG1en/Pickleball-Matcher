import type postgres from "postgres";
import { expect, it } from "vitest";
import { PostgresRepositories } from "@/lib/db/postgres-repositories";

const roundRow = { id: "round", session_id: "session", round_number: 1, status: "started", seed: "1",
  score_breakdown: { playingTime: 0, consecutiveSit: 0, partnerRepeat: 0, skillBalance: 0, opponentRepeat: 0, tieBreak: 0, total: 0 },
  created_at: new Date("2026-10-31T08:00:00Z"), started_at: new Date("2026-10-31T08:00:00Z"), completed_at: null, version: 1 };

it.each([false, true])("starts all independent history reads before waiting for any child result (transaction: %s)", async transactional => {
  let release!: () => void;
  const blockedChildren = new Promise<void>(resolve => { release = resolve; });
  let started = 0;
  let allStarted!: () => void;
  const childrenStarted = new Promise<void>(resolve => { allStarted = resolve; });
  // Controlled SQL boundary: the real repository must dispatch work while its
  // first child request is still blocked. No timing thresholds or database mocks
  // of repository methods are needed.
  const query = ((strings: TemplateStringsArray) => {
    if (!strings.raw) return {}; // postgres's identifier/value-list builder
    if (strings.join(" ").includes("from rounds where")) return Promise.resolve([roundRow]);
    started++;
    if (started === 3) allStarted();
    return blockedChildren.then(() => []);
  }) as unknown as postgres.Sql;
  const forbiddenPool = (() => { throw new Error("Read escaped the transaction connection"); }) as unknown as postgres.Sql;
  const repository = transactional
    ? new PostgresRepositories(forbiddenPool, query as unknown as postgres.TransactionSql)
    : new PostgresRepositories(query);
  const result = repository.listStartedRounds("session");
  try {
    const progress = await Promise.race([childrenStarted.then(() => "dispatched"), new Promise<string>(resolve => setImmediate(() => resolve("blocked")))]);
    expect(progress).toBe("dispatched");
  } finally { release(); }
  const records = await result;
  expect(records[0]).toMatchObject({ round: { id: "round", seed: 1 }, matches: [], matchPlayers: [], sits: [] });
});

it("does not dispatch child queries for a session without rounds", async () => {
  let statements = 0;
  const query = (() => { statements++; return Promise.resolve([]); }) as unknown as postgres.Sql;
  expect(await new PostgresRepositories(query).listStartedRounds("empty")).toEqual([]);
  expect(statements).toBe(1);
});
