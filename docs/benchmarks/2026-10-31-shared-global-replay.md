# Shared global replay — stage 1 and the stage-2 decision

Implements recommendation 5 stage 1 on `optimizations/organizer-session-actions`. Recommendation 4's client refresh changes remain separate work in this branch.

## What changed

Operations that rebuild both ratings and chemistry now use `replayRatingsAndSynergies`:

1. Keep the caller's existing transaction and chemistry lock, acquired before source-match changes.
2. After those changes, read the global roster (including inactive players) and authoritative rated match history once.
3. Calculate rating replay once. Persist ratings and snapshots with the existing group parameter.
4. Calculate chemistry from the same history and rating snapshots, then persist the global chemistry state.

The helper retains the existing reentrant lock call. No lock is removed, and both writes still commit or roll back with the original mutation. Inputs exist only for that invocation; the next transaction reloads them. Accounts shared between groups still participate in the complete global replay.

This replaces paired replay calls in normal-session historical score/batch corrections, cancellations/deletions, undo/reshuffle, session deletion, rated pickup games, and session ending when unresolved games were cancelled. Open Play submission, editing, and ending use it too. Existing Open Play deletion already goes through the shared normal-session deletion service.

Ratings-only active score saves still use `replayRatings`. Chemistry-only round completion, manual chemistry refresh, resolved normal-session ending, and unrated pickup games still use `replaySynergies`. The restricted starting-rating maintenance script is unchanged. There are no schema changes, background jobs, new permissions, or rating-rule changes.

## What stage 1 saves

Previously, paired replay loaded the global roster/history twice and calculated ratings twice. It now loads each once and calculates ratings once. It still performs the full global calculation and the same complete rating/snapshot/chemistry writes.

| Warm replay transaction | Legacy sequence | Shared replay |
| --- | ---: | ---: |
| SQL statements, including transaction control | 15 | 13 |
| Global roster reads | 2 | 1 |
| Global history reads | 2 | 1 |
| Rating calculations | 2 | 1 |
| Rating-state replacements | 1 | 1 |
| Chemistry replacements | 1 | 1 |
| Lock calls | 2 | 2 |

Controlled timing results, seven alternating samples per variant:

| Synthetic history, 16 accounts | Legacy median (range) | Shared median (range) |
| --- | ---: | ---: |
| 12 source matches / 3 rounds | 922 ms (858–944) | 784 ms (773–867) |
| 120 source matches / 30 rounds | 1,002 ms (972–1,454) | 986 ms (852–1,045) |

The smaller run saved about 138 ms at the median; the larger run saved about 17 ms. Network/write timing varied, and the ranges overlap in the larger run. The defensible result is removal of duplicate reads/calculation with equal outputs, **not a dependable overall speed percentage** or evidence that stage 2 is already necessary.

Both variants run in transactions using one direct test-branch connection and connection-local temporary tables that shadow all fixture/output tables. They warm both variants, alternate order, and assert full persisted-state equality after every sample: source matches, account/roster ratings and game counts, match-player snapshots, and chemistry including timestamps. An unrated match and cancelled matches exercise filtering. No production data or public test rows are changed by this benchmark.

Raw samples: [12-match run](data/shared-global-replay.json), [120-match run](data/shared-global-replay-120-matches.json). Each includes timed roster/history reads, rating/chemistry writes, and lock calls. Method timings include database round trips and mapping. Lock-call time is **not isolated lock waiting**, and total time also includes calculation, BEGIN/COMMIT, and other overhead. These are backend replay timings, not complete browser/action timings or concurrent-organizer load tests. The small synthetic roster and repeated pairings do not represent every production dataset.

## When to revisit stage 2

Reassess when any of these occurs:

- Organizers repeatedly notice waiting while saving scores, using Save All, or advancing rounds.
- The app's **global** rated history grows to roughly five times the size at the last representative measurement. History across all groups matters because accounts can play in several groups. Growth is a prompt to measure, not an automatic reason to rewrite.
- Multiple organizers commonly score at once and delays or database lock queues appear.

Do not decide from a single slow request, an occasional historical correction, an unchanged SQL count, or a cold database wakeup. A fixed query count can still transfer/rewrite much more data as history grows.

Record this read-only aggregate with the date of a representative baseline to track growth across all groups:

```sql
select count(*) as completed_rated_matches
from public.matches
where rated = true and status = 'completed';
```

It is a growth indicator, not a full reproduction of replay eligibility or a performance measurement. This implementation task did not query production to collect it.

## How to decide

1. **Choose an interaction budget.** A reasonable initial investigation trigger is a recurring **warm p95 above 2 seconds** for frequent scoring/Next Round actions: roughly the slowest five of a hundred interactions exceed two seconds. This is a proposed club-app target, not a measured production SLO or a universal standard. Adjust it to what organizers find disruptive.
2. **Measure real actions under representative conditions.** Collect at least 30, preferably 50+, warm observations per common action across several sessions. Record median/p95 and separate cold starts. Capture privacy-safe duration metrics for the full server action and replay input reads, calculation, rating/snapshot writes, chemistry writes, and actual lock waiting. Compare browser-visible waits too. This change does not install production telemetry; those phase measurements must be gathered in a later profiling pass or existing host/database telemetry.
3. **Confirm replay is responsible.** A strong reason to investigate stage 2 is exceeding the interaction budget **and** replay accounting for over half of server-action time, or replay-related lock queues disrupting concurrent scoring. Check network latency, database wakeups, pool saturation and unrelated rendering first. The standalone replay benchmark cannot establish the fraction of a full action on its own.
4. **Test growth safely.** Reproduce the representative workload on an isolated test branch, then at roughly 5x and 10x history, including more accounts, partners, groups, and shared memberships. Exercise concurrent organizers as well as single requests. Use the benchmark below as a controlled diagnostic; its fixed 16-account fixture alone is insufficient for a production-scale decision.
5. **Require proof before adopting stage 2.** Prototype reduced writes/incremental handling only if replay is a measured bottleneck. A useful proposed acceptance target is at least a 25% reduction in the affected action's warm p95, or bringing it within the chosen budget, with unchanged ratings, chemistry and history. Preserve correction/cancellation/deletion/undo behavior, shared-account propagation, and transaction/concurrency safety. Keep a full-replay fallback for cases the incremental path cannot prove safe.

Stage 2 might first reduce unchanged writes, then introduce a carefully validated append-only path for eligible new results. Newly saved results are not automatically safe to append: completion ordering, score edits, participant changes, shared accounts and concurrent writes can change downstream ratings. Do not scope replay to one group or remove the global lock as a shortcut.

If common actions meet the budget and there is no replay contention, keep stage 1 and reassess after growth. The present measurements do not justify implementing stage 2 automatically.

## Repeating the controlled benchmark

The harness requires the existing allowlisted **direct** `TEST_DATABASE_URL`. It rejects pooler/other endpoints because session-local temporary tables must stay on one database connection, and deletes its fixture implicitly by closing that connection. It does not use application `DATABASE_URL` as a fallback. Arguments are rounds, samples per variant, and output path; the fixture creates four source matches per round.

```sh
npx tsx scripts/benchmarks/shared-global-replay.mjs 3 7 /tmp/replay-12.json
npx tsx scripts/benchmarks/shared-global-replay.mjs 30 7 /tmp/replay-120.json
```

For a later trend check, use more samples and a larger fixture in an idle test environment:

```sh
npx tsx scripts/benchmarks/shared-global-replay.mjs 30 50 /tmp/replay-120-repeated.json
npx tsx scripts/benchmarks/shared-global-replay.mjs 300 50 /tmp/replay-1200-repeated.json
```

Keep Node/driver versions, database region/compute, connection settings and warmup consistent. Run the benchmark separately from other database tests. Compare phase timings and actual user actions; do not infer tail latency from the seven-sample implementation check or from cross-action averages.

## Verification

Passed: **654 unit/action/component tests**, **12 simulation checks**, **8 distinct targeted PostgreSQL tests** (five batch-score regressions plus three shared-replay checks), and **16 desktop/mobile browser cases**, along with TypeScript and lint. The review found no production-code issues; it caught a cancelled test fixture retaining scores, which was corrected to satisfy the existing database constraint before the successful PostgreSQL runs.

- Regression tests failed on the old combined operations because they read each global input twice; they pass with one read after this change.
- Domain tests compare the shared helper against the legacy sequential helpers for exact persisted state with cross-group accounts, inactive players, guests, cancelled history, and unfinished-round chemistry eligibility. They verify fresh subsequent transactions, rollback, and separate ratings-only/chemistry-only writes.
- PostgreSQL tests verify exact persisted equality, a two-query reduction, shared-account roster propagation, rollback after the final chemistry write, and lock ownership until commit. They use only connection-local temporary fixtures.
- The full unit/action suite covers normal sessions, Open Play, pickup games, deletion, and permissions. Simulation checks retain rating/matchmaking invariants.
- Targeted browser checks exercise normal corrections and chemistry, Open Play corrections/deletions/end flows, and recommendation 4's zero-extra-GET session workflow.

Commands:

```sh
npm test
npm run typecheck
npm run lint
npm run test:simulation
DATABASE_URL=postgresql://blocked:blocked@127.0.0.1:1/forbidden npm run test:integration -- tests/integration/shared-global-replay.test.ts tests/integration/batch-scores.test.ts
DATABASE_URL=postgresql://blocked:blocked@127.0.0.1:1/forbidden PLAYWRIGHT_PORT=3118 NEXT_DIST_DIR=.next-test/shared-global-replay npx playwright test tests/e2e/session-revalidation.spec.ts tests/e2e/corrections.spec.ts tests/e2e/open-play.spec.ts tests/e2e/open-play-completion.spec.ts --grep 'session mutations render|normal score corrections refresh chemistry|Open Play chemistry corrections|organizer and host can add, edit, and delete|Open Play completion'
```

Browser tests create fictitious fixtures on the test branch. Production databases and credentials are untouched. The maintenance script remains a separate restricted workflow.
