# Current club session performance profile

Scope: one organizer actively editing a normal club session. The goal is immediate feedback and short waits for confirmed results. Multi-session load/capacity testing is deferred. Future changes must retain concurrency safety. This pass measures the app; it does not change production behavior, matchmaking rules, or the 1,200-iteration setting.

Follow-up: recommendation 1's round-completion read has now been implemented and measured separately in [Focused Next Round completion read](2026-10-31-focused-round-completion.md). The baseline measurements below remain unchanged.

## Findings

Database round trips and replay persistence are the first places to investigate for a substantial improvement in organizer waiting. Matchmaking has identifiable CPU inefficiencies, but its computation is much shorter than the measured session actions. Reducing calculation alone cannot account for the whole wait.

Pending-state DOM feedback was typically 2 ms in the initial desktop runs (1–6 ms across the three common actions). This is a DOM observation, **not** a measurement of first paint, animation smoothness, or INP. Fast feedback and completed work are separate measurements.

### Browser-visible results

The final measurements record readiness inside the page with a MutationObserver, starting at the actual button click. The collector then verifies the expected UI and a successful action response. Data-entry time, confirmation-dialog preparation, scrolling, and the 250 ms pauses between actions are excluded.

| Action | Desktop median (range) | Narrow viewport median (range) |
| --- | ---: | ---: |
| Confirm & Start | 1,177 ms (1,131–1,316) | 1,193 ms (1,123–1,277) |
| Save all three courts | 1,204 ms (1,124–1,856) | 1,195 ms (1,094–1,368) |
| Next Round | 1,833 ms (1,741–2,004) | 1,940 ms (1,805–2,102) |

Ten observations per main action and viewport are sufficient for this initial diagnosis, not a reliable production p95. The desktop is 1280 px wide; the narrow viewport is 390 × 844 on the same Mac and desktop Chromium. There is no mobile CPU, touch, or network emulation, so the narrow run is a responsive-layout check rather than a real-phone benchmark.

An earlier pass recorded 30 observations per main action across three desktop sessions and ten in a narrow session. Playwright's own visibility polling introduced delay between the actual DOM change and when the collector noticed it. Those observations and their exploratory percentiles remain in the data for transparency; they are **not the final browser-latency table**. The second pass added in-page timestamps rather than subtracting a guessed fixed delay. Its database history is also larger, so this is not a controlled before/after speedup comparison.

### Backend service work

These are separate SessionService calls, not full browser actions or additive components to subtract directly from browser timings. Ten consecutive rounds used 12 registered players on three courts.

| Service operation | Samples | Median | SQL executions |
| --- | ---: | ---: | ---: |
| Propose round, including reads | 10 | 368 ms | 7 |
| Start round using supplied proposal | 10 | 622 ms | 8 |
| Save all three scores | 10 | 987 ms | 12 |
| Complete round | 10 | 1,011 ms | 14 |
| Correct historical score | 5 | 1,338 ms | 17 |

The full action also performs authorization and server rendering. In the initial 30 desktop observations, start/save/next used 20/23/28 SQL executions respectively, with median server durations of 1,187/1,531/1,951 ms. A database query was outstanding during a median 99%/99%/96% of those server-request timelines. This is the union of query intervals; overlapping queries are not added twice.

An outstanding query includes driver, connection, pool, network, and PostgreSQL time. This is **not** a PostgreSQL execution-time measurement or proof of a slow query plan. Query categories can overlap, and their sums must not be added to request duration. The driver hook counted each lazy query once in its request context; all measured requests had zero unattributed query events.

Some action results update local UI before the remaining server-rendered Flight response finishes. Conversely, other UI updates wait for that rendered response. Browser readiness, response headers, full response completion, and a database commit are different milestones; the report does not treat them as interchangeable. Persisted final state is checked separately after all runs.

### Matchmaking CPU

These are in-memory proposal-preparation calls using the existing service, with no database or network access. Each scenario has three warmups and 30 samples with different seeds. There are still 1,200 search iterations. Inspector sampling at 1 ms was enabled, so treat the timings as diagnostic measurements with profiling overhead.

| Scenario | Median calculation |
| --- | ---: |
| 12 players, first round | 17 ms |
| 12 players, after ten rounds | 40 ms |
| 13 players, two Stay Together pairs, one bench spot, after ten rounds | 9 ms |
| 24 players, after ten rounds | 84 ms |
| 24 players, Wild variety, after ten rounds | 88 ms |

The paired and unpaired generators follow different search paths; the paired result does not establish that adding pairs always makes generation faster. Every sampled proposal included every player exactly once. Same-seed equality and the applicable Stay Together rule, including the approved one-seat-bench exception, were checked.

The CPU profile points to two concrete sources of repeated work:

- `score-round.ts` rebuilds the player lookup in `scoreSkillBalance` and again in `scoreRound`. Normal generation evaluates all three team arrangements for each candidate court, then scores the assembled round.
- `pairs.ts` converts and sorts the unchanged recency curves inside `recencyPenalty` for repeated pair evaluations.

Across the diagnostic profile, `playerIndex` and `recencyPenalty` account for approximately 33% and 27% of sampled leaf frames. The recording includes fixture preparation, warmups, and assertions, so these shares are **not** fractions of a production request. They identify candidates to investigate, not guaranteed optimization savings.

## Recommended work, in order

1. **Reduce database work on the common action path.** Start with Next Round and the reads used to render fresh session state. `completeRound` spent a median 368 ms loading started rounds; it loads all started rounds and then finds the current one. Investigate fetching the required current-round context directly and reducing serialized read stages, while retaining unresolved-match validation and singles cancellation. Trace the action's authorization/render reads before introducing a request-local authorized snapshot. Preserve fresh transaction checks; a snapshot must not become a cross-request cache of permissions or attendance. The remaining useful change is reducing necessary reads, not another blanket removal of refreshes: the common browser mutations already produced one POST and zero follow-up session GETs.

2. **Reduce replay persistence before building a full incremental engine.** `replaceRatingState` took a median 490 ms of the roughly 987 ms backend Save All call. It updates roster ratings, account ratings, account-linked roster ratings again, clears match-player snapshots, then writes snapshots. Investigate avoiding duplicate/unchanged writes and combining round trips while preserving guest behavior, shared-account propagation, and removal of stale snapshots after corrections. Simply skipping unchanged rows may reduce database work without eliminating network trips, so measure both. This evidence supports a focused persistence investigation; it does not justify implementing the entire append-only/incremental replay design immediately.

3. **Precompute matchmaking scoring inputs once per proposal.** Build the player index, recency-curve representation, and applicable pair costs once. Keep data local to the calculation, retain the existing search budget and seed behavior, and compare exact proposal results where arithmetic/order permits. This is a contained CPU opportunity that avoids shared mutable state. Expect its impact to be measured in the calculation's tens of milliseconds at these sizes; no speedup has been implemented or established.

4. **Check production placement and first-use latency before choosing infrastructure changes.** This run places the app on a Mac and Neon remotely. It cannot establish the production application region, connection behavior, or real-device latency. Measure those before increasing compute or moving hosting. Keep first-use connection measurements separate from ordinary warmed requests.

After each candidate change, rerun the same representative actions and compare persisted outputs as well as latency. Do not combine several optimizations and then attribute the result to one of them.

## Proposed experience targets

These are starting goals for discussion, not agreed SLOs or promises about the current hosting setup:

- Visible pending feedback within 100 ms, verified with a paint-aware browser measurement on a representative phone. The DOM signal in this audit is only a proxy.
- For frequent warm actions, work toward a median below 500 ms and p95 below one second. Start/Save All/Next Round should be measured separately.
- Treat history corrections and session ending as secondary workflows; retain reliable saving and clear pending feedback while the common paths are improved.

The present measurements do not meet the proposed completion targets. Consistency matters too: the initial desktop request/driver runs contained occasional multi-second samples. Their cause was not isolated to SQL execution, application scheduling, or network variability, so investigate rather than assigning them to matchmaking.

## Concurrency constraints and deferred work

No performance implementation was made in this pass. Future work should:

- Preserve transaction boundaries, version/conflict checks, idempotent behavior, and authoritative server authorization.
- Retain the global rating/chemistry lock unless a separately validated replacement exists. Accounts can play across groups; group-only replay is not a safe shortcut.
- Prefer request-local indexes and snapshots. Avoid shared mutable caches, unbounded parallel queries, larger pools without evidence, or additional replay work on ordinary page reads.
- Keep confirmed score saving atomic with its required rating updates. Do not show a successful save merely because a background task was queued.
- Retain correction, undo, shared-account, rollback, and stale-editor regression coverage for any later optimization.

On the backburner: simultaneous independent sessions, actual lock contention, shared accounts across concurrently edited groups, larger global histories, and sustained capacity tests. Revisit when separate sessions commonly overlap or organizers report delays coinciding with another session's scoring. One-editor results are not evidence of multi-session capacity. This audit neither removes nor recommends weakening protections for an accidental second editor.

## Setup, evidence, and verification

- Application source: `f2b2867a846c4449513568e1391a6c4094248878`, the optimized branch after recommendations 1–5 stage 1.
- Frozen Next.js 16.3.8 Webpack production build; Node v25.2.1. The deployed Netlify configuration specifies Node 22, so runtime differences remain a limitation.
- Dedicated Neon branch `profiling-current-club-20261031` (`br-aged-frost-b4ec4lp9`), copied from development. Its endpoint is explicitly allowlisted by the harness. Development, production, and the two A/B playground databases were not modified.
- Before fixture creation: 11 accounts, 80 roster rows, and 164 completed rated matches. The harness adds 12 fictitious accounts. The background history grows during the sequential runs; this reflects repeated session use rather than a fixed-state randomized trial.
- Backend, CPU, browser, and final read-only diagnostics run separately. Only one organizer edits at a time; no artificial CPU/network throttling or simultaneous-session load is applied.
- Timing captures no database passwords, cookies, SQL parameters, SQL results, or response bodies. The private database environment file is outside the repository. The JSON contains synthetic fixture metadata and timing/count data.
- All proposal coverage/determinism assertions, browser readiness checks, successful response checks, one-POST/zero-extra-GET checks for the common mutations, query attribution checks, and final persisted-state checks passed. No product behavior changed, so the full application test suite was not rerun for this audit.

The final read-only check verified **7 completed fixture sessions, 70 completed rounds, and 210 completed matches**, with four distinct players per match and 70 rated games for the host. There were 92 roster rows and 379 source matches in the final global replay input. Thirty in-memory replays of that input had median rating calculation **0.48 ms** and chemistry calculation **0.71 ms**, excluding I/O. Twenty warm pooled `SELECT 1` calls had median **38 ms** (range 37–121 ms); the first call on a fresh connection took **435 ms**. That first call includes connection establishment to an already-used database; it is not a measured Neon cold wakeup.

Raw samples and summaries: [current-club-profile.json](data/current-club-profile.json). The older driver-based browser figures are retained alongside the final in-page DOM measurements with explicit labels.

Backend/CPU harness: [current-club-profile.mjs](../../scripts/benchmarks/current-club-profile.mjs). Local browser collector, query preload, CPU profile, screenshots, and detailed logs are in `output/playwright/current-club-profile-2026-10-31/`. They are measurement artifacts and are not imported by the app.

The initial response-body collector stalled while the UI had already updated. That incomplete sample was excluded. The final collector observes the page directly and uses the server trace separately for full request timing. Later in-page timestamps also remove the visibility-polling delay from the final readiness table.

For a repeat: use a fresh isolated profiling branch; review and update the explicit endpoint guards before pointing the harness at it. Do not rerun the seed against the existing fixture: it deliberately refuses duplicates. Run the backend/CPU harness first, start the local production server with the explicit preload, then run the browser collector sequentially. Finish with read-only diagnostics and the summary assertions. The retained fixture-count assertions describe this exact run and must be updated for a deliberately different scenario. Do not reset a shared database to repeat the audit.

The audit's local server is stopped after measurement. The A/B playground servers on ports 3000 and 3001 remain available. The isolated profiling database is retained for inspection. The audit initially left its findings local; the user subsequently authorized committing and pushing the report, sanitized measurements, and backend/CPU harness.
