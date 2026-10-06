# Pickleball Matchmaker MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and ship the mobile-first Pickleball Matchmaker PWA described by the PRD, with a deterministic, independently tested matchmaking engine and a simple organizer workflow.

**Architecture:** Use one Next.js App Router application with a pure TypeScript matchmaking package, domain services behind repository interfaces, and server-only Supabase/PostgreSQL persistence. Proposed rounds remain side-effect free until started; completed match history is authoritative for deterministic rating replay.

**Tech Stack:** Node.js 22.12+, Next.js 16.3.8, React 19.3, TypeScript 5.9, Tailwind CSS 4, Vitest 5, fast-check 4, Testing Library, Supabase-hosted PostgreSQL through `postgres`, Zod 4, bcryptjs, jose, and Playwright 1.63.

**Spec:** [`docs/superpowers/specs/2026-10-06-pickleball-matchmaker-design.md`](docs/superpowers/specs/2026-10-06-pickleball-matchmaker-design.md), derived from [`PRD.md`](PRD.md)

## Global Constraints

- Preserve the priority order: fair playing time, partner diversity, competitive balance, then opponent diversity.
- Keep the matchmaking engine pure TypeScript with no React, database, network, global random source, or system-clock dependency.
- Use seeded randomness for every nondeterministic matchmaking choice and return the seed used.
- Keep all weights, decay curves, iteration counts, and normalization rules in one typed configuration module.
- Generate normal rounds for up to 24 players in under 500 ms in the target runtime.
- Do not mutate ratings, game counts, sitting history, or pair history until **Start Round** succeeds.
- Treat completed, non-cancelled match history as authoritative; rebuild all derived rating state chronologically after corrections.
- Store the pooled Supabase PostgreSQL connection string only on the server. All mutations require organizer authorization and ownership checks.
- Design mobile-first with large tap targets, outdoor-readable contrast, minimal typing, and accessible semantics.
- Do not add PRD non-goals such as tournaments, DUPR, messaging, accounts, reservations, payments, native apps, leaderboards, or AI.
- Use TDD for each behavioral task and commit only after its focused and regression checks pass.

## Review Focus

1. **Mixed-experience doubles team:** average the teammates' individual K-factors to obtain one team K-factor, then apply the same delta to both teammates; Task 2 pins this behavior.
2. **Player with no prior eligible rounds:** use a one-opportunity group-average prior so a late arrival is not forced to catch up immediately or guaranteed to sit; Task 4 pins this behavior.
3. **Capacity boundaries:** use exactly `min(floor(players / 4), courts)` courts for 4–24 players and assign every remaining player to `sitting` exactly once; Task 5 pins this invariant.
4. **Concurrent organizer tabs:** reject stale round-start and result mutations without partially writing data; Tasks 7 and 9 pin transaction and version checks.
5. **Correction after later games exist:** editing, deleting, cancelling, or undoing historical results must replay every later rating from initial ratings in stable chronological order; Task 6 pins this behavior.

---

## Target File Map

```text
src/
  app/
    actions/                     # validated organizer mutations
    g/[groupId]/                 # organizer pages
    s/[shareId]/                 # public read-only session page
    manifest.ts                  # PWA metadata
  components/
    attendance/                  # roster selection and court count
    rounds/                      # court cards, sitting list, controls
    results/                     # score entry and completion state
    players/                     # roster management
    ui/                          # small shared controls only
  lib/
    auth/                        # PIN verification and signed session cookie
    db/                          # server-only PostgreSQL client and repositories
    domain/                      # session lifecycle and rating replay
    matchmaking/                 # pure engine
    validation/                  # Zod input schemas
  test-support/                  # factories and in-memory repositories
supabase/migrations/             # schema, constraints, and rate-limit function
tests/
  domain/
  integration/
  simulations/
  e2e/
```

## Task 1: Project foundation and deterministic engine primitives

**Files:**
- Create: `package.json`, `package-lock.json`, `.nvmrc`, `.gitignore`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `vitest.config.ts`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`
- Create: `src/lib/matchmaking/types.ts`, `src/lib/matchmaking/config.ts`, `src/lib/matchmaking/random.ts`
- Create: `tests/matchmaking/random.test.ts`, `src/test-support/factories.ts`

**Interfaces:**
- Consumes: Approved design and Node.js 22.12+.
- Produces: `PlayerId`, `MatchmakingPlayer`, `PairHistory`, `CourtAssignment`, `RoundCandidate`, `ScoreBreakdown`, `GeneratedRound`, `GenerationError`, `GenerationResult`, `MatchmakingConfig`, `DEFAULT_MATCHMAKING_CONFIG`, and `createSeededRandom(seed: number): RandomSource` where `RandomSource` exposes `next(): number`, `integer(maxExclusive: number): number`, and `shuffle<T>(values: readonly T[]): T[]`.

- [ ] **Step 1: Add the failing seeded-random tests**

Test `createSeededRandom` for identical sequences from identical seeds, different sequences from different seeds, non-mutating shuffle, and values constrained to `[0, 1)`.

- [ ] **Step 2: Run the focused test and verify the foundation is absent**

Run: `npm test -- tests/matchmaking/random.test.ts`

Expected: FAIL because project configuration and `createSeededRandom` do not exist.

- [ ] **Step 3: Create the application/tooling foundation**

Initialize npm and install the pinned stack. Add scripts `dev`, `build`, `lint`, `typecheck`, `test`, `test:watch`, `test:simulation`, and `test:e2e`. Configure `@/*` imports, Node 22.12 in `.nvmrc` and `engines`, Vitest's Node environment by default, and a minimal accessible home shell.

- [ ] **Step 4: Implement engine types, configuration, and random source**

Use a small documented 32-bit seeded PRNG whose algorithm is covered by exact sequence fixtures. `MatchmakingPlayer` contains `id`, `name`, `rating`, `gamesPlayed`, `eligibleRounds`, and `satPreviousRound`. Pair history uses canonical unordered player IDs and explicit session/lifetime counts plus nullable recency values.

- [ ] **Step 5: Verify the foundation**

Run: `npm test -- tests/matchmaking/random.test.ts && npm run typecheck && npm run lint && npm run build`

Expected: all commands PASS and the production build contains `/`.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .nvmrc .gitignore tsconfig.json next.config.ts postcss.config.mjs eslint.config.mjs vitest.config.ts src tests/matchmaking/random.test.ts
git commit -m "chore: scaffold matchmaker application"
```

## Task 2: Doubles Elo rating engine

**Files:**
- Create: `src/lib/matchmaking/rating.ts`
- Create: `tests/matchmaking/rating.test.ts`
- Modify: `src/lib/matchmaking/types.ts`

**Interfaces:**
- Consumes: `PlayerId` and player rating data from Task 1.
- Produces: `expectedScore(ratingA: number, ratingB: number): number`, `kFactor(ratedGames: number): 40 | 20`, `teamRating(ratings: readonly [number, number]): number`, `rateMatch(input: RatedMatchInput): readonly PlayerRatingUpdate[]`.

- [ ] **Step 1: Write failing rating tests**

Cover equal teams (`expectedScore === 0.5`), favorite win, underdog win, provisional boundary at games 9/10, four equal-and-opposite team updates, and full-precision outputs. For a team with K-factors 40 and 20, assert a common team K of 30 and identical teammate deltas.

- [ ] **Step 2: Verify the tests fail for missing rating functions**

Run: `npm test -- tests/matchmaking/rating.test.ts`

Expected: FAIL with missing exports from `rating.ts`.

- [ ] **Step 3: Implement the rating functions**

Use average teammate rating, the PRD Elo expectation formula, and `teamK = (player1K + player2K) / 2`. Calculate all updates from pre-match ratings; never round stored results.

- [ ] **Step 4: Verify rating behavior and regression suite**

Run: `npm test -- tests/matchmaking/rating.test.ts && npm test && npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/matchmaking/rating.ts src/lib/matchmaking/types.ts tests/matchmaking/rating.test.ts
git commit -m "feat: add doubles Elo ratings"
```

## Task 3: Pair history and candidate scoring

**Files:**
- Create: `src/lib/matchmaking/pairs.ts`, `src/lib/matchmaking/score-round.ts`
- Create: `tests/matchmaking/pairs.test.ts`, `tests/matchmaking/score-round.test.ts`
- Modify: `src/lib/matchmaking/config.ts`, `src/lib/matchmaking/types.ts`

**Interfaces:**
- Consumes: `RoundCandidate`, `PairHistory`, player ratings, and `MatchmakingConfig`.
- Produces: `pairKey(a: PlayerId, b: PlayerId): string`, `scorePartnerPair(...)`, `scoreOpponentPair(...)`, `scoreSkillBalance(...)`, and `scoreRound(candidate, context): ScoreBreakdown`.

- [ ] **Step 1: Write failing pair-history tests**

Assert canonical pair keys are order-independent; last-round partners cost more than older partners; partner repetition costs more than equivalent opponent repetition; session counts dominate lifetime counts; and never-paired players contribute zero pair penalty.

- [ ] **Step 2: Write failing round-scoring tests**

Assert the breakdown exposes `playingTime`, `consecutiveSit`, `partnerRepeat`, `skillBalance`, `opponentRepeat`, `tieBreak`, and `total`; balanced average team ratings beat unbalanced pairings while a recent partnership can still outweigh a modest skill improvement.

- [ ] **Step 3: Verify focused failures**

Run: `npm test -- tests/matchmaking/pairs.test.ts tests/matchmaking/score-round.test.ts`

Expected: FAIL with missing scoring modules.

- [ ] **Step 4: Implement canonical pair scoring and normalized round scoring**

Keep session/lifetime and partner/opponent curves separately configurable. Normalize each component to a documented per-player or per-court basis before applying product weights; add the seeded tie-break only after substantive components.

- [ ] **Step 5: Verify scoring**

Run: `npm test -- tests/matchmaking/pairs.test.ts tests/matchmaking/score-round.test.ts && npm test && npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/matchmaking tests/matchmaking/pairs.test.ts tests/matchmaking/score-round.test.ts
git commit -m "feat: score match variety and balance"
```

## Task 4: Attendance-relative sitting selection

**Files:**
- Create: `src/lib/matchmaking/sitting.ts`
- Create: `tests/matchmaking/sitting.test.ts`
- Modify: `src/lib/matchmaking/config.ts`, `src/lib/matchmaking/types.ts`

**Interfaces:**
- Consumes: active `MatchmakingPlayer[]`, required sit count, `RandomSource`, and config.
- Produces: `participationLoad(player, groupAverage): number`, `chooseSittingPlayers(input): readonly PlayerId[]`, and `scoreSittingChoice(input): Pick<ScoreBreakdown, "playingTime" | "consecutiveSit">`.

- [ ] **Step 1: Write failing fairness tests**

Cover 14 players/3 courts, preference to sit players with more games among equal attendance, strong avoidance of consecutive sits, unavoidable consecutive sitting at constrained sizes, deterministic ties, and no mutation of player input.

- [ ] **Step 2: Add the late-arrival test**

For a player with `eligibleRounds = 0`, assert `participationLoad` uses one synthetic opportunity at the current group-average play rate. Verify the late arrival is neither forced to play until caught up nor automatically selected to sit when otherwise tied.

- [ ] **Step 3: Verify focused failures**

Run: `npm test -- tests/matchmaking/sitting.test.ts`

Expected: FAIL with missing sitting functions.

- [ ] **Step 4: Implement sitting selection**

Rank randomized valid sit sets by projected participation spread and consecutive-sit penalty. Preserve a hard preference for the smallest feasible projected spread before pair or skill scoring.

- [ ] **Step 5: Verify fairness and regressions**

Run: `npm test -- tests/matchmaking/sitting.test.ts && npm test && npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/matchmaking/sitting.ts src/lib/matchmaking/config.ts src/lib/matchmaking/types.ts tests/matchmaking/sitting.test.ts
git commit -m "feat: select sitting players fairly"
```

## Task 5: Seeded candidate generation and simulations

**Files:**
- Create: `src/lib/matchmaking/generate-round.ts`, `src/lib/matchmaking/index.ts`
- Create: `tests/matchmaking/generate-round.test.ts`, `tests/simulations/matchmaking.simulation.test.ts`
- Modify: `src/test-support/factories.ts`

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces: `generateRound(input: GenerateRoundInput): GenerationResult` and the public exports from `src/lib/matchmaking/index.ts`.

- [ ] **Step 1: Write failing generation invariant tests**

For player counts 4–16, 20, and 24 and multiple court counts, assert exactly `min(floor(players / 4), courts)` courts, four unique players per court, no player duplicated, all leftovers sitting once, unused excess courts, reproducible output for the same seed, and typed `INSUFFICIENT_PLAYERS` below four.

- [ ] **Step 2: Write failing session simulation tests**

Using fixed seed sets, simulate seven or more rounds for 14 players/3 courts and representative odd sizes. Assert same-attendance game spread is at most one when feasible, consecutive sits only when unavoidable, partner repetition is below an explicit random-baseline threshold, and team-rating differences improve over the seeded random baseline.

- [ ] **Step 3: Add the performance test**

Generate 30 seeded rounds for 24 players and assert the median generation time is below 500 ms. Mark the suite `test:simulation`, not the default watch suite, but run it in CI.

- [ ] **Step 4: Verify focused failures**

Run: `npm test -- tests/matchmaking/generate-round.test.ts && npm run test:simulation`

Expected: FAIL with missing `generateRound`.

- [ ] **Step 5: Implement randomized candidate search**

Use Task 4 to sample eligible sitting sets, seeded shuffles for active players, and all three pairings per group of four. Evaluate `DEFAULT_MATCHMAKING_CONFIG.iterations = 5_000`, retain the lowest score, and return the score breakdown and seed.

- [ ] **Step 6: Verify the complete engine**

Run: `npm test && npm run test:simulation && npm run typecheck && npm run lint`

Expected: PASS, including the performance threshold.

- [ ] **Step 7: Commit**

```bash
git add src/lib/matchmaking src/test-support tests/matchmaking tests/simulations
git commit -m "feat: generate fair seeded rounds"
```

## Task 6: Session domain service and deterministic rating replay

**Files:**
- Create: `src/lib/domain/types.ts`, `src/lib/domain/repositories.ts`, `src/lib/domain/session-service.ts`, `src/lib/domain/rating-replay.ts`, `src/lib/domain/errors.ts`
- Create: `src/test-support/in-memory-repositories.ts`
- Create: `tests/domain/session-service.test.ts`, `tests/domain/rating-replay.test.ts`

**Interfaces:**
- Consumes: `generateRound`, `rateMatch`, and pure repository ports.
- Produces: `SessionService` methods `startSession`, `changeAttendance`, `proposeRound`, `startRound`, `recordResult`, `cancelMatch`, `completeRound`, `undoLatestRound`, and `endSession`; `replayRatings(groupId, repository): Promise<RatingReplayResult>`.

- [ ] **Step 1: Write failing proposal/lifecycle tests**

Assert proposing and regenerating produce no repository history writes; starting writes round, matches, and sits atomically; attendance boundaries affect future rounds only; a round completes only when every match is completed or cancelled; and fewer than four present players returns a domain validation error.

- [ ] **Step 2: Write failing correction/replay tests**

Build at least three chronological matches. Edit the first result, cancel the second, and verify the third recalculates from initial ratings. Assert stable ordering by completion timestamp then match ID, exact rated-game counts, and idempotent replay.

- [ ] **Step 3: Write failing undo tests**

Assert only the latest started round can be undone, all of its participation history is removed atomically, and ratings replay when it contained results.

- [ ] **Step 4: Verify focused failures**

Run: `npm test -- tests/domain/session-service.test.ts tests/domain/rating-replay.test.ts`

Expected: FAIL with missing domain services.

- [ ] **Step 5: Implement domain ports and services**

Use discriminated domain errors and a repository transaction callback. Keep orchestration out of React/server actions. Use the in-memory repository as the executable local adapter and test double.

- [ ] **Step 6: Verify domain behavior**

Run: `npm test -- tests/domain && npm test && npm run typecheck`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/domain src/test-support/in-memory-repositories.ts tests/domain
git commit -m "feat: add session lifecycle services"
```

## Task 7: PostgreSQL schema and repositories

**Files:**
- Create: `supabase/config.toml`, `supabase/migrations/202610060001_initial_schema.sql`
- Create: `src/lib/db/server-database.ts`, `src/lib/db/postgres-repositories.ts`, `src/lib/db/transaction.ts`
- Create: `tests/integration/database.test.ts`, `tests/integration/supabase-repositories.test.ts`
- Create: `.env.example`

**Interfaces:**
- Consumes: repository ports and domain entities from Task 6.
- Produces: `getDatabase()`, `PostgresRepositories`, and `withTransaction<T>(operation: (transaction: TransactionSql) => Promise<T>): Promise<T>` implementing all Task 6 ports.

- [ ] **Step 1: Write the schema contract tests**

Test foreign keys, valid enums/checks, unique round number per session, unique court per round, team values 1/2, one match membership per player, one sit row per player/round, and denied direct anonymous writes.

- [ ] **Step 2: Write failing repository transaction tests**

Assert round start is all-or-nothing, a deliberately stale session version rejects without writes, duplicate mutation idempotency keys do not duplicate rounds/results, and chronological replay queries have stable ordering.

- [ ] **Step 3: Verify integration failures**

Run: `npx supabase start && npx supabase db reset && npm test -- tests/integration/database.test.ts tests/integration/supabase-repositories.test.ts`

Expected: FAIL before the migration and repositories exist.

- [ ] **Step 4: Implement the migration and row mappings**

Create the approved tables plus `version` columns on mutable session/round/match aggregates and mutation idempotency storage. Enable RLS with no browser-facing policies; all product access goes through server-side application authorization.

- [ ] **Step 5: Implement repositories and transactions**

Use `postgres` with Supabase's pooled connection URL, `prepare: false` for transaction-pooler compatibility, and a server-only module guard. Map database rows to domain entities at the boundary and convert constraint/version failures to typed repository errors.

- [ ] **Step 6: Verify database behavior**

Run: `npx supabase db reset && npm test -- tests/integration/database.test.ts tests/integration/supabase-repositories.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add supabase src/lib/db tests/integration .env.example package.json package-lock.json
git commit -m "feat: persist matchmaker sessions in PostgreSQL"
```

## Task 8: Organizer authentication, authorization, and validation

**Files:**
- Create: `src/lib/auth/pin.ts`, `src/lib/auth/session.ts`, `src/lib/auth/authorize.ts`, `src/lib/auth/rate-limit.ts`
- Create: `src/lib/validation/group.ts`, `src/lib/validation/session.ts`, `src/lib/validation/results.ts`
- Create: `supabase/migrations/202610060002_organizer_rate_limit.sql`
- Create: `tests/auth/auth.test.ts`, `tests/auth/rate-limit.test.ts`, `tests/validation/results.test.ts`

**Interfaces:**
- Consumes: group persistence and server environment variables.
- Produces: `hashPin`, `verifyPin`, `createOrganizerSession`, `readOrganizerSession`, `requireGroupOrganizer`, `checkOrganizerRateLimit`, and Zod schemas for every mutation.

- [ ] **Step 1: Write failing PIN/session tests**

Assert PIN hashes differ for the same PIN, correct/incorrect verification, signed cookie expiry and tamper rejection, generic login failures, secure/HTTP-only/same-site cookie settings, and group ownership rejection.

- [ ] **Step 2: Write failing rate-limit and result-validation tests**

Assert the configured attempt window survives separate application instances, successful login clears failures, and tied, negative, fractional, missing, or excessive scores are rejected while ordinary non-tied non-negative integer scores are accepted.

- [ ] **Step 3: Verify focused failures**

Run: `npm test -- tests/auth tests/validation/results.test.ts`

Expected: FAIL with missing auth and validation modules.

- [ ] **Step 4: Implement auth, durable rate limiting, and validation**

Use bcryptjs for PIN hashing and jose for signed session tokens. Keep cookie and service secrets server-only. Implement rate limiting as a transaction-safe PostgreSQL function keyed by group and a privacy-preserving client fingerprint.

- [ ] **Step 5: Verify auth and security boundaries**

Run: `npx supabase db reset && npm test -- tests/auth tests/validation && npm run typecheck && npm run lint`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth src/lib/validation supabase/migrations tests/auth tests/validation package.json package-lock.json
git commit -m "feat: secure organizer actions"
```

## Task 9: Organizer application flow

**Files:**
- Create: `src/app/setup/page.tsx`, `src/app/g/[groupId]/login/page.tsx`, `src/app/g/[groupId]/page.tsx`
- Create: `src/app/g/[groupId]/sessions/new/page.tsx`, `src/app/g/[groupId]/sessions/[sessionId]/page.tsx`, `src/app/g/[groupId]/players/page.tsx`
- Create: `src/app/actions/groups.ts`, `src/app/actions/auth.ts`, `src/app/actions/players.ts`, `src/app/actions/sessions.ts`, `src/app/actions/results.ts`
- Create: `src/components/attendance/*`, `src/components/rounds/*`, `src/components/results/*`, `src/components/players/*`, `src/components/ui/*`
- Create: `tests/components/attendance.test.tsx`, `tests/components/current-round.test.tsx`, `tests/components/results.test.tsx`, `tests/integration/actions.test.ts`
- Modify: `src/app/page.tsx`, `src/app/globals.css`

**Interfaces:**
- Consumes: Task 6 domain services, Task 7 repositories, Task 8 authorization/validation.
- Produces: one-time-token-protected group setup plus the complete organizer flow for home/recent sessions, attendance, roster/guest creation, proposal/regeneration/start, result resolution, next round, corrections, undo, and session end.

- [ ] **Step 1: Write failing component behavior tests**

Assert accessible labels and keyboard operation; selected-player count; court increment/decrement bounds; large court/sitting presentation; regenerate available only for proposals; start confirmation; per-court score errors; cancelled-match state; and primary mobile action placement.

- [ ] **Step 2: Write failing server-action tests**

Assert group setup requires `SETUP_TOKEN`, every organizer mutation validates input and ownership, mutations pass expected aggregate version and idempotency key, responses return typed field/form errors, and no response exposes connection credentials or raw database errors.

- [ ] **Step 3: Verify focused failures**

Run: `npm test -- tests/components tests/integration/actions.test.ts`

Expected: FAIL because pages, components, and actions do not exist.

- [ ] **Step 4: Implement the mobile-first pages and components**

Keep pages server-rendered; use client components only for local selection, score drafts, dialogs, and pending states. Use a persistent thumb-reachable action area, high contrast, visible focus, restrained motion, and semantic court/result structures.

- [ ] **Step 5: Implement authorized server actions**

Map domain errors to user-facing recovery messages. Refresh authoritative state after successful mutations or stale-version rejection while preserving safe score drafts on failure.

- [ ] **Step 6: Verify the organizer flow**

Run: `npm test -- tests/components tests/integration/actions.test.ts && npm test && npm run typecheck && npm run lint && npm run build`

Expected: PASS and all organizer routes build.

- [ ] **Step 7: Commit**

```bash
git add src/app src/components tests/components tests/integration/actions.test.ts
git commit -m "feat: build organizer session workflow"
```

## Task 10: Read-only sharing and PWA shell

**Files:**
- Create: `src/app/s/[shareId]/page.tsx`, `src/app/manifest.ts`, `public/icons/icon-192.png`, `public/icons/icon-512.png`
- Create: `src/components/rounds/shared-session.tsx`
- Create: `tests/components/shared-session.test.tsx`, `tests/integration/sharing.test.ts`
- Modify: `src/app/layout.tsx`, `next.config.ts`

**Interfaces:**
- Consumes: public share ID repository query and round presentation from Task 9.
- Produces: read-only shared session pages and installable PWA metadata without offline mutation claims.

- [ ] **Step 1: Write failing sharing tests**

Assert valid high-entropy share IDs display current assignments/results, invalid IDs return not found, no organizer controls or private identifiers render, and public requests cannot invoke mutations.

- [ ] **Step 2: Write failing PWA metadata tests**

Assert manifest name, short name, standalone display, theme/background colors, start URL, 192/512 icons, mobile viewport behavior, and app metadata.

- [ ] **Step 3: Verify focused failures**

Run: `npm test -- tests/components/shared-session.test.tsx tests/integration/sharing.test.ts`

Expected: FAIL because sharing and manifest routes do not exist.

- [ ] **Step 4: Implement sharing and PWA shell**

Fetch share pages server-side through a read-only repository method. Add installable metadata and icons; do not add offline result queuing or imply mutations work without connectivity.

- [ ] **Step 5: Verify sharing and production build**

Run: `npm test -- tests/components/shared-session.test.tsx tests/integration/sharing.test.ts && npm run build`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/s src/app/manifest.ts src/app/layout.tsx src/components/rounds/shared-session.tsx public/icons tests/components/shared-session.test.tsx tests/integration/sharing.test.ts next.config.ts
git commit -m "feat: add read-only PWA sharing"
```

## Task 11: Acceptance, accessibility, and release verification

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/acceptance.spec.ts`, `tests/e2e/corrections.spec.ts`, `tests/e2e/permissions.spec.ts`, `tests/e2e/resilience.spec.ts`
- Create: `.github/workflows/ci.yml`, `README.md`
- Modify: `package.json`, `package-lock.json`

**Interfaces:**
- Consumes: the complete application.
- Produces: reproducible end-to-end coverage, CI gates, and operator/developer documentation.

- [ ] **Step 1: Write the failing PRD acceptance test**

Seed 14 players and 3 courts; start a session; verify 12 assignments and 2 sits; record Round 1; generate Round 2; verify prior sitters are strongly favored to play, partnerships generally change, results update ratings, and game counts remain approximately even over several rounds. Run it at representative mobile and desktop viewports.

- [ ] **Step 2: Write failing correction, permission, and resilience tests**

Cover editing/removing a historical result, latest-round undo, join/leave correction, cancelled match, invalid PIN, read-only share restrictions, a stale second tab, database/network failure with retry, and retention of safe unsaved score input.

- [ ] **Step 3: Add accessibility assertions**

Run axe on each primary view and assert keyboard-only completion of attendance, round start, and score entry. Add explicit contrast/tap-target checks where automated coverage is reliable and manual verification instructions for outdoor readability.

- [ ] **Step 4: Verify the new tests fail before final wiring/fixtures**

Run: `npm run test:e2e`

Expected: FAIL until seed fixtures, environment setup, and any uncovered behavior are completed.

- [ ] **Step 5: Complete test fixtures, CI, and README**

Document local Supabase setup, environment variables, database reset/seed, development, tests, build, deployment, organizer PIN model, correction/replay behavior, and tuning configuration. CI runs lint, typecheck, unit/domain tests, simulations, integration tests against local Supabase, production build, and Playwright.

- [ ] **Step 6: Run the full release gate**

Run: `npm ci && npx supabase db reset && npm run lint && npm run typecheck && npm test && npm run test:simulation && npm run build && npm run test:e2e`

Expected: every command PASS; simulation median remains below 500 ms; Playwright passes at all configured viewports.

- [ ] **Step 7: Review against the PRD and design**

Check every PRD acceptance item and explicit non-goal. Confirm no secrets or local environment files are tracked and `git diff --check` is clean.

- [ ] **Step 8: Commit**

```bash
git add playwright.config.ts tests/e2e .github/workflows/ci.yml README.md package.json package-lock.json
git commit -m "test: verify MVP acceptance workflow"
```

## Execution Notes

- Implement tasks in order because later layers consume stable interfaces from the engine and domain tasks.
- Do not combine TDD red and green steps into one unchecked change; retain failing-test evidence in the task log or commit notes.
- If a simulation threshold proves impossible without changing product priorities, stop and revise the configuration/design instead of silently weakening the assertion.
- If local Supabase or browser dependencies are unavailable, report the environmental blocker after completing every verification that does not require them.
