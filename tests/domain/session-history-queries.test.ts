import type postgres from "postgres";
import { expect, it } from "vitest";
import { PostgresRepositories } from "@/lib/db/postgres-repositories";

const roundRow = { id: "round", session_id: "session", round_number: 1, status: "started", seed: "1",
  score_breakdown: { playingTime: 0, consecutiveSit: 0, partnerRepeat: 0, skillBalance: 0, opponentRepeat: 0, tieBreak: 0, total: 0 },
  created_at: new Date("2026-10-31T08:00:00Z"), started_at: new Date("2026-10-31T08:00:00Z"), completed_at: null, version: 1,
  match_rows: [], member_rows: [], sit_rows: [] };

it.each([false, true])("awaits one complete history snapshot on the selected connection (transaction: %s)", async transactional => {
  let release!: () => void;
  const blocked = new Promise<void>(resolve => { release = resolve; });
  let statements = 0;
  const query = (() => { statements++; return blocked.then(() => [roundRow]); }) as unknown as postgres.Sql;
  const forbiddenPool = (() => { throw new Error("Read escaped the transaction connection"); }) as unknown as postgres.Sql;
  const repository = transactional
    ? new PostgresRepositories(forbiddenPool, query as unknown as postgres.TransactionSql)
    : new PostgresRepositories(query);
  const result = repository.listStartedRounds("session");
  try { expect(statements).toBe(1); } finally { release(); }
  expect(await result).toEqual([{ round: { id: "round", sessionId: "session", roundNumber: 1,
    status: "started", seed: 1, scoreBreakdown: roundRow.score_breakdown,
    createdAt: roundRow.created_at, startedAt: roundRow.started_at, completedAt: null, version: 1 },
    matches: [], matchPlayers: [], sits: [] }]);
  expect(statements).toBe(1);
});

it.each([false, true])("propagates a history query failure from the selected connection (transaction: %s)", async transactional => {
  const failure = new Error("History read failed");
  const query = (() => Promise.reject(failure)) as unknown as postgres.Sql;
  const forbiddenPool = (() => { throw new Error("Read escaped the transaction connection"); }) as unknown as postgres.Sql;
  const repository = transactional
    ? new PostgresRepositories(forbiddenPool, query as unknown as postgres.TransactionSql)
    : new PostgresRepositories(query);
  await expect(repository.listStartedRounds("session")).rejects.toBe(failure);
});

it("returns an empty history in one query", async () => {
  let statements = 0;
  const query = (() => { statements++; return Promise.resolve([]); }) as unknown as postgres.Sql;
  expect(await new PostgresRepositories(query).listStartedRounds("empty")).toEqual([]);
  expect(statements).toBe(1);
});
