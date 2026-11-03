# Save All rating persistence optimization

Save All already writes the submitted court scores in one batch. Its rating replay previously followed that with five persistence statements: update supplied roster rows, update accounts, propagate account ratings back to every linked roster, clear scoped history snapshots, and write replay snapshots. This change reduces those five statements to two and skips unchanged values.

## Changes

`PostgresRepositories.replaceRatingState` retains its interface and replay inputs:

- A data-modifying CTE updates accounts and one roster UPDATE resolves each roster's final desired rating. Account values take precedence based on the row's actual account linkage, preserving the previous last-account-input rule. Inactive and other-group aliases still receive updates, including when their account is already current. Guest values remain independent.
- One snapshot UPDATE reconciles the union of the requested group's match participants and all supplied replay snapshot keys. Missing snapshots in the selected group become null; supplied snapshots in other groups still apply. An empty group scope retains the existing all-groups behavior.
- Null-safe `IS DISTINCT FROM` predicates skip physically unchanged account, roster and snapshot rows. The tests compare PostgreSQL tuple identifiers before and after repeating identical persistence to detect unnecessary updates.

The rating algorithm, global replay scope, transaction connection, global chemistry lock, score version checks, permissions, UI and schema are unchanged. Saving ordinary in-progress scores still replays ratings; historical corrections retain their existing rating/chemistry behavior. The code continues to wait for the transaction rather than reporting a save before persistence finishes.

## Controlled benchmark

| Backend Save All | Previous persistence | Consolidated persistence |
| --- | ---: | ---: |
| Rating persistence statements | 5 | 2 |
| Total SQL executions | 12 | 9 |
| Median, 15 observations | 895 ms | 627 ms |
| Observed range | 788–996 ms | 557–777 ms |

The median fell by **268 ms, approximately 30%** in this run.

The fixture contains 12 registered players on three courts, nine resolved historical rounds and a pending tenth round. It includes an earlier unrated court. Before each timed Save All, matches, account ratings, roster ratings and history snapshots are restored to identical starting values. Resetting and output checks happen outside timing. Both variants use the current service, driver, transaction and lock behavior; only the persistence method changes. There is one warmup per variant, followed by 15 observations per variant in alternating order.

Every observation compares returned matches and the complete persisted scores, account/roster ratings, rating snapshots and chemistry against the legacy result. The old five-statement method is frozen in a test-only fixture; application code never imports it. Query counts are asserted for each sample.

All fixture writes use connection-local temporary tables on the explicitly allowlisted direct Neon test endpoint. The harness checks temporary-table isolation before seeding and uses one connection. Closing it discards the fixture; it changes no persistent test, development, production or A/B playground rows.

These are warm **backend service measurements from this machine to remote Neon**, not deployed browser timings or a capacity test. They are not directly comparable to the October 31 report's different fixture and measurement window. Production app placement is reported as `us-east-1`, while Neon is in `us-east-2`; production network, cold starts, rendering and authorization still need separate measurement. No compute size, region, connection pool or Neon settings were changed.

Raw samples: [rating-persistence.json](data/rating-persistence.json).

Repeat with the existing direct test connection configured as `TEST_DATABASE_URL`:

```sh
npx tsx scripts/benchmarks/rating-persistence.mjs 15
```

## Regression coverage and limits

The PostgreSQL regressions cover the two-statement budget, unchanged physical rows, shared accounts with conflicting alias inputs, inactive cross-group aliases, unchanged-account alias repair, guests, empty players/snapshots, null stored values, scoped stale snapshot clearing, foreign supplied snapshots and rollback when snapshot persistence fails. Additional characterization checks actual roster linkage when an input account ID is omitted or differs from the stored account ID. `RatingSnapshot` still accepts numeric before/after values; this change does not widen that API to accept partially-null supplied snapshots.

The existing batch-score SQL ceiling is tightened from 12 to 9. Related replay equivalence, global lock serialization, historical correction, unrated game and rollback tests remain in place. No E2E flow expectations changed; the existing correction and revalidation specs were inspected.

Independent read-only review found no actionable issues in the production query, regression tests, legacy fixture or benchmark. The reviewer did not independently execute tests or inspect deployed query plans. Verification:

- 682 unit/component tests pass.
- 20 PostgreSQL regressions pass across the focused persistence, batch-score, shared-replay, concurrency and round-completion specs; the added account-linkage characterization passes separately (21 distinct checks total).
- Desktop Chrome correction workflow passes: save/correct, rejected ties and draft preservation, cancellation, advance, reshuffle, undo, attendance and court settings.
- Typecheck and lint pass. A concurrent lint attempt encountered Playwright removing its generated test-results directory; the final checks run sequentially after Playwright finishes.
- All 30 measured Save All observations and both warmups satisfy the asserted query budgets and persisted-state equality.

## Remaining work

Save All still loads global replay inputs and recalculates ratings. We preserved that model because shared accounts and historical corrections need consistent results. This change removes three round trips and overlapping/unchanged writes; it does not implement incremental ratings, remove locking, or establish production latency targets. Large-history query plans and deployed browser latency remain useful follow-up measurements.

Implementation targets development from `optimizations/rating-persistence`, based on `99e7f39`. The user authorized committing, pushing and opening a pull request after local verification. Production deployment is separate. The local A/B comparison uses frozen before/after production builds with separate Neon copies; the original database settings and earlier saved builds remain preserved.
