# SQLite multi-user exploratory audit

Audited October 23–24, 2026. **Seven grouped findings**, with screenshots, reproduction steps, and proposed fixes. This is an audit; no product fixes were applied.

## Environment and scope

- Code snapshot: `5098a60`, branch `feat/matchmaking-2v1-penalty-and-court-choice`. The audit used a separate checkout based on that exact commit, rather than changing the working checkout.
- Real Next.js application at `http://localhost:3104`, driven with Playwright CLI in Chromium. Desktop viewport 1440 × 1000; mobile layout checks at 390 × 844.
- Dedicated local SQLite file, initially empty. Nine fictitious accounts were created through signup, with different starting ratings and genders. Four guest players were added through the UI; an anonymous temporary group used five more names.
- Separate browser contexts represented Audrey (host), Blake (organizer), Casey (member), Drew (private profile), Ellis (initial outsider), Kai (member/host of a separate group), and an anonymous visitor. Other accounts filled the playing roster.
- No production or Neon database was used. Postgres connections were explicitly blocked in the audit copy. No real users, passwords, sessions, or screenshots of real data are included here.

**SQLite limitation:** the application normally uses Postgres. Its existing simulation adapter was extended only in the isolated audit checkout to support real UI requests, tournament storage, and chemistry storage using the application's actual chemistry calculator. Missing account-gender hydration in the simulation adapter was corrected in the harness before tournament testing. These adapter gaps are **not** counted as product bugs. The findings below were checked against the shared application code and, where persistence mattered, the Postgres repository implementation. Postgres locking, deployment cookies, database policies, network failures, and production performance remain untested.

## Findings at a glance

| ID | Priority | Finding | Verified by |
| --- | --- | --- | --- |
| F01 | P1 | Correcting a semifinal leaves an invalid final result and champion | UI, refresh, shared bracket code |
| F02 | P2 | Normal-session score corrections leave chemistry stale | UI, profile refresh, shared session code |
| F03 | P2 | Open Play score edits count the same match again for chemistry; deletion leaves it behind | UI, profile refresh, Postgres accumulator review |
| F04 | P2 | A completed tournament match can be saved as an 11–11 tie | UI, refresh, client/server validation review |
| F05 | P2 | A guest's assigned tournament gender is forgotten | UI, fresh form, Postgres update method review |
| F06 | P2 | A stale second editor silently overwrites a newer score | Two independent logged-in contexts |
| F07 | P2 | Tournament controls lack accessible names; two other accessibility defects surfaced | Rendered accessibility tree and Axe |

P1 means incorrect competition results that deserve attention first. P2 means a reproducible correctness or usability issue. These are local findings against the audited snapshot, not a claim that every deployed environment has been tested.

## F01 — Correcting a semifinal leaves a champion who is no longer in the final

**Reproduction**

1. Create a Men's Singles tournament with four entrants: Blake, Finley, Drew, and Jamie.
2. Record Blake beating Finley 11–5 and Drew beating Jamie 11–6.
3. Record Blake beating Drew 11–3 in the final.
4. Correct the first semifinal to Blake 5, Finley 11.
5. Refresh the bracket page.

**Observed:** the final now lists **Finley vs Drew**, retains the old 11–3 score, stays marked **Done**, and still announces **Blake Organizer** as champion. Blake is no longer a finalist. Both finalists show a Win button because the stored final winner matches neither participant.

**Expected:** changing an advancing participant invalidates the affected downstream result and champion. The final should require a new result.

**Why it happens:** [setMatchWinner](</Users/nathanglen/Documents/ChatGPT/Pickleball Matcher/src/lib/tournament/bracket.ts:349>) replaces the next match's participant when a new winner is supplied, but does not reset that match's old winner, scores, or dependent rounds. Resetting a winner has a separate clearing path, but changing one winner directly into another does not use it.

**Suggested fix:** invalidate downstream matches whenever their inputs change, clearing scores and winners through every dependent round. Derive a champion only from a valid completed final. Regression coverage should include correcting both the winning and losing finalist's semifinal, plus a bracket with three or more rounds.

![After correcting the semifinal: Blake is still champion although the final is Finley versus Drew](</Users/nathanglen/Documents/ChatGPT/Pickleball Matcher/output/playwright/sqlite-user-audit/09-tournament-phantom-champion.png>)

[Before correction](</Users/nathanglen/Documents/ChatGPT/Pickleball Matcher/output/playwright/sqlite-user-audit/08-tournament-before-correction.png>).

## F02 — Normal-session corrections update Elo and history, but leave chemistry unchanged

**Reproduction**

1. Start a normal session with eight registered players and two doubles courts.
2. Save Audrey & Kai beating Drew & Harper 11–0.
3. Finish the round with Next Round; view Audrey's public profile.
4. Use Past Rounds History → Edit Result to reverse that match to 0–11.
5. Refresh Audrey's profile.

**Observed:** Audrey's current rating changes from **3.55 to 3.45**, and the profile changes from **1W–0L to 0W–1L**, but the best-partner card still shows Kai with **+5 synergy, 1 match together**. The original winning chemistry contribution survives the reversal.

**Expected:** chemistry reflects the corrected result and its historical rating context, just as the rating/history views do.

**Why it happens:** [recordResult](</Users/nathanglen/Documents/ChatGPT/Pickleball Matcher/src/lib/domain/session-service.ts:383>) saves the correction and replays ratings. Chemistry is accumulated when rounds complete; the correction path does not replace or replay that contribution.

**Suggested fix:** derive chemistry from completed, eligible matches in a deterministic replay, or store replaceable per-match contributions. Rebuild affected pairs when results change. Because the current chemistry calculation uses expected win probability, corrections that change later historical ratings need an explicit policy for rebuilding dependent contributions. Add coverage for correction, cancellation, round undo, and session deletion; only the score-reversal path was reproduced here for normal sessions.

![Audrey now has a loss and lower rating, but retains the positive chemistry from the reversed win](</Users/nathanglen/Documents/ChatGPT/Pickleball Matcher/output/playwright/sqlite-user-audit/03-chemistry-stale-after-correction.png>)

[Original profile](</Users/nathanglen/Documents/ChatGPT/Pickleball Matcher/output/playwright/sqlite-user-audit/01-chemistry-before-correction.png>) · [Corrected match history](</Users/nathanglen/Documents/ChatGPT/Pickleball Matcher/output/playwright/sqlite-user-audit/02-corrected-result.png>).

## F03 — Editing an Open Play game creates extra chemistry matches

**Reproduction**

1. Start an Open Play session and check in Audrey, Blake, Casey, and Drew from separate user contexts.
2. Submit its only doubles game: Audrey & Blake beat Casey & Drew 11–6.
3. While signed in as Audrey, view Blake's profile: mutual chemistry says **1 win in 1 match**.
4. Edit that same game to 11–9 and save.
5. Refresh Blake's profile, then delete the game and refresh again.

**Observed:** after the edit, the game list still contains exactly **one** game, but mutual chemistry says **2 wins in 2 matches together**. After deletion, that same chemistry count remains even though Audrey and Blake have no completed doubles games together in the audit data. Rating replay removes the deleted result's rating effect.

**Expected:** editing replaces the contribution of the existing match; deleting removes it. Neither operation should inflate partner history.

**Why it happens:** [updateOpenPlayGameAction](</Users/nathanglen/Documents/ChatGPT/Pickleball Matcher/src/app/actions/open-play.ts:669>) replays ratings, then calls the additive chemistry accumulator again at line 716. The Postgres [recordMatchesSynergy](</Users/nathanglen/Documents/ChatGPT/Pickleball Matcher/src/lib/db/postgres-repositories.ts:537>) implementation also adds onto existing state, without a match ID that could identify a replacement. [deleteMatch](</Users/nathanglen/Documents/ChatGPT/Pickleball Matcher/src/lib/domain/session-service.ts:408>) removes the match and replays ratings, but not chemistry.

**Suggested fix:** use the same correction-safe chemistry replay or per-match contribution model as F02. Perform the match update and derived-state rebuild consistently. Include repeated saves of an unchanged result, doubles-to-singles edits, partner replacement, and deletion in regression coverage.

![The profile reports two shared matches after editing the only game](</Users/nathanglen/Documents/ChatGPT/Pickleball Matcher/output/playwright/sqlite-user-audit/05-open-play-chemistry-duplicates-edit.png>)

[Only one game exists](</Users/nathanglen/Documents/ChatGPT/Pickleball Matcher/output/playwright/sqlite-user-audit/06-open-play-one-game.png>) · [Before edit](</Users/nathanglen/Documents/ChatGPT/Pickleball Matcher/output/playwright/sqlite-user-audit/04-open-play-chemistry-before-edit.png>) · [Chemistry after deletion](</Users/nathanglen/Documents/ChatGPT/Pickleball Matcher/output/playwright/sqlite-user-audit/07-deleted-game-chemistry-persists.png>).

## F04 — Tournament scoring accepts a tied completed result

**Reproduction**

1. Record Drew beating Jamie 11–6 in a tournament semifinal.
2. Edit that match, set both scores to 11, and save.
3. Refresh.

**Observed:** the match displays **11–11**, remains **Done**, and Drew remains the selected winner/advancing player. No validation error is shown.

**Expected:** reject a numeric tie and preserve the draft for correction. A deliberate winner-only result may be supported, but it should not coexist with a contradictory tied score.

**Why it happens:** [the edit handler](</Users/nathanglen/Documents/ChatGPT/Pickleball Matcher/src/components/tournaments/tournament-bracket-manager.tsx:188>) retains the existing winner when scores are equal. [the server schema](</Users/nathanglen/Documents/ChatGPT/Pickleball Matcher/src/lib/validation/tournament.ts:36>) bounds each score independently without checking score consistency, while setMatchWinner validates participant identity without validating the score/winner relationship.

**Suggested fix:** validate the same score/winner invariants on client and server. When both scores exist, require them to differ and require the winner to match the larger score. Define how partial or winner-only results work, and test those modes separately.

![The second semifinal is Done with an 11–11 tied score and a selected winner](</Users/nathanglen/Documents/ChatGPT/Pickleball Matcher/output/playwright/sqlite-user-audit/10-tournament-tied-completed-match.png>)

## F05 — Assigned guest gender is lost after tournament creation

**Reproduction**

1. Open Create Tournament. Select the guest Blair Renamed and assign Female.
2. Select Audrey and Casey as well; create a Women's Singles tournament.
3. Open a fresh Create Tournament form for the same group.

**Observed:** the guest is back to **No Gender**. The assignment is used in the just-created bracket but is not retained for the next tournament. Existing registered players' account genders load correctly after the audit adapter's hydration was aligned with Postgres.

**Expected:** if Assign player gender is intended to save a roster attribute, it should persist. If it is intentionally specific to one tournament, say so in the form instead of attempting a silent persistent update.

**Why it happens:** [createTournamentAction](</Users/nathanglen/Documents/ChatGPT/Pickleball Matcher/src/app/actions/tournaments.ts:53>) explicitly calls updatePlayer with gender, but [PostgresRepositories.updatePlayer](</Users/nathanglen/Documents/ChatGPT/Pickleball Matcher/src/lib/db/postgres-repositories.ts:953>) handles name, active status, and initial rating only. It ignores gender. The SQLite base adapter has the same ignored-field behavior; this finding was cross-checked against the actual Postgres method.

**Suggested fix:** settle whether this is a group-level or tournament-only assignment. For group-level guest gender, persist it through an explicit supported repository update. Keep registered account gender ownership separate from organizer overrides.

[Assigned before creation](</Users/nathanglen/Documents/ChatGPT/Pickleball Matcher/output/playwright/sqlite-user-audit/12-guest-gender-assigned.png>).

![A fresh form forgets the guest female assignment and shows No Gender](</Users/nathanglen/Documents/ChatGPT/Pickleball Matcher/output/playwright/sqlite-user-audit/13-guest-gender-forgotten.png>)

## F06 — Two editors can silently lose each other's score changes

**Reproduction**

1. Open the same Open Play singles game, initially **11–9**, as Audrey and Blake in separate browser contexts.
2. Click Edit in both browsers before saving either form.
3. Audrey changes the losing score to 7 and saves. The host sees **11–7**.
4. Blake's still-open form retains the old losing score of 9. Blake changes only the winning score to 12 and saves.
5. Refresh the game list.

**Observed:** the stored result becomes **12–9**. Audrey's correction to 7 is silently overwritten. Both saves succeed without a conflict message.

**Expected:** reject the stale save, or show the newer result and ask the second editor to reconcile it. A stale field should not overwrite a newer correction without notice.

**Why it happens:** [the update schema](</Users/nathanglen/Documents/ChatGPT/Pickleball Matcher/src/app/actions/open-play.ts:544>) does not require the version the editor opened. The [update path](</Users/nathanglen/Documents/ChatGPT/Pickleball Matcher/src/app/actions/open-play.ts:641>) reads the latest record, increments its version, then applies all fields from the stale form. It never compares the client's expected version.

**Suggested fix:** submit an expected match version and enforce it atomically in the database update. Preserve the unsaved draft on conflict and show the current result. Apply the same discipline to other editable match/bracket state. This reproduction is an overlapping-user lost-update test, not a Postgres load or locking test.

![The stale second form saves 12–9, replacing the first editor’s correction to 11–7](</Users/nathanglen/Documents/ChatGPT/Pickleball Matcher/output/playwright/sqlite-user-audit/14-stale-edit-overwrites-new-score.png>)

The exact before/after strings are also in the evidence JSON under `stale-edit`.

## F07 — Accessibility defects in tournament creation, Open Play, and rating charts

### Tournament creation: unnamed player controls

On the tournament creation page, Playwright's rendered accessibility snapshot exposes the player selection controls as unnamed checkboxes. Axe reports **13 unlabeled checkboxes** in the captured 13-player roster, plus an unnamed guest-gender select. The visible player name is a sibling span, not a linked label.

**Impact:** screen-reader users cannot reliably identify which player each checkbox controls. All per-player gender dropdowns also share the generic title Assign player gender rather than identifying the person.

**Suggested fix:** connect each checkbox to the player's visible name using label/htmlFor or aria-labelledby; name each gender control with its player; add a label to the guest gender selector. Preserve row-click convenience without creating duplicate keyboard actions. See [the player checkbox markup](</Users/nathanglen/Documents/ChatGPT/Pickleball Matcher/src/components/tournaments/tournament-creation-form.tsx:316>).

![Tournament selection form: visible player names are not exposed as checkbox labels](</Users/nathanglen/Documents/ChatGPT/Pickleball Matcher/output/playwright/sqlite-user-audit/11-tournament-creation-accessibility.png>)

### Open Play: low-contrast End Session button

At 390 × 844, Axe flags the white text on the red End Session button as insufficient contrast. Evidence: [mobile Open Play screenshot](</Users/nathanglen/Documents/ChatGPT/Pickleball Matcher/output/playwright/sqlite-user-audit/mobile-open-play.png>). The relevant [button classes](</Users/nathanglen/Documents/ChatGPT/Pickleball Matcher/src/app/g/[groupId]/sessions/[sessionId]/open-play-manager-client.tsx:916>) use white text on bg-red-500. Use a sufficiently dark red or another tested foreground/background combination.

### Profile chart: interactive descendants inside an image

Axe flags nested-interactive on the rating chart. The chart's SVG uses role=img while its points use role=button and tabIndex=0; see [the chart role](</Users/nathanglen/Documents/ChatGPT/Pickleball Matcher/src/components/players/score-history-chart.tsx:87>) and line 112. Interactive descendants of an image role can be flattened or inconsistently exposed to assistive technology. Use an appropriate labelled interactive chart container or separate accessible controls/data from a decorative graphic. Evidence: [mobile profile screenshot](</Users/nathanglen/Documents/ChatGPT/Pickleball Matcher/output/playwright/sqlite-user-audit/mobile-profile.png>).

The complete Axe node targets and markup are recorded in the evidence JSON. Screenshots illustrate the controls; the accessibility tree and Axe results establish these defects.

## Coverage and working behavior

These are observed passes for the specific scenarios, not a blanket certification of each feature.

| Area | Exercised behavior | Outcome |
| --- | --- | --- |
| Accounts | Nine UI signups, distinct authenticated browser contexts, varied starting ratings and genders | Worked |
| Groups | Authenticated creation, registered roster lookup, guest addition, organizer assignment | Worked |
| Permissions | Ordinary member lacks session creation controls; organizer has them | Worked for these roles |
| Privacy | Private profile hides stats from an outsider; direct private group access redirects; its invitation link permits joining | Worked; invitation access is explicitly described by the UI |
| Normal sessions | Eight attendees, two courts, generation/start/confirmation, two rounds, scoring, history correction | Worked apart from F02 |
| Manual lineup | Swap players, lock lineup, full refresh in the same browser context | Custom assignments survived refresh |
| Validation | Tied normal-session result rejected while retaining entered values | Worked |
| Attendance/courts | Mark Kai left; capacity warning blocks an eight-place layout for seven present; change second court to 2v1; Wild variety; score and end | Worked for this sequence |
| Open Play | Self-check-in from three independent users; doubles submission/edit/delete; member singles submission; overlapping edits; ending | F03/F06; ordinary flows worked |
| Guest management | Rename survives refresh, merge two unused guests, link merged guest into an existing registered roster entry | Worked for unused guests; historical guest merging not exercised |
| Temporary groups | Anonymous five-player group, generated round with one sit-out, 11–8 score, save, full refresh | Local history survived refresh |
| Tournaments | Four-player singles bracket, semifinals, final, corrections, guest gender assignment | F01/F04/F05 |
| Summaries/profiles | Completed normal summary, highlights, player history, ratings, mutual chemistry | F02/F03 and chart accessibility |
| Mobile layouts | Home, group, completed normal session, Open Play, tournament, profile at 390 px | No document-level horizontal overflow in these states |
| Accessibility | Axe WCAG 2 A/AA and 2.1 AA scans of those mobile main regions and desktop tournament creation | F07; other scanned main regions had no reported violations |

No page errors or HTTP 5xx responses were captured by the attached observers in the final multi-user run. Application-level incorrect results can still return HTTP 200, as these findings demonstrate. One browser process ended during the audit; authenticated contexts were restored from local dummy-account state before continuing. That interruption is not counted as a product failure.

## Suggested fix order and regression coverage

1. **F01:** invalidate dependent tournament results; add bracket unit tests and a browser correction scenario.
2. **F02/F03 together:** establish a correction-safe chemistry source of truth, then rebuild existing derived chemistry from authoritative results using a controlled migration/maintenance path. Do not just change the displayed count.
3. **F06:** enforce version checks for edits atomically; add a two-context E2E test that verifies drafts survive conflicts.
4. **F04:** unify tournament score validation with clear winner-only rules.
5. **F05:** make gender assignment persistence explicit and test a fresh form after creation.
6. **F07:** fix semantic labels/roles and contrast; run targeted Axe checks.

After implementation, add or update the relevant existing E2E cases in corrections, Open Play, permissions, and resilience; tournament behavior also needs dedicated browser coverage. This audit used Playwright exploratory scripts, not a run of the standard Postgres-configured E2E suite. Lint/typecheck/unit/simulation/build gates were not run for product fixes because no product fixes were made.

## Limits and follow-up cases

This was broad exploratory coverage, not every combination of every feature. Round cancellation/undo, singles normal courts, guest merging with historical games, ownership transfer/removal while sessions are live, temporary-to-account saving, account rename/password/rate-limit cases, reduced-motion and animation replay behavior, cross-browser behavior, and network/offline recovery need separate targeted runs. Private-group invitation possession was treated as intended access because the Share dialog explicitly says the link can be used to join.

Source inspection also suggests that match-mutation authorization deserves a separate targeted check: actions authorize a supplied group/session and then use a match ID, so the match's ownership chain should be validated explicitly. **No crafted cross-group mutation was executed, and no authorization bypass is claimed as a confirmed finding.**

## Evidence and retained setup

- [Machine-readable evidence](</Users/nathanglen/Documents/ChatGPT/Pickleball Matcher/output/playwright/sqlite-user-audit/evidence.json>) contains selected Playwright scenario outputs, before/after strings, accessibility results, and local test URLs. It contains no cookie/storage-state files.
- Screenshots are under `/Users/nathanglen/Documents/ChatGPT/Pickleball Matcher/output/playwright/sqlite-user-audit`. Every person and group shown is fictitious.
- Isolated audit branch: `audit/sqlite-multi-user-2026-10-23`.
- Audit checkout: `/Users/nathanglen/.codex/worktrees/sqlite-user-audit/Pickleball Matcher`.
- Local database: `audit-local/sqlite-user-audit.db` in that checkout.
- Temporary adapter: `src/test-support/audit-sqlite-repository.ts` in that checkout, with environment-gated action wiring and a Postgres guard. These are harness changes, not proposed product changes.
- Playwright scenario scripts and dummy auth state are retained locally in that checkout's `audit-local` directory. Do not publish the auth state or merge the audit adapter into the application.

The audit browser and port-3104 server were stopped after evidence capture. The local database and harness remain in the isolated checkout for follow-up. The main working checkout's existing work was preserved. No commits, pushes, deployments, or remote database writes were performed for this audit.
