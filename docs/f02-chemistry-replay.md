# F02/F03 — Rebuild chemistry after session and Open Play corrections

Status: implemented and approved for integration into `development`.

## Problem

Normal sessions added partnership chemistry when a round finished. Correcting a saved score replayed Elo and changed match history, but left that previously accumulated chemistry untouched. A partnership could therefore keep positive chemistry from a game that had been corrected to a loss.

The accumulator also used the players' current ratings when processing a result. Historical chemistry depends on the teams' expected chance of winning that particular game, so using ratings from after the game or from a later session gives the wrong baseline.

## Resulting behavior

- Correcting a finalized normal-session result rebuilds chemistry from saved match history, including winner reversals and score-margin changes.
- Repeated saves or repeated round completion count each eligible game once.
- Cancelling or deleting a match, undoing or reshuffling a round, and deleting a session remove its obsolete chemistry contribution.
- Ending a session finalizes chemistry for its completed games, including when the host ends without first clicking Next Round.
- Normal-session chemistry still waits for round finalization. A saved score in an unfinished round can update Elo without prematurely appearing in chemistry.
- Score edits preserve the match's original completion timestamp. Editing an old game no longer moves it to the end of chronological Elo and chemistry replay.

For example, with four new equally rated registered players, an 11–0 win gives the winning pair **+5 chemistry in one shared match**. Correcting it to 0–11 produces **−5 in one shared match**. Saving that correction again leaves the count at one. The displayed numbers depend on historical ratings and prior games; this example is the regression fixture.

## Implementation

### One replay from authoritative matches

[`src/lib/domain/synergy-replay.ts`](../src/lib/domain/synergy-replay.ts) calculates fresh pair aggregates rather than adding another contribution to an existing aggregate.

It uses the existing Elo replay calculator to reconstruct pre-match ratings from initial ratings and chronological match history. It then calls the existing chemistry calculator for each eligible partnership. The chemistry formula, decay, prior strength, score-margin weighting, and displayed score calculation are unchanged.

Matches are processed by original completion time, with match ID as the deterministic tie-breaker, matching Elo replay. Pair identifiers use sorted account IDs. A pair's `updatedAt` now reflects its latest contributing game's completion time, rather than the time somebody last edited or rebuilt the aggregate.

Replay spans all groups because an account's rating and partnership history can cross group boundaries. Correcting an early result can change the expected win probability for a later game in another group, even if that later game's score stays the same.

### Eligibility

The repository adds `synergyEligible` to replay records. Chemistry includes completed, rated doubles games from:

- Completed rounds in normal sessions.
- Open Play sessions, where each submitted game is immediately eligible even though its round remains open.

Pending, cancelled, unrated, singles, and unfinished-normal-round results do not contribute chemistry. Both partners need registered accounts; guest partnerships and duplicate-account pairs are skipped. A registered pair can still earn chemistry against a team containing a guest. Rated games from an unfinished normal round remain part of Elo's historical rating calculation, consistent with existing Elo behavior.

### Atomic writes and concurrent saves

The affected operations acquire a shared Postgres transaction advisory lock **before writing the result, its participants, or ratings**. They save source data, replay ratings where needed, and replace chemistry inside the same transaction. A failure rolls back those writes together. The lock releases automatically at transaction end.

Acquiring the lock early matters: a concurrent normal correction and Open Play edit otherwise acquire player and match-participant locks in opposite orders and can deadlock. A dedicated Postgres regression reproduced that deadlock before the early-lock change and passes afterward.

[`PostgresRepositories.replaceSynergyState`](../src/lib/db/postgres-repositories.ts) deletes stale aggregates and bulk-inserts the rebuilt state within the caller's transaction. It persists all weighted accumulator fields. Readers see committed state; there is no committed empty-table interval during replacement.

### Related Open Play change (F03)

Open Play uses the same global chemistry table. Leaving its old append-after-save path in place would allow a normal-session replay to include a newly saved Open Play game, followed by the Open Play request adding that same game again.

To close that race, Open Play submission and editing now use the same transactional replay path. This also addresses the shared F03 symptom: editing a game replaces its contribution, and deletion removes it. Open Play no longer calls the additive accumulator in product flows. Its existing score and attendance validation remains in place.

## Files to review

| Area | Files | Purpose |
| --- | --- | --- |
| Calculation | `src/lib/domain/synergy-replay.ts` | Deterministic chemistry reconstruction using historical pre-match Elo. |
| Normal-session lifecycle | `src/lib/domain/session-service.ts` | Replay after score corrections and lifecycle changes; preserve completion times. |
| Actions | `src/app/actions/sessions.ts`, `src/app/actions/open-play.ts` | Transactional session deletion and Open Play saves. |
| Persistence contract | `src/lib/domain/repositories.ts`, `src/lib/domain/types.ts` | Lock/replacement methods and replay eligibility metadata. |
| Postgres | `src/lib/db/postgres-repositories.ts` | Eligibility query, advisory lock, bulk replacement, weighted-state reads. |
| Test adapters | `src/test-support/in-memory-repositories.ts`, `tests/simulations/sqlite-repositories.ts` | Match the new interface and eligibility metadata. The SQLite simulation adapter retains its existing chemistry storage stubs. |
| Regression tests | `tests/domain/session-synergy.test.ts`, `tests/domain/synergy-replay.test.ts`, `tests/actions/open-play.test.ts`, `tests/actions/session-deletion.test.ts` | Corrections, chronology, cross-group effects, idempotence, removal, and rollback. |
| Postgres regressions | `tests/integration/synergy-replay.test.ts`, `tests/integration/synergy-concurrency.test.ts` | Weighted-state persistence, replacement/removal, concurrent normal/Open Play corrections. |
| Browser regressions | `tests/e2e/corrections.spec.ts`, `tests/e2e/open-play.spec.ts` | Profile chemistry after real normal/Open Play edits and refreshes. |

## Validation

| Check | Result |
| --- | --- |
| `npm run lint` | Passed, no warnings. |
| `npm run typecheck` | Passed. |
| `npm test -- --maxWorkers=2` | 513 tests passed in 69 files. |
| `npm run test:simulation` | 8 tests passed in 3 files. |
| Targeted Postgres integration tests | 2 passed: weighted replacement/removal and concurrent normal/Open Play correction. |
| Targeted Playwright checks | Normal correction passed on desktop and mobile; Open Play correction/deletion passed on desktop. Mobile Open Play remains unverified: separate attempts timed out during signup, roster setup/context cleanup, or an in-flight submission. |

The browser cases are `normal score corrections refresh chemistry without adding shared games` and `Open Play chemistry corrections replace the game's contribution`. Normal-session tests also capture before/after profile screenshots in Playwright's test-results directory.

The initial normal-session regression tests failed before the fix. The concurrent Postgres test reproduced a real deadlock before lock acquisition moved ahead of source writes. Initial broad validation attempts encountered worker/setup timeouts; the final unit run capped workers, and browser tests were run separately. These attempts are not counted as clean runs. The latest combined browser run passed three cases and timed out in mobile Open Play setup. Separate mobile Open Play runs also timed out; there is no claim of an entirely green Playwright run or a full-suite E2E pass.

The Postgres storage test uses a connection-local temporary table. The concurrency test creates and removes its own generated schema and verifies connection isolation before writing fixtures. Neither test truncates existing application tables. Browser checks use fictitious accounts on the configured test database. Production data has not been changed.

## Cost, rollout, and limits

- No database migration, new dependency, browser animation, or client-side background work is introduced.
- Each affected write reads global rated doubles history and rebuilds pair aggregates. Result operations that also replay Elo currently calculate historical ratings twice: once to persist Elo and once to calculate chemistry. This favors correctness and a shared implementation over an incremental cache. Production-scale latency has not been benchmarked.
- The shared lock serializes these result/lifecycle writes across groups. Increasing history or concurrent scoring can increase save latency. A future optimization could share the rating replay result or track per-match chemistry contributions while retaining the same tests.
- After deployment, the next successful covered result/lifecycle action rebuilds all saved chemistry, repairing stale or duplicate aggregates supported by retained match history. Merely viewing a profile does not trigger repair. No production backfill has been run.
- Historical scores and initial ratings remain the source of truth. This cannot recover original completion timestamps that older code already overwrote, or deleted historical data.
- The privileged rating-maintenance script, account linking, group deletion, and stale-editor conflict handling (F06) are not redesigned here. The advisory-lock protocol covers the result/session operations listed above; it is not a universal lock on every repository write.
- Tournament bracket behavior and chemistry scoring constants are unchanged.

The F02/F03 fixes are integrated together because normal sessions and Open Play share the chemistry table and must use the same transaction and locking protocol.
