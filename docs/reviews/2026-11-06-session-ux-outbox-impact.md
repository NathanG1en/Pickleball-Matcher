# Latest session UX changes and the optimistic-outbox plan

Reviewed `b982c0e..061c39b` on development, November 6, 2026. Local development was fast-forwarded to `061c39b`; existing untracked files were preserved. This review did not change product code or apply database migrations.

## What changed

- Roster filtering, searching, sorting, and shared pin storage improve organizer navigation.
- A shared pure matchmaking/proposal module now permits browser-side next-round calculation.
- Results show an upcoming lineup; Save & Start sends one combined action and immediately displays a temporary next round.
- The new domain operation saves scores, completes the current round, recalculates ratings/chemistry, and starts the next round within one transaction.
- Later commits remove the standalone Next Round button, adjust pending/disabled conditions, simplify the action bar, remove the session-settings chemistry tab, and permit sessions with more than 24 participants.

These changes address perceived round-transition latency and extra taps. They do not implement a durable command queue, indexed local persistence, deduplicated retries, or cross-tab delivery coordination.

## Confirmed blockers before expanding optimistic delivery

### 1. Combined score saving lacks ownership/scope checks

`src/lib/domain/session-service.ts:537` retrieves every submitted match and checks existence/version, but does not require each match to belong to the selected session, group, and current round. The action authenticates the selected session/round; that does not authorize arbitrary IDs inside the results array.

A disposable in-memory reproduction created one four-player session in each of two groups. Supplying both the selected round's score and the other group's match to `saveAndStartNextRound` succeeded and changed the foreign match to completed. No database was connected or changed.

Before writing any scores, validate every result context against the selected group/session/round. Add negative action/domain tests so authorization cannot be bypassed by the combined path.

### 2. Supplied next-round proposals bypass existing Stay Together checks

`src/lib/domain/session-service.ts:587` accepts `input.nextProposal` and directly inserts the round. It does not go through the lineup checks used by `startRound`, including approved Stay Together pairs.

In a second in-memory reproduction, ordinary `startRound` correctly rejected a lineup splitting an approved pair; `saveAndStartNextRound` accepted and persisted that same split lineup.

Use a shared authoritative lineup validator for both paths: current eligible players, configured capacities/courts, exactly-once assignment, sitting list, and approved pairs. A cached browser proposal remains a proposal, not authority.

## Other concerns that affect the plan

- Idempotency keys remain input fields, not persisted deduplication receipts. A committed action followed by a lost response still cannot be retried safely merely by reusing its key.
- Single-score action still drops the submitted `matchVersion`; the combined action parses `roundVersion` but does not pass it into an enforced domain check.
- Client Save & Start increments the session version when applying its optimistic state and increments it again on success, while the server updates the session once. Streamed props can interact with this timing; use an authoritative returned session/version and add focused reconciliation tests.
- Failure handling restores entire captured round/session/draft snapshots. A transport failure can follow a successful commit; restoring the old screen does not prove the transaction rolled back. Reconcile unknown outcomes by command ID before accepting further dependent actions.
- Pre-generation uses the current browser player/round snapshot before the submitted scores have changed ratings. With a supplied proposal the server does not regenerate after replay. Decide explicitly whether using pre-save ratings for that next lineup is acceptable.
- `useMemo` executes matchmaking synchronously on the browser UI thread. It is not a background worker. Existing proposal timing tests run in Node, cover 8–20 players, and assert a median below 500ms despite the test's 35ms title; they do not establish responsiveness on a phone or with the newly supported larger sessions.
- Existing E2E specs and the previous primary benchmark collector still look for the removed exact Next Round button. Update the flow before using those as acceptance/latency gates. Immediate optimistic DOM display must be measured separately from server-committed state.

## Revised implementation sequence

1. Keep the combined action and shared proposal module, but fix score scoping, proposal validation, version propagation, and authoritative response reconciliation first. Add lost-response, duplicate delivery, stale organizer, pair/capacity, and ownership failure tests specifically for the combined action.
2. Remeasure the new flow: tap-to-visible-pending, tap-to-confirmed-commit, and browser long tasks on desktop and a representative phone. Refresh the old E2E selectors. Do not compare its optimistic heading directly with the previous committed-flow metric.
3. Add real server-side command receipts atomically with mutations. Bind the command to its actor/session and payload; a retry after commit must return the original result even if the old version is now stale. Use typed retry/conflict/auth outcomes.
4. Add the durable outbox for score saves first, reusing this UI and proposal code. Preserve per-court pending status and attempted scores, coordinate queue ownership across tabs, and recover on reopen/reconnect.
5. Keep Save & Start as an online confirmed operation until the combined command also has safe deduplication, temporary-to-server ID reconciliation, and dependency recovery. Never turn its atomic backend steps into independently queued partial operations.

## Verification

- Unit/component: **726 passed**.
- Simulation: **12 passed**.
- Typecheck and lint: **passed**.
- Two additional actual-service in-memory diagnostic scenarios reproduced the scope and Stay Together gaps above.
- Full E2E and integration suites were not run in this review. Existing E2E button mismatches were identified by static inspection; they are not reported as executed failures.

Passing existing tests does not cover the two reproduced failure cases. No fixes were applied as part of this review.
