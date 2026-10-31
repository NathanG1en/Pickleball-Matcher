# Reuse data loaded during a session request

Implemented organizer benchmark recommendation 3 on `optimizations/organizer-session-actions`, alongside recommendations 1 and 2.

## What changed

The organizer session page already loads the session, roster, attendance, and round history. Proposal generation now consumes those records directly, instead of loading all four again.

`SessionService.proposeRoundFromSnapshot` calculates a proposal from typed, server-loaded inputs without database reads. `proposeRoundForSession` loads the remaining inputs when a caller already has an authorized session record. The existing `proposeRound(sessionId)` API still loads fresh data and delegates to the same calculation.

Reshuffle actions reuse the session loaded during authorization. Round-start actions also reuse that preflight record, while keeping a separate, fresh session read inside the mutation transaction. Generated starts reduce session-record reads from four to two; manually customized starts reduce them from three to two. Transaction status/version checks, authorization, and Stay Together validation remain in place.

This is explicit reuse within one request. There is no persistent or cross-request cache, schema change, migration, or client-supplied snapshot. Refreshes load new inputs. Inactive players are still filtered by the existing matchmaking calculation, and the page passes the original attendance records rather than its display-only attendance adjustments.

## Controlled benchmark

| Proposal preparation read sequence | Duplicate reads | Reused inputs |
| --- | ---: | ---: |
| SQL statements | 15 | 8 |
| Warm samples | 7 | 7 |
| Median elapsed time | 531 ms | 308 ms |
| Observed range | 517–625 ms | 237–456 ms |

The sequence used about **47% fewer SQL statements**, with median time about **42% lower** (223 ms saved) in this run.

Both variants use the current repository, including recommendation 2's parallel history reads. The duplicate variant loads the common page inputs and then calls the fresh-loading proposal API. The reused variant loads the same page inputs and supplies them directly. Every sample asserts equality of the full loaded inputs and full proposal at the same seed/temperature. Connections are warmed in a ten-connection pool, and sample order alternates.

The fixture is a stable completed test session with three rounds and eighteen matches. A completed session would not normally display a new proposal; this harness deliberately measures the proposal-preparation read sequence with populated history. It is **not a full page, browser, or production latency measurement**. Network and database load affect timing, and concurrent-organizer load has not been measured. SQL counts are deterministic for this fixture; sessions with no history use fewer statements.

Raw samples: [session-request-reuse.json](data/session-request-reuse.json).

Repeat with a stable completed session on the allowlisted Neon test endpoint:

```sh
npx tsx scripts/benchmarks/session-request-reuse.mjs SESSION_ID
```

The harness reads `TEST_DATABASE_URL`, rejects endpoints outside the allowlisted test branch, issues SELECTs only, and stores timing/count metadata without player details.

## Verification

Passed: **642 unit/component tests**, **10 targeted PostgreSQL tests**, **2 browser cases** (desktop and mobile), lint, and TypeScript checks. The nine focused reuse regressions also passed after correcting readonly fixture setup flagged by TypeScript.

- Page/action regressions failed against the duplicate-read implementation and pass after the change. They count input reads, preserve active-player filtering, and check that the next request sees a roster replacement.
- Action tests verify authorization scope and reject a session that changes version or ends between preflight and the mutation transaction without starting a round.
- A domain regression compares full proposals with Stay Together partners, seed and temperature; verifies zero snapshot-path reads; and checks that calculation leaves input records untouched.
- The targeted desktop/mobile browser flow reshuffles, starts a round, saves every court, reloads results, rejects a stale tab, and advances to the next proposal.
- Unit, PostgreSQL regression, lint, and type checks are included in the validation commands below.

```sh
npm test
npm run typecheck
npm run lint
DATABASE_URL=postgresql://blocked:blocked@127.0.0.1:1/forbidden npm run test:integration -- tests/integration/session-history.test.ts tests/integration/batch-scores.test.ts
DATABASE_URL=postgresql://blocked:blocked@127.0.0.1:1/forbidden PLAYWRIGHT_PORT=3116 NEXT_DIST_DIR=.next-test/bulk-score-saving npx playwright test tests/e2e/bulk-score-saving.spec.ts
```

The PostgreSQL regressions use connection-local temporary tables. Browser fixtures are fictitious accounts/groups on the test branch. Production data is untouched.
