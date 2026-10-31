# Focused round completion implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement this approved change inline, with test-first verification and a final review.

**Goal:** Replace the five round/history reads inside round completion with one current-round context read.

**Architecture:** Add `getRoundCompletionContext(roundId)` to the repository contract and all three adapters. Return the fresh round plus pending matches and participant counts, inside the existing transaction and chemistry lock. Preserve all completion, cancellation, replay, and version-checked write behavior.

**Spec:** User-approved walkthrough: current round only; pending singles are cancelled, other unresolved formats block completion; full history remains available for matchmaking and chemistry.

**Constraints:** No schema/UI changes; no cache; unchanged search budget, authorization, locking, and transaction scope. Preserve the prior profiling artifacts and local `.neon` change. Commit/push only on user request.

**Review focus:** Missing versus empty rounds; resolved and foreign-round matches; zero/one/three/four pending participants; rollback after singles cancellation; stale writes and transaction-pinned reads.

- [x] Add failing domain and adapter regressions; inspect/update affected browser expectations before runs.
- [x] Add the typed context read in PostgreSQL, SQLite, and in-memory adapters; use one PostgreSQL statement, preserving empty-round rows.
- [x] Switch completion to the context read and preserve existing writes/replay.
- [x] Verify full unit suite, typecheck/lint, targeted PostgreSQL and SQLite tests, and a focused browser flow.
- [x] Compare legacy and focused completion in isolated temporary PostgreSQL fixtures, checking persisted output equality and SQL counts; document measured timings and limits.
- [x] Obtain independent review of the change and resolve actionable findings.

Execution notes: the existing isolated worktree was reused. After implementation and verification, the user authorized commit/push and resolving the PR conflict with development. The SQLite adapter has no chemistry store, so that output is verified using PostgreSQL and the in-memory adapter. The prior profiling artifacts and `.neon` edit were preserved.
