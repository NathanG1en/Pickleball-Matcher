# Session action latency audit and optimizations

**Complete: stopping condition B, with the full correctness gate green. Condition A was not reached.** Six targeted changes reduced SQL executions from 21/21/24 to 16/17/20 (Start/Save/Next, including streamed page refresh). All whole-action attempt comparisons remain INCONCLUSIVE under the requested overlapping-range rule; the per-attempt results do not establish reliable production gains. No production database, hosting or paid-compute changes were applied.

## Historical reference (unchanged)

| Action | Desktop median (range) | Narrow viewport median (range) |
| --- | ---: | ---: |
| Confirm & Start | 1,177 ms (1,131–1,316) | 1,193 ms (1,123–1,277) |
| Save all three courts | 1,204 ms (1,124–1,856) | 1,195 ms (1,094–1,368) |
| Next Round | 1,833 ms (1,741–2,004) | 1,940 ms (1,805–2,102) |

These older measurements used another build and growing database state. They are reference only; the fresh control below is the comparison baseline. The exact historical narrow Next median was 1940.5 ms; the original displayed table is preserved.


## Fresh control — commit `50adab8`

| Action | Desktop median (range) | Narrow viewport median (range) |
| --- | ---: | ---: |
| Confirm & Start | 1,205.5 ms (1,138–1,597) | 1,161.5 ms (1,100–1,361) |
| Save all three courts | 1,085.5 ms (861–2,301) | 894.5 ms (803–1,034) |
| Next Round | 1,524 ms (1,374–1,817) | 1,387.5 ms (1,350–1,614) |

## Final build — cumulative history candidate

| Action | Desktop median (range) | Narrow viewport median (range) |
| --- | ---: | ---: |
| Confirm & Start | 636 ms (544–1,043) | 638.5 ms (543–1,155) |
| Save all three courts | 637 ms (514–1,183) | 664 ms (521–1,404) |
| Next Round | 1,057 ms (884–1,721) | 989.5 ms (876–1,289) |

[Every raw observation and per-attempt delta](2026-11-03-session-action-evidence.md), [machine-readable stopping proof](data/session-actions/stopping-audit.json), [completion audit](data/session-actions/completion-audit.json), [binding specification](2026-11-03-session-action-spec.md). The final build is not the minimum-median variant in every cell; all incremental comparisons against the best prior measurements have overlapping ranges. We retain the correctness-verified reduction in protocol exchanges and SQL statements without turning the sample into a production guarantee.

Net final-versus-fresh-control comparisons meet the requested improvement rule for desktop Start and narrow Next. The other four cells remain inconclusive. This net comparison is separate from the incremental best-prior comparisons used for stopping condition B.

| Viewport / action | Net median saved (ms) | Net saved | Conclusion |
| --- | ---: | ---: | --- |
| desktop / start | 569.5 | 47.2% | IMPROVEMENT |
| desktop / save-all | 448.5 | 41.3% | INCONCLUSIVE |
| desktop / next | 467.0 | 30.6% | INCONCLUSIVE |
| narrow / start | 523.0 | 45.0% | INCONCLUSIVE |
| narrow / save-all | 230.5 | 25.8% | INCONCLUSIVE |
| narrow / next | 398.0 | 28.7% | IMPROVEMENT |

## Measurement controls

Ten observations/action/viewport for control and each of six candidates: 420 accepted primary observations. Desktop 1280×900 and narrow 390×844 use the same desktop Chromium, no network throttling or mobile-device emulation. Node 25.2.1, Next 16.3.8, postgres.js 3.4.8, Neon PostgreSQL 18.6, production Webpack builds, max=10 connections and unchanged timeouts. Queries initially use prepare:false; attempt 1 changes only that to true.

The original capturing-click Date.now/MutationObserver block is byte-identical (observer SHA256 e228aae5d915692c8c91d0f55deaf535ded8721b19ff7115128c2672fbae1913). The expected Results/next-round headings, exactly three Final courts, 250 ms pre-click pause outside the timer, ten consecutive rounds, reshuffles before rounds 1–3, and alternating 11–6/7–11 scores remain. No primary warmups discarded. Removed only an obsolete ancillary attendance task after all primary desktop control observations; no primary sample lost. The original desktop height was unavailable; 900 px is fixed for every fresh comparison. Historical data is reference only.

Each viewport/candidate starts in a separate identically restored database: 23 accounts, 92 roster rows, 3 groups, 33 sessions, 152 rounds, 386 matches, 1535 participants, 98 chemistry rows, 373 attendance rows, 36 sits. Full operational fixture digest 16511ece78d5dde689cb320c1433cc62ab8cd8a5114dda3cc31e98cfd2562d52. Three maintenance configuration/audit tables are empty in every fixture; no production actor/configuration is copied. Migrations are applied separately and operational rows compared exactly. The branch quota required separate databases inside the existing isolated profiling Neon branch. Ports 3000/3001 and their live user data remain untouched. Primary measurements never overlap tests, builds, failure injection or profiling probes.

[Control source/harness/fixture manifest](data/session-actions/control-manifest.json); each candidate has its own source manifest and complete desktop/narrow request traces in data/session-actions. 795 tracked source files are checked; only the two documented runtime files differ. Sources are frozen exports, not mutable dev builds. Public traces contain counts, static SQL shapes and intervals, no SQL values, row contents, cookies or credentials.

## Before and after critical paths

All offsets below are milliseconds from click; rows select the observation nearest each action/viewport median. Nested server/network/SQL spans are never added. Each request has one POST and zero non-prefetch GETs in the primary window; prefetch/static traffic is retained separately. Full body wrapper byte counts and every SQL duration/order are in the evidence appendix and raw JSON.

### Control

| Viewport / action (round) | Request begins | Server begins | First response byte | Expected DOM | Stream finishes | SQL union before DOM | SQL count |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| desktop / start (1) | 4.5 | 5 | 914.5 | 1,229 | 1,224.4 | 1,186.5 | 21 |
| desktop / save-all (5) | 4.3 | 5 | 1,077.5 | 1,084 | 1,473.6 | 1,057.4 | 21 |
| desktop / next (3) | 3.2 | 3 | 1,070.2 | 1,520 | 1,516.9 | 1,429.8 | 24 |
| narrow / start (1) | 4 | 4 | 832.3 | 1,143 | 1,133.1 | 1,098.8 | 21 |
| narrow / save-all (4) | 3.5 | 4 | 887.2 | 894 | 1,186.6 | 865.9 | 21 |
| narrow / next (5) | 2.4 | 2 | 910.8 | 1,381 | 1,377.4 | 1,270.1 | 24 |

### Final

| Viewport / action (round) | Request begins | Server begins | First response byte | Expected DOM | Stream finishes | SQL union before DOM | SQL count |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| desktop / start (5) | 6.2 | 6 | 463.7 | 620 | 615.1 | 594.6 | 16 |
| desktop / save-all (9) | 1.8 | 2 | 639.2 | 648 | 931.4 | 632 | 17 |
| desktop / next (2) | 2.4 | 2 | 735.7 | 1,039 | 1,036.2 | 962.9 | 20 |
| narrow / start (5) | 5.7 | 21 | 442.7 | 637 | 633.5 | 594.9 | 16 |
| narrow / save-all (3) | 3.2 | 4 | 658.1 | 664 | 1,036.7 | 644.3 | 17 |
| narrow / next (2) | 3.7 | 4 | 801.4 | 1,018 | 1,014.4 | 937.8 | 20 |

Start: session/organizer authorization → BEGIN → current-session/version read → existing-round check → round/match/member/sit writes → session update → COMMIT → streamed page refresh → Results DOM. Round writes become one dependent CTE command; session history becomes one ordered JSON-aggregate read instead of a round read followed by child reads. The other initial page reads overlap; later organizer and partner/chemistry reads still follow their dependencies.

Save: already one action for all three courts, so three browser round trips were not the problem. Authorization → transaction/global lock → context/batched score write → roster/global replay history → calculate ratings → account/roster/snapshot writes → COMMIT → action result and streamed refresh. Compact history reduces transported rows; rating and snapshot writes become one command. Required ratings commit before success. Final cards appear before all refreshed-page SQL finishes; those later queries are shown but not counted as blocking the DOM metric.

Next: session/round/organizer reads → BEGIN/global lock → current-round context → completion update → required chemistry replay/replacement → COMMIT → refreshed page/history and 1200-iteration proposal → next-round DOM. Compact replay history and one-command chemistry replacement shorten the mutation path. One-command session history shortens the page dependency stage. Locks, version checks, authorization and simulation count are unchanged.

Client dispatch work is only a few milliseconds in representative samples. Response-to-DOM time includes ongoing stream delivery, parsing and React work, overlapping later server reads. SQL spans include driver/pool/network/executor time, not just database CPU; their interval union identifies waiting without adding parallel reads. No per-court N+1 was observed. The trace classifier reads only outer static templates, so the combined rating/account/roster/snapshot command can be labeled snapshot-write; the span still covers its complete execution. Whole-process CPU counters may include prefetch work and are not per-request function CPU.

## Six independently reviewable changes

| Attempt | Measured bottleneck and change | Targeted actions | SQL effect / correctness constraints |
| --- | --- | --- | --- |
| 1 prepared | Repeated protocol Describe exchanges; enable protocol prepared-statement reuse | all three | Same pool max/timeouts, SQL, locks and transactions; Neon supports protocol preparation |
| 2 replay | Global history transport 159–220 ms in representative traces; aggregate sorted 2v2 teams and return replay fields only | Save, Next | Same eligibility/filter/order, one row per match instead of four repeated rows |
| 3 round | Consecutive round/match/participant/sit writes; one parameterized CTE command | Start | Keep existing-ID early return and explicit RETURNING dependencies; whole-request SQL 21→19 |
| 4 rating | Separate rating/account/roster and snapshot writes | Save | One command with optional fragment; empty-player snapshot-only scope and unchanged-row suppression remain;21→20 |
| 5 chemistry | Separate DELETE then INSERT of chemistry aggregates | Next | One command consuming DELETE output; empty clear, rollback and global lock remain;24→23 |
| 6 history | Round-history read followed by three child reads on refreshed page | Start, Next | One explicitly ordered/projection-limited JSON command; restore Dates/nonfinite numbers, transaction connection and empty/scope semantics; removes 3 SQL/request |

Individual patches [01](data/session-actions/changes/01-prepared.patch), [02](data/session-actions/changes/02-replay.patch), [03](data/session-actions/changes/03-round.patch), [04](data/session-actions/changes/04-rating.patch), [05](data/session-actions/changes/05-chemistry.patch), [06](data/session-actions/changes/06-history.patch) show each runtime change separately. Exact milliseconds saved versus the lowest-median previously verified build, including negative deltas and all untargeted actions, are tabulated in the evidence appendix. All comparisons are INCONCLUSIVE because ranges overlap. Untargeted observations never count toward condition B.

Protocol preparation is compatible with this repository's Neon transaction pooler ([Neon protocol preparation documentation](https://neon.com/docs/connect/connection-pooling#protocol-level-prepared-statements)); SQL-level PREPARE is not used. DML statements consume RETURNING output rather than relying on textual CTE ordering ([PostgreSQL data-modifying WITH](https://www.postgresql.org/docs/current/queries-with.html#QUERIES-WITH-MODIFYING)). No source statement is merely moved past confirmed success.

## Correctness gate and review

| Build | Unit/component | Integration (zero skips) | Maintenance | Simulation | E2E (retries=0) |
| --- | ---: | ---: | ---: | ---: | ---: |
| original control | 689 | 53 | 12 | 12 | 108 existing + 44 resilience separately |
| prepared | 690 | 54 | 12 | 12 | 152 |
| replay | 690 | 55 | 12 | 12 | 152 |
| round | 690 | 57 | 12 | 12 | 152 |
| rating | 690 | 57 | 12 | 12 | 152 |
| chemistry | 690 | 61 | 12 | 12 | 152 |
| final history | 692 | 62 | 12 | 12 | 152 |

[Hashed per-candidate correctness evidence](data/session-actions/correctness-gate.json) records suite counts, final source hashes and earlier failures. Every retained candidate also passed lint, typecheck and production build. Commands: npm test; npm run test:integration; npm run test:maintenance; npm run test:simulation; npm run lint; npm run typecheck; npm run build -- --webpack; npm run test:e2e -- --retries=0. Integration/maintenance/E2E use an explicitly guarded disposable loopback PostgreSQL 18.6 server and separate test_db via the private gate-run wrapper, never .env.local. CI receives the same explicit disposable-local test opt-in.

The immutable control archive SHA256 f9217fe4f69a7c6e85fa159fd12e51c2a91c33b9fa8daab3e892b6ae307bd019 is verified before extraction. Two independent processes execute the frozen `50adab8` source and current source with their own aliases, fixed IDs, seeds and clocks. All 20 checkpoints match exact results and persisted account/roster ratings, snapshots, chemistry, assignments, rounds, scores, versions, attendance, sits, history and organizer permissions. The checkpoints include shared accounts in different groups, stale/no-op failures, repeated completion, historical correction, cancellation and permission revocation. A fresh reviewer independently compared all 164 archived files with Git, found no mismatch and no Critical/Important/Minor code findings.

The 44 added browser cases (22 per viewport) cover each target action: real server error via isolated fixture triggers and rollback/retry; revoked organizer permission after render; delayed/dropped requests; rapid clicks; refresh before dispatch; committed response lost followed by refresh and exact stale retry; independent authenticated organizers racing; shared accounts scoring in two groups. Integration tests check failed foreign keys, duplicate/invalid chemistry rollback, transaction binding, unchanged-row suppression and foreign-session scope. Fixture trigger DDL uses its own lease so test setup cannot deadlock; actual organizer concurrency remains real.

Control semantics are preserved: repeated completeRound can be accepted and bump version/completedAt again, while ratings/chemistry and round count are not duplicated. A concurrent Start loser may get the control's stale-version or unique-round conflict. We did not silently change these behaviors under a performance task.

Resolved setup/gate failures are disclosed: candidate 5 parallel builds exhausted disk; only audit compilation caches were cleared, then sequential production builds and full E2E passed. Candidate 6 first fast gate found three stale query-structure expectations; they were updated while retaining full state/scope/rollback assertions and adding read-error cases, then all suites passed. Candidate 6's first full browser run passed 151/152; one mobile confirmation detached before dispatch. Three isolated sequential traced runs passed, followed by a complete 152/152 traced run with retries=0. The original intermittent detachment's cause was not established and is a disclosed validation limitation; no product patch or assertion weakening was used to hide it. A separate parallel diagnostic had an explained Date.now group-name collision; its alert correctly rejected a duplicate. No such diagnostic was a primary timing observation. No product optimization was reverted; all retained changes meet exact state comparisons.

## Separate paint and rendering measurements

No primary browser long tasks were recorded in any accepted build. Input-associated layout shifts did occur; their values remain in every raw sample. None had hadRecentInput=false, so this is not a claim of zero visible movement. Navigation paint entries do not establish action paint completion. Separate round 11 CDP traces supply actual Paint events for control and final (one observation/action/viewport, six each); these never enter target latency or significance tests.

| Build / viewport / action | First Paint after DOM | Layout | Style | Script |
| --- | ---: | ---: | ---: | ---: |
| control / desktop / start | 6.7 | 1.6 | 10.1 | 18.1 |
| control / desktop / save-all | 11.6 | 1.4 | 6.2 | 16.9 |
| control / desktop / next | 10.3 | 1.1 | 11.1 | 11.6 |
| control / narrow / start | 7.5 | 1.4 | 5.9 | 18 |
| control / narrow / save-all | 8.7 | 0.9 | 4.1 | 8.8 |
| control / narrow / next | 6.6 | 2 | 8.2 | 10.1 |
| final / desktop / start | 6.8 | 1.9 | 17.2 | 18.8 |
| final / desktop / save-all | 4.6 | 1.4 | 4.4 | 20.5 |
| final / desktop / next | 4.2 | 1.1 | 12.1 | 7.6 |
| final / narrow / start | 6.6 | 1.7 | 14.2 | 13.8 |
| final / narrow / save-all | 11.5 | 4 | 8.3 | 31.3 |
| final / narrow / next | 6.9 | 2.5 | 24.1 | 8.5 |

[Control render events/profiles](data/session-actions/render.json), [final render events/profiles](data/session-actions/render-final/render.json). Layout/style/script spans describe overlapping diagnostic work and must not be summed with parent request spans. Sampled server CPU profiles are approximate and separate from primary timings.

## Exclusions, outliers and remaining floor

Only one complete control narrow run (v3, 30 target observations) was excluded because Vitest helper RED/GREEN processes overlapped its timed intervals at 22:59:15/22:59:53 UTC. [Every excluded value](data/session-actions/excluded-narrow-v3.json) is retained; the accepted control uses an identically restored v4 database. No candidate sample was excluded. Setup/create/reshuffle observations remain private ancillary measurements; all ten observations of every target action are public.

The replay desktop Next 5172 ms outlier remains. The browser began its request about 3 ms after click, but the server handler began 3867 ms after click, then ran 1302 ms. The trace demonstrates a pre-handler HTTP gap, not its cause. The rating desktop Save 2117 ms outlier also remains. No value-based exclusion or trimming was applied.

Read-only PostgreSQL diagnostics separate CPU from remote waiting: roster execution 0.123 ms/planning 0.155 ms versus 38.658 ms end-to-end; global history execution 2.147 ms/planning 0.401 ms versus 41.780 ms end-to-end. A separate 30-sample prepared SELECT 1 probe after 3 warmups measured median 37.187 ms, min 35.923 ms, max 127.780 ms; separate executor time 0.014 ms. This is the measured Mac→Neon path, not a universal database minimum or production prediction. Write spans still include pool/driver/network/lock/executor and cannot be cleanly split by this instrumentation. pg_stat_statements was absent; no extension/configuration was changed. [Raw CPU/EXPLAIN](data/session-actions/control-diagnostic.json), [transport probe](data/session-actions/transport-floor.json).

With inputs already loaded, 30 CPU observations after 3 warmups measured rating replay 0.535 ms median, chemistry 0.650 ms and unchanged 1200-iteration proposal 54.466 ms (43.478–164.142 ms). Fixture: 12 active players, 10 session rounds, 92 global roster rows, 409 replayable matches. Thus matchmaking is measurable compute, but remote query waits dominate these action timelines.

Final architecture has roughly 11 dependent round-trip windows for Start (8 mutation + 3 page stages), 9 for Save before its primary DOM, and 15 for Next (12 mutation + 3 page stages). At the separately observed 36–37 ms best-case tiny-query route, an illustrative wait model is roughly 400/330/550 ms before payload and compute, plus about 54 ms proposal compute on Next. This is an explanation of the current architecture and route, not proof that further consolidation is impossible. Authentication, optimistic versions, transactions and globally consistent replay/chemistry remain synchronous.

## Why stopping condition B is satisfied

Condition A is false: final medians exceed targets; maxima/medians are also recorded in the audit. For each above-target action and both viewports, the last three meaningful attempts targeted observed blocking work and were compared with the lowest observed median among fully verified prior versions:

| Action | Last three targeted attempts | Both-viewports conclusion |
| --- | --- | --- |
| Confirm & Start | prepared, round, history | all INCONCLUSIVE |
| Save all three courts | prepared, replay, rating | all INCONCLUSIVE |
| Next Round | replay, chemistry, history | all INCONCLUSIVE |

The mechanical audit asserts ten samples/cell and applies the literal overlapping-range rule. These results satisfy the requested diminishing-returns rule, while leaving a measured remote-round-trip floor to investigate. They do not show that every possible future optimization is exhausted. Exact state equality, all named final suites and independent review are green.

## Proposals requiring separate authorization

First run a production-like colocated app/Neon comparison on an isolated deployment, with the same fixtures and observer. The current test app runs on this Mac; the user reported the deployed app in us-east-1, while the profiling Neon endpoint is us-east-2. Verify actual deployed placement before choosing a move. If measured per-stage remote latency fell 37→10 ms, the 11/9/15-window model suggests roughly 297/243/405 ms less backend waiting for Start/Save/Next; this is an illustrative scenario, not a measured production forecast, and browser HTTPS latency remains. Hosting/DB region migration requires approval.

Paid compute is not presently justified by the sub-3 ms measured read executors. Profile actual locks, write executor time and connection pressure under expected simultaneous clubs before buying larger compute. No defensible numeric benefit is available for a compute increase yet. Any production extension/index/config change needs approval; do not assume an index helps when the current executor work is already tiny.

A later app-level proposal could consolidate additional authorization/context reads or return authoritative page state directly, but it would cross stronger security/state boundaries and needs its own control-equivalence/concurrency plan. The current 54 ms proposal compute bounds a best-case gain from eliminating all of that CPU; reducing simulation quality was outside this goal.

## Decisions and review limits

The desktop height was fixed at 900 px because historical height was missing; cost if wrong: historical rendering is not directly comparable (already excluded). The branch quota was handled with separate databases in the existing profiling branch; cost if wrong: shared compute can introduce variance, so fixtures and route were held fixed and overlapping differences remain inconclusive. The reviewer did not assess other poolers/custom SQL roles; cost if wrong: custom deployments may need prepare:false or different grants, so validate them separately. No deferred minor findings.

At audit completion the six runtime patches preserved per-attempt reviewability while changes remained uncommitted. The follow-up PR groups the verified implementation/tests and benchmark documentation into separate commits on `optimizations/session-action-latency`. The branch was fast-forwarded to the latest `development` merge commit, whose source tree is identical to the frozen control; no benchmark runtime changed.
