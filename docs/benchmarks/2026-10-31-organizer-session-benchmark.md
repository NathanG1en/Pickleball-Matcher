# Organizer session benchmark — October 31, 2026

The largest observed wait is saving several courts separately. For four courts, the existing **Save All Scores** flow reduced browser waiting from **6.09 s to 2.38 s**, about **61%** in this run. The next useful engineering work is reducing database round trips, rather than reducing matchmaking iterations.

## Setup and limits

- Baseline: `development`, commit `c6e4615`.
- Optimized Next.js 16.3.8 production build, served locally on port **3115**. The user's development server on port 3000 was left running.
- Chromium desktop, no artificial network/CPU throttling. Browser, Node server, and CPU benchmarks ran on the same Mac; Neon was remote. Database and browser timing runs did not overlap.
- Only the allowlisted **Neon test branch** (`br-damp-mountain-b4z1c3r1`) was used. No production queries or mutations were needed.
- Backend scenarios: 8/16/24 registered players, 2/4/6 doubles courts, three rounds each. Browser scenario: 16 registered players, four doubles courts, four rounds.
- Initial shared test database contained 346 roster rows, 153 accounts, and 32 completed rated matches. Measurements include this existing background history. This is a small dataset, not a production-scale load test.
- Browser time is from the action click to the specified visible result. Preparing score inputs, opening confirmation dialogs, and passive diagnostic waits are excluded. The start-round timer begins at **Confirm & Start**. The session-ending confirmation was accepted automatically.
- Most repeated actions have 3–4 samples; some actions have only one. Tables show medians and ranges, **not p95s or guarantees**. Individual versus batch saves occurred in different rounds; the comparison is supported by query counts but is not a randomized A/B trial.
- No application implementation was changed. Benchmark fixtures were created on the test branch and retained for inspection. The audit does not cover Open Play, tournaments, real mobile hardware, or concurrent organizers.

## Browser results

| Organizer action | Samples | Median | Observed range |
| --- | ---: | ---: | ---: |
| Start session → first proposal visible | 1 | 2.33 s | — |
| Reshuffle proposal → control ready | 3 | 1.02 s | 0.76–1.42 s |
| Confirm start → results screen | 4 | 1.84 s | 1.83–2.82 s |
| Save four courts individually → final results | 1 | 6.09 s | — |
| Save all four scores → final results | 3 | 2.38 s | 2.32–2.39 s |
| Next Round → next proposal visible | 3 | 2.84 s | 2.83–2.84 s |
| Mark player left → Away visible | 3 | 0.83 s | 0.81–1.33 s |
| Mark player present → Present visible | 3 | 1.32 s | 0.82–1.33 s |
| Save unchanged court configuration → success message | 1 | 1.34 s | — |
| Correct historical score → editor closes | 3 | 1.84 s | 1.84–1.84 s |
| End session → group dashboard | 1 | 2.58 s | — |

Saving together also needs **one submit click instead of four**; both flows still require entering the eight score values. Making this existing option easier to notice would provide an immediate workflow improvement without changing rating calculations.

The first session navigation loaded a session JavaScript chunk of about **535 KiB decoded**. That is not compressed transfer size. It was not the dominant delay on this local connection; a separate bundle/network audit would be needed before prioritizing it for mobile users.

## Backend results and query counts

These timings call the real `SessionService` and PostgreSQL repository against Neon. They exclude browser rendering, action authentication/validation, and route refreshes. SQL counts include transaction control and advisory-lock statements.

| Operation | 8 players / 2 courts | 16 players / 4 courts | 24 players / 6 courts |
| --- | ---: | ---: | ---: |
| Save all courts individually, one run | 2.49 s / 28 SQL | 4.39 s / 56 SQL | 6.82 s / 84 SQL |
| Save all scores, median of two runs | 1.52 s / 18 SQL | 2.18 s / 26 SQL | 2.84 s / 34 SQL |
| Complete round, median of three runs | 1.01 s / 14 SQL | 1.04 s / 14 SQL | 1.04 s / 14 SQL |
| Historical score correction, median of three runs | 1.42 s / 19 SQL | 1.40 s / 19 SQL | 1.45 s / 19 SQL |

A four-court batch save still executes `getMatch`, `getRound`, `getSession`, and `updateMatch` **four times each**. In one representative 2.18 s sample, those 16 calls consumed about **1.42 s**. Replacing rating state consumed another **0.48 s**. Merely batching the HTTP request has not eliminated per-court database work.

A warmed `SELECT 1` had a median round trip of **38 ms**; the first sample in the final pass was **539 ms**. Those are client-observed times, not PostgreSQL execution time or proof of Neon compute wakeup. Many sequential queries accumulate into seconds even when individual SQL statements are small.

## Read-only optimization experiment

`listStartedRounds` currently loads rounds, matches, match players, and sitters with **four sequential queries**. The prototype in `read-and-cpu.mjs` makes four independent queries concurrently, joining each child table back to the session.

| Variant | Samples | Median | Range |
| --- | ---: | ---: | ---: |
| Existing repository read | 7 | 495 ms | 373–582 ms |
| Concurrent read prototype | 7 | 80 ms | 78–90 ms |

This is an **84% reduction for this read operation** in the final pass, about **415 ms**, not an 84% reduction in the whole app. Order was alternated after warming the connection pool. The final prototype selects the same database columns as the existing read, though mapping work differs. Both variants still issue four SQL queries; concurrency removes dependencies between network trips.

An earlier pilot with a smaller column projection measured **318 → 115 ms**. The absolute times varied substantially between passes, so the defensible conclusion is a saving of a few hundred milliseconds per read in this environment, not a guaranteed percentage. Pilot samples are retained in `pilot-read.json`; the full-column run is in `read-and-cpu.json`.

The harness asserted agreement on round IDs/status/versions, match identities/scores/versions/rated flags, participant ratings, and sitters. It is a focused prototype, not a complete replacement mapper or a concurrency correctness test. The benchmark ran outside a transaction with the application's ten-connection pool size; transaction-bound reads on one connection need separate treatment.

## CPU measurements

With the current **1,200 matchmaking iterations**, seven warm in-memory proposal samples had these medians:

| Players | Matchmaking time |
| ---: | ---: |
| 8 | 13 ms |
| 16 | 31 ms |
| 24 | 59 ms |

These are first-round proposals with no prior round history. They isolate computation from database/network time; they do not establish a bound for late-session or heavily constrained Stay Together lineups.

Synthetic replay calculations with 16 players and repeated pairings took about **10 ms for rating replay plus 24 ms for chemistry calculation at 10,000 matches**, median of five warm samples. Database reads/writes and locking are excluded. Real datasets with more players and partner combinations may behave differently.

## Suggested work, in order

### 1. Reduce per-court queries in batch score saving

In `SessionService.recordMultipleResults`, bulk-fetch the selected matches with their round/session context, then bulk-update scores in the existing transaction. Avoid retrieving the same round and session four times. Preserve ownership checks, score validation, concurrency rules, the chemistry lock, and rating replay semantics.

**Evidence:** 26 SQL statements for four courts; 16 repeated lookup/update calls. A bulk join and bulk update could reduce that set of 16 statements to two, but the resulting end-to-end improvement has **not** been measured. Add cross-session, stale-version, partial-failure, and rating/chemistry regression checks before adopting it.

### 2. Parallelize independent session-history reads

Promote the read prototype into the repository with full mapping and correctness coverage. This helps proposal loading, session rendering, round completion, and other paths that read started rounds.

**Evidence:** a few hundred milliseconds saved in the two isolated passes above. Check pool use under several organizers and preserve consistent transactional behavior.

### 3. Reuse data already loaded during a request

The session page loads the session, players, attendance, and rounds, then `proposeRound` fetches those inputs again. Let proposal construction accept an already validated input snapshot, or memoize these reads within a single request. Several action wrappers similarly reload the same session before the service does.

**Evidence:** explicit duplicate reads in the page/service call chain. The page-level gain has not yet been measured. Avoid cross-request caches of attendance, permissions, or current ratings.

### 4. Check action revalidation plus explicit refresh

Starting/advancing rounds and correcting history return action responses and also initiate session GETs through `router.refresh()`. Determine which reads are necessary before removing any refresh.

**Evidence:** browser request records plus matching client handlers. Request totals include cheap prefetch shells and some streamed responses that outlived the bounded capture window; **they do not prove every GET ran a full database render**. Add server-side request/query instrumentation for this follow-up. Preserve multi-tab updates and durable lineup behavior.

### 5. Reduce repeated global replay work after the smaller changes

Historical corrections fetch all players and replay matches twice: once for ratings and again for chemistry. Reuse the authoritative history and calculated rating snapshots within that transaction where possible.

Longer term, evaluate a carefully validated append-only fast path with replay for corrections. Current rating replacement writes all replayed player/account/snapshot state, and chemistry replacement rebuilds the global aggregate under a shared advisory lock.

**Evidence:** two `listPlayers` and two `listReplayMatches` calls per correction, plus global queries in both replay helpers. This is primarily a scaling concern with the small history tested here. **Do not simply replay only the current group or remove the lock:** accounts can play across groups, and prior correction work depends on coherent historical ratings and chemistry.

## Evidence and rerunning

Artifacts are in [`output/playwright/organizer-benchmark-2026-10-31/`](../../output/playwright/organizer-benchmark-2026-10-31/):

- `backend.json`: every backend action, SQL count, and timed repository method.
- `browser.json`: all 26 measured browser actions and sanitized request metadata; no cookies or request bodies.
- `read-and-cpu.json` and `summary.json`: prototype/CPU samples and aggregate statistics.
- `fixtures.json`: generated test groups, sessions, and account usernames.
- Screenshots of the proposal, later round, attendance settings, and dashboard after completion.
- `backend.mjs`, `read-and-cpu.mjs`, `server.mjs`, and browser code files: reproducible harnesses. See `README.md` there before running; the write harness adds fixtures and replays test-branch ratings.

No changes have been committed or pushed by this audit. Product implementation and schema remain unchanged.
