# Rating persistence optimization implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement inline with test-first verification and independent final review.

**Goal:** Reduce five rating persistence statements to at most two and avoid updates to unchanged values.

**Architecture:** Keep the existing `replaceRatingState(groupId, players, snapshots)` contract. Use one PostgreSQL statement for account and roster updates, with shared-account values taking precedence over individual roster inputs. Use a second statement to reconcile snapshots to supplied values or scoped nulls. Keep replay calculations, transactions, locks, and version checks unchanged.

**Tech Stack:** TypeScript, Postgres.js, PostgreSQL, Vitest.

**Spec:** The user approved consolidating overlapping account/roster writes and replacing snapshot clear/rewrite, including clearing stale values after corrections. Implement both without changing outputs.

## Global Constraints

- No schema, driver, UI, rating algorithm, or infrastructure changes.
- Preserve shared-account propagation across groups, inactive rosters, guest ratings, null snapshots, empty inputs, scoped clearing and global snapshot application.
- Use explicit isolated test endpoint and connection-local temporary tables for measurements; no persistent database data changes.
- Reuse the existing worktree on `optimizations/rating-persistence`, based on current development `99e7f39`; preserve local `.neon` and output artifacts.
- User authorized implementation; no further approval gate or automatic push is needed.

## Review Focus

- An unchanged account can have an out-of-date linked roster: repair the roster independently.
- Multiple supplied roster aliases share one account: preserve existing last-account-input precedence; write each physical row once.
- Empty/missing snapshots clear only the requested group's stale snapshots; supplied snapshots outside that group still apply.
- Cancelled/unrated matches, undo and deletion remove obsolete snapshots; unchanged and nullable values cause no physical update.
- A failure after either persistence statement rolls all score/account/roster/snapshot writes back under the existing transaction/lock.

### Task 1: Consolidate persistence and prove equivalence

**Files:** Modify `src/lib/db/postgres-repositories.ts`, `tests/integration/batch-scores.test.ts`; create `tests/integration/rating-persistence.test.ts`, `tests/fixtures/legacy-rating-persistence.ts`, `scripts/benchmarks/rating-persistence.mjs`, and `docs/benchmarks/2026-11-03-rating-persistence.md` with sanitized observations.

**Interfaces:** Keep the repository contract unchanged. Retain the old SQL in a test-only legacy fixture for isolated comparison.

- [x] Write PostgreSQL regressions for literal shared-account/guest results, scoped nullable/stale snapshots, no-op physical writes, two-statement budget and rollback; update batch-score budget to nine queries before running tests. Inspect corrections/revalidation E2E expectations; no flow change is intended.
- [x] Run focused tests against old implementation and confirm expected query/write-budget failures.
- [x] Implement one account/roster update statement and one snapshot reconciliation statement with null-safe changed-value predicates. Never update the same table row twice within a statement.
- [x] Run focused PostgreSQL tests, related replay/concurrency/correction tests, unit suite, typecheck/lint and focused correction E2E if warranted.
- [x] Benchmark legacy versus optimized Save All against identical 12-player fixtures with historical rounds, alternating samples and checking full persisted state equality outside timing. Record SQL counts and unchanged-write evidence; do not claim deployed latency improvement.
- [x] Obtain a fresh read-only review and resolve material findings with regression tests. Document results and leave changes reviewable on the branch.
