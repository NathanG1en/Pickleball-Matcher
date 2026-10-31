# Focused Next Round completion read

`completeRound` previously fetched the round and then loaded the entire session's rounds, matches, match participants, and sitters to find the round it was finishing. It now calls `getRoundCompletionContext(roundId)` once inside the existing transaction, after taking the existing chemistry lock.

The context contains the current round and only pending matches, including their participant counts. PostgreSQL uses one statement with a left join, preserving a round that has no pending matches. A missing round still returns the existing `NOT_FOUND` error. The SQLite simulation and in-memory adapters implement the same contract.

## Behavior and concurrency

- Pending matches with exactly two participants are cancelled, preserving the existing unscored-singles behavior.
- Other pending participant counts still reject completion with `UNRESOLVED_MATCHES`, including 2v1 and doubles.
- Completed/cancelled matches and other rounds are excluded from this validation read.
- Empty rounds and rounds whose matches are all resolved can still complete.
- Match/round version-checked writes, the transaction connection, global chemistry lock, chemistry replay, authorization, and server revalidation remain in place.
- An error after singles cancellation or round completion rolls the transaction back. Ratings and completed scores retain the existing behavior.

Full history is still available for matchmaking, chemistry replay, and history display. There is no schema migration, cache, larger connection pool, additional background task, or search-budget change. The client workflow is unchanged.

## Controlled measurement

| Backend completion | Previous | Focused read |
| --- | ---: | ---: |
| Validation/context reads | 5 | 1 |
| Total SQL executions | 14 | 10 |
| Median, 15 observations | 1,061 ms | 634 ms |
| Observed range | 973–1,556 ms | 599–966 ms |

The median backend completion time fell by approximately **40% (426 ms)** in this controlled run.

The fixture has 16 accounts, four courts, and ten historical rounds, including unrated and cancelled games. Each timed call completes the final resolved round. There is one warmup per variant and fifteen observations per variant, alternating order on one direct Neon test connection. The legacy read is reproduced with `getRound` plus `listStartedRounds`; the rest of the completion service is identical.

Every observation asserts equality of the returned completed round and persisted source matches, ratings, snapshots, and chemistry. Resetting the target round happens outside the timed interval. All writes use connection-local temporary tables shadowing application tables; isolation is checked before seeding, and closing the connection discards the fixture. No persistent test, development, production, or A/B playground rows are changed by the benchmark.

These are backend completion timings, **not** a before/after measurement of the complete browser Next Round interaction. The latter also includes authorization, chemistry/history work, rendering, and transport. This optimization removes four round trips and stops validation payload size from growing with earlier session rounds; actual deployed savings need a comparable browser measurement. Multi-session capacity was not tested.

Raw observations: [round-completion.json](data/round-completion.json).

Repeat on the allowlisted direct test endpoint:

```sh
npx tsx scripts/benchmarks/round-completion.mjs 15
```

## Verification

- New focused regressions failed on the old service/read API, then passed after implementation.
- 670 unit/component tests pass, including 16 focused in-memory/SQLite checks.
- 12 targeted PostgreSQL integration tests pass, including five focused context/completion regressions and existing batch-score/concurrency tests.
- Six existing SQLite repository tests pass.
- The Desktop Chrome session-revalidation flow passes: advance, retained scores/cancellations in history, historical edits, attendance, court configuration, reshuffle, undo, restoration, and reload. Common mutations still make one POST without an extra session GET. This dev-mode correctness run is not used as a latency comparison.
- TypeScript and lint pass. The local CommonJS profiling preload from the earlier audit needed a lint-only import-rule annotation; application code does not import that artifact.
- Independent read-only review found no actionable issues in the focused production/adaptor/test changes.

The SQLite simulation deliberately has no persisted chemistry store; chemistry output equivalence is checked with the in-memory adapter, PostgreSQL regression, and paired PostgreSQL benchmark instead. Existing repeated-completion behavior and action input semantics are preserved rather than changed as part of this optimization.

The user subsequently authorized committing and pushing this work on the optimization branch and resolving its conflict with development. Deployment and A/B build replacement are outside this step; the existing frozen A/B servers continue to serve their saved source versions.
