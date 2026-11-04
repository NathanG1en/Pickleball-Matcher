/goal

HISTORICAL BASELINE (from an earlier build and DB state; keep for reference, do not use as the comparison control):

| Action | Desktop median (range) | Narrow viewport median (range) |
| --- | ---: | ---: |
| Confirm & Start | 1,177 ms (1,131–1,316) | 1,193 ms (1,123–1,277) |
| Save all three courts | 1,204 ms (1,124–1,856) | 1,195 ms (1,094–1,368) |
| Next Round | 1,833 ms (1,741–2,004) | 1,940 ms (1,805–2,102) |

TASK
Break down each action into where the time actually goes, then optimize each one.
Preserve observable behavior and existing concurrency guarantees. Every retained change must pass the correctness gate below. If equivalence cannot be demonstrated, revert the change and document the uncertainty.

STEP 0 — FRESH CONTROL
- Freeze the current pre-change build as the CONTROL.
- Compare the control and every candidate under identical fixtures, runtime, database settings, and network conditions.
- Report fresh control numbers alongside the historical baseline.

STEP 1 — MEASUREMENT METHOD (do not change it)
- Primary metric: click → expected DOM state, measured with the existing in-page observer harness.
- 10 observations per action per viewport (desktop + narrow), for control and each candidate.
- Report every observation. If any run is excluded, disclose it and give the reason.
- Rendering smoothness (paint, long tasks, layout shifts) is measured SEPARATELY as a secondary metric. It never replaces or modifies the primary metric.
- With 10 samples, label any median difference below ~5%, or any difference within the overlap of the ranges, as INCONCLUSIVE rather than an improvement.

STEP 2 — PROFILE BEFORE CHANGING ANYTHING
For each action, produce a critical-path TIMELINE, not a sum of durations:
- Show what actually delays completion, from click to expected DOM state.
- Network request duration contains server time, and server time contains DB time. Do not double-count nested spans.
- Parallel work overlaps. Show only the portion on the critical path as blocking.
- Include: client work before the request, each request (sequential vs parallel, payload size), server compute, DB queries (count, duration, N+1s), response handling, and re-render/refetch after success.
Optimize the largest critical-path slices first.

STEP 3 — OPTIMIZE (examples, not a required list)
- Sequential requests that can be parallelized or merged
- "Save all three courts" doing 3 round-trips instead of 1 batched write
- Writes followed by a full refetch when the response could return the updated state
- N+1 queries, missing indexes, unnecessary transactions or locks
- Heavy re-renders or recomputation on the client after success
- Optimistic UI ONLY where rollback on failure is implemented and tested

LIMITS ON WHAT MAY CHANGE
- Required ratings, chemistry, and persistence must complete BEFORE success is confirmed to the user. They may not be deferred past the timing boundary.
- Only truly non-critical work (e.g., logging, analytics) may run after the response.
- Hosting migrations, paid compute increases, and production database changes (schema, indexes, config) require separate authorization. Propose them in the report; do not apply them.
- Do not weaken requirements, reduce workload, or move required work beyond the timing boundary to meet a target.

STEP 4 — CORRECTNESS GATE
Run after each independently reviewable change (not every intermediate edit). A change is retained only if all of the following pass:

a) Test suites, all named explicitly:
   - Unit / component
   - Integration
   - Maintenance
   - Simulation
   - E2E

b) Deterministic state comparison against the control:
   - Fix matchmaking seeds, starting data, and the clock wherever possible.
   - Normalize generated IDs consistently before comparing.
   - These must match exactly: court/round assignments, scores, ratings, versions, attendance, history, and permissions.

c) Concurrency and edge cases:
   - Double-click / rapid repeat clicks
   - Two organizers submitting overlapping changes at the same time
   - Stale-version submissions (must be rejected or handled exactly as the control does)
   - Shared accounts playing across multiple groups
   - Refresh mid-action

d) Failure injection (server errors, slow/dropped network). Run these SEPARATELY from latency measurements so they don't contaminate timing data.

If any check fails or equivalence can't be shown, revert the change and document why.

STOPPING CONDITIONS — stop when EITHER is true, and only if the correctness gate passes on the final build:

A) Targets hit on the measured sample (medians, both viewports, with worst observed run within 1.5x of median):
   - Confirm & Start: ≤ 300 ms
   - Save all three courts: ≤ 300 ms
   - Next Round: ≤ 500 ms
   Condition A applies to the measured sample only. It is not a guaranteed production worst case; do not claim otherwise.

B) Diminishing returns, for every action not yet at target:
   - Your last 3 MEANINGFUL attempts each targeted a measured critical-path bottleneck (not trivial tweaks),
   - each was compared against the best verified version so far (not the original control),
   - and each yielded < 5% median improvement or an inconclusive result,
   - AND you can explain from the timeline what the remaining floor is (e.g., network latency, a required DB write, an external API, or a change needing authorization).

Do NOT stop early just because things feel faster.

FINAL REPORT
1. Historical baseline, fresh control, and final build, in the same table format
2. All raw observations, plus any excluded runs with reasons
3. Per-action critical-path timeline before and after
4. Each change: what it targeted, ms saved vs best prior version, and whether the result is significant or inconclusive
5. Correctness evidence: suites run, state comparisons, concurrency and failure-injection results, and anything reverted and why
6. Rendering/paint metrics (secondary)
7. Which stopping condition was met (A or B) and why
8. Proposed changes that need authorization (infra, paid compute, production DB), with estimated impact