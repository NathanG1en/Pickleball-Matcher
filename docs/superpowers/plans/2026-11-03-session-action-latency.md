# Session Action Latency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Reduce Confirm & Start, Save All Three Courts, and Next Round latency with demonstrated behavior and concurrency equivalence.

**Architecture:** Freeze commit `50adab8` as the control. Run production builds against separate databases cloned from one immutable profiling fixture, using the recovered in-page observer. Rank measured blocking work before selecting each product change. Extend this plan with exact files and reproducing tests for each measured hypothesis before implementing it.

**Tech Stack:** Next 16.3.8, React 19.3, Node 25.2.1, postgres.js, Neon PostgreSQL, Playwright CLI, Vitest.

**Spec:** `docs/benchmarks/2026-11-03-session-action-spec.md` (verbatim user specification).

## Global Constraints

- Primary metric remains the existing capturing-click / MutationObserver `Date.now()` duration; 250 ms pre-click pause, exact three-court and heading predicates, 10 consecutive observations per action per viewport, no discarded warmups.
- Desktop 1280×900; narrow 390×844, same desktop Chromium, no device/network emulation. Original desktop height is unavailable; historical numbers remain reference only.
- Preserve ports 3000/3001, their processes, data, and cookies. Benchmark processes use separate ports and databases. Never log credentials, request bodies, SQL parameters, or database rows.
- Required ratings, chemistry, and persistence finish before confirmed success. No reduced simulation workload, weaker locking, deferred required work, or changed timing boundary.
- Retain changes only after full unit/component, integration, maintenance, simulation, E2E, deterministic comparison, and concurrency/failure gates.
- Differences below approximately 5% or within overlapping ranges are INCONCLUSIVE.
- No production database/schema/index/config changes, hosting migrations, or paid compute increases without separate authorization.
- Continue until the exact spec's A or B condition and final green correctness gate. No success claim based only on subjective speed.

## Review Focus

1. Lost response after successful commit and subsequent retry must not duplicate effects (Task 2).
2. Independent organizers racing on the same versions must preserve atomicity and the control's conflict behavior (Task 2).
3. Cross-group shared accounts and inactive aliases must retain globally consistent ratings and snapshots (Task 2).
4. Expected DOM state can precede Flight completion; instrumentation must preserve that boundary and distinguish subsequent streamed work (Task 1).
5. Parallel query durations, transaction spans, and network/server nesting must never be added as disjoint latency (Task 1).

### Task 1: Freeze and profile the fresh control

**Files:** Create `scripts/benchmarks/session-actions/` for measurement-only collector/preload/analysis, `docs/benchmarks/2026-11-03-session-action-latency.md` for the report, and sanitized data beneath `docs/benchmarks/data/session-actions/`.

**Interfaces:** Preserve the original collector's `domReadyMs`; produce raw browser samples joined one-to-one to action HTTP traces by unique step header, plus individual query intervals and separate secondary browser metrics.

- [x] Freeze tracked source export and SHA-256 manifest at commit `50adab8` outside the repository.
- [x] Recover final original observer and reproduce historical medians from raw data.
- [x] Provision isolated identical initial databases, record fixture digest and source/runtime/build/harness hashes.
- [x] Add measurement-only diagnostics: request start/end/bytes, each query's interval/class, browser request intervals/bytes, post-response DOM handling, long tasks/layout shifts/paint opportunities. Count driver query spans as database round-trip time, not PostgreSQL executor CPU time.
- [x] Verify collector integrity: 10 samples/action/viewport, valid DOM timer, one traced action per step, all query spans complete, zero unattributed queries. Report failures/exclusions separately.
- [x] Publish fresh table and critical-path timelines before modifying product code.

### Task 2: Make the complete correctness gate executable

**Files:** Inspect/update endpoint guards in `tests/integration/round-completion.test.ts`, `shared-global-replay.test.ts`, and `rating-persistence.test.ts`; add target-action failure/concurrency E2E coverage; create immutable-source `tests/fixtures/session-action-oracle-runner.ts` and its archived-control manifest.

**Interfaces:** All PostgreSQL tests execute on an explicitly disposable loopback server; control and candidates export identical normalized assignments, scores, ratings, versions, attendance, history, and permissions.

- [x] Write tests for safe disposable-local admission and rejection of unrelated remote targets before changing test-only guards. Watch RED→GREEN.
- [x] Add deterministic state comparison including sessions, rounds, attendance, sits, shared-account groups and snapshots; pin seeds and clock wherever possible, normalize IDs consistently.
- [x] Add three-court rapid repeat, overlapping organizers, stale versions, refresh during mutation, server error, slow/dropped request, and committed-but-lost-response/retry cases. Run failure injection separately from latency.
- [x] Execute lint, typecheck, `npm test`, `npm run test:simulation`, `npm run test:maintenance`, `npm run test:integration`, production build and full two-project E2E suite. Record commands, counts, failures and skips; no silently skipped PostgreSQL coverage.

### Task 3: Optimize measured blocking work, one change at a time

**Files/Interfaces:** Determined from Task 1 evidence; each attempt gets an exact-file amendment, hypothesis, reproducing/equivalence assertions, and baseline hash before any product edit.

- [x] Select the largest critical-path slice; document expected effect and correctness risks.
- [x] Write and observe failing regression/equivalence test, implement smallest change, observe GREEN.
- [x] Run all Task 2 gates, then measure 10 observations/action/viewport from identical starting state against best verified prior version.
- [x] Publish all observations and deltas. Retain only proven equivalence; revert and explain failures. Preserve six independently reviewable runtime patches; group implementation/tests and evidence into separate commits for the authorized follow-up PR.
- [x] Repeat meaningful bottleneck attempts until A or B is demonstrated for every action. No trivial attempts to satisfy B.

### Task 4: Final audit and report

- [x] Run final complete correctness gate and verify all state and failure/concurrency evidence corresponds to final source.
- [x] Obtain one independent whole-branch review, address important findings with RED→GREEN and the full gate.
- [x] Publish historical/fresh/final tables, all raw observations/exclusions, before/after timelines, per-attempt deltas and inconclusive labels, secondary render metrics, reverts, A/B stopping proof and authorization proposals.
- [x] Mark the native goal complete only when no required work remains.

## Task 3 amendment: Attempt 1 — reuse protocol-level prepared statements

**Measured target:** 21/21/24 SQL calls per action request; repeated parameterized postgres.js statements send Describe/Flush before Bind/Execute with prepare:false. Read-only EXPLAIN separates0.123/2.147ms execution from38.658/41.780ms transport round trips. Cached prepared statements can remove repeated Describe exchanges without changing SQL or transaction order.

**Files:** Modify `src/lib/db/server-database.ts` only for product behavior (prepare:false→true; retain max10 and existing timeouts). Add `tests/db/server-database.test.ts`; add `tests/integration/session-action-equivalence.test.ts` for per-action full persisted state/proposal/version/history/attendance/permissions comparisons with fixed IDs, seeds and clocks; use all44 new resilience E2E cases plus full existing suite.

**Compatibility:** Neon documents protocol-level prepared statement support through its transaction pooler; SQL-level PREPARE is not used. PostgreSQL direct test connections use the same protocol. Keep maintenance scripts untouched.

- [x] Watch the configuration regression test fail on prepare:false (prepared-red.log).
- [x] Verify deterministic multi-group/action comparison on unchanged control (equivalence-control.log).
- [x] Set prepare:true and watch both tests pass; run every full correctness suite.
- [x] Export candidate build from frozen control plus the single product file, verify source diff, provision identical initial per-viewport fixtures, collect10 primary observations/action/viewport with unchanged observer.
- [x] Compare each action against best verified prior version; publish all raw values and overlaps, label inconclusive differences, retain only after complete equivalence/concurrency/failure gate.

## Task3 amendment: Attempt2 — compact replay history results

Measured target: representative replay read159–220ms;409 match records currently travel as1636 rows, duplicating metadata. PostgreSQL executor diagnostic is2.147ms, making transport/serialization a meaningful candidate.

Change only PostgresRepositories.listReplayMatches: select required fields, aggregate sorted player IDs by team, enforce exact2v2 counts in HAVING, keep all original predicates and completion-time/ID order. No transaction, lock, isolation, workload or persistence change.

Verification: query-contract integration covers filters/eligibility/order/incomplete teams on old and new query; complete immutable-source oracle20 checkpoints; full690unit/12simulation/55integration/12maintenance/152E2E; fresh identical fixtures and unchanged10observations/action/viewport harness. Compare both immediate prepared parent and per-action/viewport lowest-median verified prior; overlap means inconclusive.

## Task3 amendment: Attempt3 — consolidate round inserts

Start's consecutive round/match/participant writes consume roughly150+77+74ms in its representative prepared desktop trace. Combine these writes (and optional sit rows) into a single parameterized CTE command with RETURNING dependencies. Keep the initial existing-round-ID query/early return to preserve idempotency including ignored duplicate payloads. Parent/match FK order follows explicit dependencies; array serialization keeps original nullable fields. Keep outer transaction, fresh session read and optimistic version update unchanged.

Add a RED query-budget test expecting two statements regardless of courts/sit rows, preserve existing invalid-team rollback and idempotence tests, strengthen duplicate-ID payload test, test empty child arrays. Run frozen-source20 checkpoints then all named suites, build, and two new identical fixtures10observations/action/viewport. Only Start is a targeted meaningful attempt.

PostgreSQL documentation explicitly warns that DML CTEs share one snapshot and have unpredictable order without RETURNING dependencies: https://www.postgresql.org/docs/current/queries-with.html#QUERIES-WITH-MODIFYING . Do not assume textual order.

## Task3 amendment: Attempt4 — ratings and snapshots in one write command

Save's representative prepared desktop request waits134ms for rating/account/roster writes followed by124ms for snapshot reconciliation. These touch separate target tables, use already-calculated replay values, and hold the same global replay lock in the caller transaction. Combine into one CTE command; leave source-score write, calculation, locks and commit timing unchanged.

Keep last-account-input precedence, actual roster linkage (including inactive aliases), guest behavior, stale snapshot clearing, foreign supplied snapshots, nulls, unchanged-row suppression and empty-player input. Keep the empty-player path free of account/roster writes. Do not read updated table values through the shared CTE snapshot; supply the same replay values to both independent writes.

Update existing rating persistence budget2→1 and score-service budget9→8 BEFORE tests; observe RED, then retain all persisted-state, tuple-version and rollback assertions. Run immutable control comparison, all suites, fresh cloned fixtures and the same10rounds per viewport. Only Save is directly targeted; untargeted action timing changes do not count as meaningful attempts.

## Task3 amendment: Attempt5 — chemistry replacement in one command

Next's representative prepared desktop chemistry replacement waits34ms deleting all aggregate rows then71ms inserting recalculated rows; other observations have longer waits. Keep the required global lock and same replacement semantics, but send DELETE (RETURNING a constant) and INSERT/UNNEST as one command. Consume the deletion CTE output before inserting, without reading the target through the shared snapshot. Empty input must still clear all rows. No upsert, new UPDATE privileges, deferred work or lock caching.

Add explicit one-command RED test and state/empty/subset/duplicate-invalid-input rollback/transaction-guard checks using TEMP tables; update completion SQL budget10→9 BEFORE running. Compare complete frozen-source checkpoints, run every named suite, clone new fixtures and measure10observations/action/viewport. Only Next is targeted by this attempt.

## Task3 amendment: Attempt6 — one session-history read

Start still blocks on the post-commit page refresh. Its listStartedRounds call first reads rounds, then waits for three concurrent child reads; representative traces show roughly35–150ms additional waits for those children. Return each selected round with explicitly ordered, projected JSON aggregates of matches/members/sits in one parameterized SQL command using existing FK indexes. Preserve this.query for transaction binding. Leave page authorization, revalidation, UI and the matchmaking workload unchanged.

Restore Date instances from JSON match timestamps, preserve nulls and PostgreSQL non-finite numeric snapshots, and retain original per-round court/member/sit ordering. Coalesce empty child sets to arrays and preserve empty rounds and missing-session output. Keep projections explicit to avoid future column overfetch.

Add an actual-PostgreSQL contract/budget RED test (four→one calls) covering shuffled IDs, court ordering, empty rounds/children, timestamp types, nullable/unrated fields, and numeric boundary values. Frozen-source20 checkpoints and full gates remain mandatory. Then measure two fresh identical fixtures with original10rounds per viewport. Start and Next are targeted; Save's post-DOM refresh is not a meaningful Save attempt. Retain only if correctness is demonstrated; document any revert.
