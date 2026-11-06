# Deployment gate fixes — November 6, 2026

Base: development `061c39b`.

## Why CI failed

GitHub CI run `42236871120` passed lint, TypeScript, unit/component tests, simulations, integration tests, maintenance tests, and its production build. Its browser job failed. Browser specs still expected the removed standalone Next Round button, a separate proposal/confirmation step after advancing, and the removed organizer Partner Synergies tab.

## Changes

- Browser tests use Save & Start and verify its new started-round state. Tests that exercise manual editing explicitly reshuffle the empty new round to reopen its proposal.
- Acceptance coverage handles the in-progress warning when ending a session after automatically starting its next round.
- Chemistry UI coverage follows the current viewer's partner badge through swaps and refresh; the removed settings panel is no longer queried. Existing lineup/component tests retain both-team and shared-game-count assertions.
- Resilience checks distinguish the optimistic screen from a committed response. They verify both the completed prior round and newly started round, scores, assignments, rating snapshots, account/alias consistency, chemistry, and session versions.
- Save & Start rejects result IDs outside its selected current round, stale round versions, and attempts to advance a round outside the active session/current-round state. These checks execute within the mutation transaction.
- Supplied next-round lineups receive the same authoritative roster/court/Stay Together validation as paired ordinary starts. The checks also reject duplicate or missing players when there are no approved pairs.
- Court configuration now runs inside an awaited React transition. Start Round remains disabled until the action result and refreshed server UI have both committed, preventing a late proposal replacement from dismissing an already-open start confirmation. A regression isolates this transition while every other pending state is false; it failed before the fix and passes after it.
- Invalid drafts on previously saved matches now disable Save & Start; blank, tied, negative, and fractional corrections cannot be silently skipped while advancing.

Validating a browser-supplied lineup adds authoritative roster, attendance, and round-history reads to the combined path. These checks are required for correctness; this repair does not claim a latency improvement.

The scope and Stay Together regressions were reproduced as failing domain tests before repair. Invalid completed-score drafts were likewise reproduced in failing component tests.

## Verification

Verification uses a disposable PostgreSQL instance on loopback and a dedicated production-build test port. Production and the user's localhost comparison databases are not used.

Final local results, all exit code 0:

| Gate | Result |
| --- | --- |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| `npm test` | 736 tests passed across 95 files |
| `npm run test:simulation` | 12 tests passed |
| `npm run test:integration` | 62 tests passed across 16 files |
| `npm run test:maintenance` | 12 tests passed |
| Production build (`next build --webpack`) | Passed |
| Full Playwright suite (`--retries=0`) | 154 passed, desktop and mobile, 4.7 minutes |
| `git diff --check` | Passed |

Browser coverage includes actual transaction failures and rollback, revoked organizer access, slow/dropped requests, lost committed responses, rapid repeated clicks, refresh mid-action, stale retries, independently authenticated organizers, shared accounts across groups, and consecutive combined round starts without a page refresh.

The integration suite's frozen-source equivalence oracle also remains green across its 20 persisted-state checkpoints. The combined action is covered separately by domain regressions and browser resilience checks.

An earlier full browser run exposed the court-configuration confirmation race (153 passes, one failure). That failure was investigated and repaired with the transition regression above; the final full run passed without retries. Repeated diagnostic runs also revealed a timestamp-only test-name collision, so the revalidation fixture now includes worker/repeat identity. Response waits have a bounded failure timeout rather than hanging until the full test timeout.

These are local verification results recorded before committing and pushing. Deployment status is verified separately by the hosting pipeline.

## Remaining scope

This change does not introduce a durable outbox or persisted idempotency receipts. A rejected stale retry must leave all committed state unchanged. Offline delivery and automatic retry after an unknown outcome still need a separate design.
