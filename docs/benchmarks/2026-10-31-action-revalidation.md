# Session action revalidation and explicit refresh

Implemented recommendation 4 on `optimizations/organizer-session-actions` after commit `75e4c27` (recommendations 1–3).

## Finding and change

The installed Next.js 16.3.8 guide, `node_modules/next/dist/docs/01-app/02-guides/server-actions.md`, documents that an action calling `revalidatePath` can include the freshly rendered current route in its POST response. The existing actions already invalidate the exact session URL. Calling `router.refresh()` after those successful actions initiated another session GET.

Removed nine such calls from `SessionManagerClient`: start round, next round, active-round reshuffle, match cancellation, round undo, attendance changes, court configuration, historical score correction, and historical cancellation. Next Round still runs inside its generation transition while awaiting the action and its rendered payload; the additional nested refresh transition is unnecessary.

Server actions, authorization, transaction checks, replay, cache invalidation, error handling, and lineup/score draft storage are unchanged. The cancellation handler retains optimistic updates and rollback on failure. The page's existing prop synchronization receives fresh sessions, attendance, rounds, proposals, ratings, and chemistry through the action response.

## Measured request and query counts

| Same organizer workflow | Baseline desktop | Optimized desktop | Optimized mobile |
| --- | ---: | ---: | ---: |
| Mutation/action POSTs | 13 | 13 | 13 |
| Follow-up session GETs | 12 | 0 | 0 |
| Total measured requests | 25 | 13 | 13 |
| Postgres Query executions | 457 | 337 | 337 |

This removes **120 query executions (26%)** and twelve extra requests in the measured workflow. Each removed GET dispatched ten queries. The POST query counts match exactly, step by step, across baseline and both optimized runs. The thirteen POSTs include a single-score-save control that already avoided explicit refresh; the other twelve invocations exercise the nine changed handlers, including repeated starts and both attendance directions.

Examples, counting each action and its follow-up GET together:

| Action | Baseline queries | Optimized queries |
| --- | ---: | ---: |
| Start round | 30 | 20 |
| Advance round | 37 | 27 |
| Historical score correction | 40 | 30 |
| Round undo | 45 | 35 |
| Single-score-save control | 25 | 25 |

These are **attempted Postgres Query executions**, including transaction control, rather than wire messages, rows, or just SELECTs. The test-only Node preload counts each lazy query once when dispatched in the caller's request context. It covers the external driver's ESM/CommonJS entry paths. A pooled connection's socket/debug callback can inherit another request's context, so counting only there would be insufficient. Both accepted traces have zero unattributed query events.

Raw per-step counts and timings: [action-revalidation.json](data/action-revalidation.json). The summary strips paths, account/group/session IDs, process IDs, and absolute timestamps. No cookies, action arguments, SQL text, SQL parameters, or returned rows are captured by the tracer.

## Freshness paths retained

- A restored browser page still calls `router.refresh()` on a persisted `pageshow` event. The new browser test dispatches that event and verifies a real session GET with ten query executions. This exercises the recovery handler, not a guarantee about every browser's back/forward cache eligibility.
- The partner-session callback also runs after read-only request-list refreshes detect another organizer's changes. Those reads return data without revalidating the route, so its explicit refresh remains.
- Existing pickup-game and navigation-related refreshes, plus session options/name editing, are outside this measured normal-session workflow and are left for separate verification.
- Other browser tabs are not automatically broadcast updated state by revalidation. Existing stale-version rejection, manual reload, request-list/tab-focus refresh, and browser restoration behavior remain available.

## Verification and limits

The new browser regression failed on the baseline's round start (`expected 0 GETs, received 1`). Baseline recording then completed the full workflow with the deliberately configured one-GET expectation. Both optimized desktop/mobile runs pass with the default zero-GET expectation, covering starts, score saving, advancement, historical correction/cancellation, attendance, court configuration, active reshuffle, undo, restoration refresh, and final reload persistence.

Unit/component tests (642), TypeScript, lint, and ten targeted browser cases pass. The additional eight browser regressions check stale-tab batch saving, score draft validation, corrections and undo, customized lineups surviving reload/start, and partner requests with organizer approval on both desktop and mobile. No database/service algorithms changed for this recommendation; PostgreSQL coverage from the first three optimizations remains applicable.

The fixture uses one fictitious account, seven guests, and two courts on the Neon test branch. Baseline and optimized runs create equivalent separate fixtures. Tracing is explicitly launched for the local development server, never imported by application code. A source edit triggered a hot reload during an early mobile measurement; that interrupted run was discarded, and both final runs were repeated with source unchanged.

This is a small controlled request-count comparison, not a load test or production latency claim. There is one baseline desktop workflow and one optimized workflow per device. Development overhead, network variability, shared test database history, and browser settling waits affect timings; no overall speed percentage is inferred from them.

## Reproduce

Requires Node.js 22.15+ for the test-only module hook, installed Playwright browsers, and `TEST_DATABASE_URL` targeting the allowlisted test endpoint. The server launcher and preload reject other database hosts. The E2E creates fictitious fixtures and runs normal score/replay mutations on that test branch; it is not read-only.

Start the traced server in a separate terminal:

```sh
node scripts/benchmarks/action-revalidation-server.mjs /tmp/action-revalidation-optimized.jsonl 3117
```

Run the regression against it:

```sh
DATABASE_URL=postgresql://blocked:blocked@127.0.0.1:1/forbidden PLAYWRIGHT_PORT=3117 NEXT_DIST_DIR=.next-test/action-revalidation npx playwright test tests/e2e/session-revalidation.spec.ts
```

To capture the old behavior, run the same harness/spec with the client source from `75e4c27`, `SESSION_REFRESH_EXPECTED_GETS=1`, and `--project='Desktop Chrome'`. Preserve a clean trace and Playwright stdout log per variant, stop the server between variants, and avoid source edits while recording. The baseline override is for recording only; normal verification leaves it unset.

Summarize the traces; the script rejects incomplete workflows, unattributed queries, mismatched browser/server request counts, and differing POST query budgets:

```sh
node scripts/benchmarks/summarize-action-revalidation.mjs BASELINE_TRACE BASELINE_LOG OPTIMIZED_TRACE OPTIMIZED_LOG
```

Targeted regression command:

```sh
DATABASE_URL=postgresql://blocked:blocked@127.0.0.1:1/forbidden PLAYWRIGHT_PORT=3117 NEXT_DIST_DIR=.next-test/action-revalidation npx playwright test tests/e2e/corrections.spec.ts tests/e2e/bulk-score-saving.spec.ts tests/e2e/partner-requests.spec.ts --grep 'handles match score corrections|custom lineup survives|Save All persists|a member requests a friend'
```
