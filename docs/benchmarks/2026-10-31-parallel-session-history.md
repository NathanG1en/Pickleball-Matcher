# Parallel session-history reads

Implemented organizer benchmark recommendation 2 on `optimizations/organizer-session-actions`, alongside the existing batch-score optimization.

## What changed

`PostgresRepositories.listStartedRounds` still loads the session's rounds first. If there are none, it returns immediately after **one query**.

For populated history, matches, participants, and sitters now load concurrently with `Promise.all`. Participants are selected by joining through matches using the round IDs already loaded, removing their dependency on a prior match-ID lookup. The method still issues **four queries**, but they run in **two dependent stages** instead of four.

All queries continue to use `this.query`. A repository bound to a transaction keeps its reads on that transaction's connection; those statements remain queued on the single connection. Pooled reads outside transactions can run the three child queries concurrently. The pool size is unchanged.

The method preserves round order, court order, participant/sitter order, scores, snapshots, dates, versions, rated flags, and empty rounds. Child records are scoped to the captured round IDs, and the mapper still filters participants to matches actually returned.

## Controlled benchmark

| Completed session: 3 rounds, 18 matches | Previous | Optimized |
| --- | ---: | ---: |
| Samples | 7 | 7 |
| Median read time | 356 ms | 193 ms |
| Observed range | 296–378 ms | 148–227 ms |
| SQL statements | 4 | 4 |

Median latency fell by about **46%**, or **163 ms per history load**, in this environment. This is the repository read's timing, not a measured 46% improvement in every organizer action.

The benchmark used one stable, completed fixture on the Neon test branch and a ten-connection pool. It warmed connections and both implementations, alternated old/new order, and asserted **full returned-record equality on every measured read**, including dates, snapshots, and ordering. It issued SELECTs only. The baseline checkout was development commit `c6e4615`; the optimized method came from the current working branch.

Raw samples and summary: [session-history-reads.json](data/session-history-reads.json).

The earlier audit's prototype dispatched all four queries concurrently and used different projections in its first pass. This implementation keeps the initial round lookup to retain the one-query path for new/empty sessions and to anchor child reads to the known rounds. These timings should be compared with the matched baseline above, rather than treated as a continuation of the prototype's percentages.

## Tradeoffs and limits

- Outside transactions, one populated-history read can use up to three child-query connections concurrently. The existing pool limits total connections; contention under several organizers has not been load-tested.
- A session with rounds but no matches now executes an empty participant query. That case can use four statements instead of the previous three. Its records still return correctly.
- As before, a nontransactional read does not promise a single database snapshot across all queries. Mutations requiring transactional consistency still use their transaction-bound repository. This change does not add caching or relax mutation locks.
- No schema, UI, matchmaking, replay, or refresh changes were made for this recommendation.

## Verification

- A deterministic regression holds the first child query open and verifies that all three child reads start. It failed against the sequential implementation and passes with the change. It also checks that transaction-bound reads never escape to the general pool.
- PostgreSQL tests use connection-local temporary tables. Fixtures include out-of-order round IDs, ordered courts, rated/completed and unrated/cancelled/pending matches, nullable fields, rating snapshots, sitters, a round without children, an unrelated session, and sessions without rounds.
- A transaction test reads an uncommitted score update through the transaction connection, then verifies rollback restores the original history.
- The batch-score PostgreSQL regressions remain green, including the twelve-statement score-save budget, optimistic-conflict rollback, and historical chemistry.
- Existing desktop/mobile browser coverage saves scores, reloads history, rejects a stale tab, and advances to the next proposal using these reads.

Commands:

```sh
npm test
npm run typecheck
npm run lint
DATABASE_URL=postgresql://blocked:blocked@127.0.0.1:1/forbidden npm run test:integration -- tests/integration/session-history.test.ts tests/integration/batch-scores.test.ts
DATABASE_URL=postgresql://blocked:blocked@127.0.0.1:1/forbidden PLAYWRIGHT_PORT=3116 NEXT_DIST_DIR=.next-test/bulk-score-saving npx playwright test tests/e2e/bulk-score-saving.spec.ts
```

Repeat the read-only comparison with a completed test fixture and a checkout containing the old read implementation:

```sh
npx tsx scripts/benchmarks/session-history-reads.mjs SESSION_ID /absolute/path/to/baseline-checkout docs/benchmarks/data/session-history-reads.json
```

The harness requires the allowlisted test endpoint in `TEST_DATABASE_URL`. It stores only timings/counts and asserts the history comparison without dumping account or match data. No production database or migration is involved.
