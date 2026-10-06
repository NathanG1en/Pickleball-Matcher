# Pickleball Matchmaker MVP Design

**Status:** Approved design

**Source of truth:** [`PRD.md`](../../../PRD.md)

**Target:** Mobile-first progressive web application for recurring casual pickleball groups

## 1. Product intent and scope

Pickleball Matchmaker helps an organizer produce fair, varied, reasonably balanced doubles rounds with minimal effort. The MVP prioritizes participation fairness, partner variety, competitive balance, and opponent variety—in that order—while preserving the social mixing of casual play.

The MVP includes the independently testable matchmaking engine, organizer-controlled session workflow, player roster, result entry and correction, persistent history, mobile PWA behavior, and read-only session sharing. It excludes tournaments, messaging, reservations, payments, native applications, global profiles or leaderboards, and AI features.

## 2. Technical architecture

Use a single Next.js application deployed to Vercel:

- Next.js App Router and TypeScript
- Tailwind CSS for mobile-first styling
- Next.js server actions or route handlers for mutations
- Supabase-hosted PostgreSQL for durable storage, accessed through its pooled connection by a server-only PostgreSQL client
- A framework-independent TypeScript matchmaking engine

The application has four boundaries:

1. **Matchmaking engine:** Pure TypeScript with no React, database, network, or clock dependencies. An injected random seed makes generation reproducible.
2. **Domain services:** Own session lifecycle, attendance, proposal confirmation, results, undo/correction, and rating replay.
3. **Persistence:** Server-only repositories encapsulate PostgreSQL access and transactions.
4. **Presentation:** Server-rendered routes with small client components for attendance selection, score input, and other immediate interactions.

The first implementation milestone is the engine and domain model. UI polish follows proven domain behavior.

## 3. Data model

### Group

- `id`
- `name`
- `organizer_pin_hash`
- `public_share_id` containing sufficient random entropy
- `created_at`

### Player

- `id`
- `group_id`
- `name`
- `initial_rating`
- `rating` as a cached derived value
- `rated_games_played`
- `active`
- `created_at`

### Session

- `id`
- `group_id`
- `started_at`
- `ended_at`
- `court_count`
- `status`: `active` or `completed`
- `current_round_number`

### SessionAttendance

- `id`
- `session_id`
- `player_id`
- `joined_round`
- `left_round`, nullable while present

Round boundaries make playing-time comparisons relative to the period each player was present.

### Round

- `id`
- `session_id`
- `round_number`
- `status`: `proposed`, `started`, `completed`, or `cancelled`
- `seed`
- `score_breakdown`
- `created_at`
- `started_at`
- `completed_at`

Only started rounds affect participation and pair-history calculations. A proposal may remain an in-memory or replaceable persisted draft, but regeneration must never alter competitive history.

### Match

- `id`
- `round_id`
- `court_number`
- `team1_score`
- `team2_score`
- `status`: `pending`, `completed`, or `cancelled`

### MatchPlayer

- `id`
- `match_id`
- `player_id`
- `team`: `1` or `2`
- `rating_before`
- `rating_after`

### RoundSit

- `round_id`
- `player_id`

Database constraints enforce unique court numbers within a round, unique player participation within a match, valid teams, and one appearance per player across a started round's matches and sitting list. Where a cross-table invariant cannot be expressed as a simple constraint, the transaction-owning domain service validates it.

## 4. Session lifecycle

1. The organizer selects attendance and court count, then starts a session.
2. The engine generates a proposed round in memory from current state and history.
3. The organizer may regenerate without affecting ratings, counts, or pair history.
4. **Start Round** stores matches and sitting players atomically and makes the round historical.
5. Each match receives valid scores or is cancelled.
6. The round completes after every match is resolved.
7. Attendance changes affect only future rounds.
8. The organizer may undo only the most recently started round.
9. Editing or removing a historical result replays ratings chronologically from authoritative completed match history.

Completed, non-cancelled match history is authoritative. `Player.rating`, `Player.rated_games_played`, and match rating snapshots are derived caches that can be rebuilt.

## 5. Matchmaking engine

### Interface

The engine accepts plain structured data describing active players, court count, attendance-relative session statistics, pair history, current ratings, configuration, and an optional random seed. It returns court assignments, sitting players, the seed used, total score, and a component-level score breakdown.

### Stage 1: choose sitting players

Sitting selection is separated from court arrangement so lower-priority pair or skill goals cannot overwhelm participation fairness.

- Compare games played across the rounds each player was present.
- Prefer sitting players with the greatest participation advantage.
- Apply a very large configurable penalty to consecutive sits unless unavoidable.
- Randomize choices that are otherwise equivalent using the seeded generator.
- Keep games played within one among equally present players whenever mathematically possible.

### Stage 2: arrange active players

- Start with `5,000` configurable randomized candidates.
- Shuffle active players, divide them into groups of four, and evaluate all three legal doubles pairings within each group.
- Score recent and cumulative partner repetition, opponent repetition, and team-rating difference.
- Weight current-session history more strongly than decayed long-term history.
- Apply a tiny seeded tie-break value so equivalent states do not always yield the same result.
- Return the lowest-scoring candidate and its score breakdown.

All weights, recency curves, iteration counts, decay constants, and normalization rules live in one typed configuration module. Penalty components are normalized before weighting so a component's numeric scale does not silently defeat the product priority order.

For fewer than four eligible players, the engine returns a typed validation result explaining that doubles requires at least four players. More courts than needed remain unused.

## 6. Rating system

Team rating is the arithmetic mean of both players' pre-match ratings. Expected result uses the standard Elo formula from the PRD.

- Each player's first ten rated games contribute `K = 40`.
- Later games contribute `K = 20`.
- The match uses the average of the two teammates' individual K-factors as the team K-factor, so both teammates receive the same rating delta even when one is provisional and the other is established.
- Both teams' deltas use ratings captured before the match update.
- Internal ratings retain full numeric precision; the UI rounds for display.
- Cancelled or incomplete matches do not affect ratings.

Initial skill labels only seed ratings at 900, 1000, or 1100. They never become permanent categories.

## 7. User experience

The organizer flow consists of five primary views:

1. **Home:** Start or resume a session and review recent sessions.
2. **Attendance:** Select active players, add a guest, choose court count, and start.
3. **Current round:** Show large court cards, sitting players, and proposal/start actions.
4. **Results:** Enter exact scores or cancel unfinished matches; enable the next round after every court is resolved.
5. **Players:** Add, deactivate, and inspect players without making ratings the social focus.

Primary actions remain reachable in a thumb-friendly bottom action area. The interface uses large tap targets, high contrast, readable player names, minimal typing, and restrained decoration for outdoor use. Read-only shared pages show assignments and results without organizer controls.

Potentially destructive actions require confirmation. Draft score input should survive accidental navigation where practical.

## 8. Authentication and authorization

- An organizer enters a group PIN; only a secure hash is stored.
- A successful organizer session uses a secure, HTTP-only cookie.
- PIN verification is rate-limited and returns a generic failure response.
- Mutations validate input on the server and verify group ownership.
- Public share identifiers grant read-only access and are unguessable.
- The pooled Supabase PostgreSQL connection string never enters the browser bundle.
- Player accounts are outside MVP scope.

The application stores only the minimum personal information needed for MVP: player display names.

## 9. Error handling and concurrency

- Validation errors appear beside the relevant control and preserve safe input.
- A tied, negative, non-integer, or otherwise invalid pickleball score is rejected; the MVP records a winner and exact non-tied non-negative integer scores without enforcing a specific scoring format such as “first to 11.”
- Network or database failure leaves the current screen intact, states that nothing was saved, and offers retry.
- A generation failure preserves the preceding proposal when one exists.
- Mutations use transactions and optimistic concurrency checks so stale browser tabs cannot silently overwrite newer session state.
- On a stale update, the client refreshes authoritative state while retaining unsaved input where safe.
- Undo, correction, round start, and result completion are atomic operations.

## 10. Accessibility and PWA behavior

- Semantic headings, forms, lists, and buttons
- Visible keyboard focus and screen-reader labels
- Sufficient text and control contrast for outdoor readability
- No meaning communicated by color or animation alone
- Touch targets sized for courtside use
- Responsive mobile-first layout
- Web app manifest and installable PWA metadata
- Functional browser experience without requiring installation

Offline mutation support is not part of MVP; the application must clearly report connectivity failures rather than implying a result was saved.

## 11. Testing strategy

### Unit and property tests

Test Elo calculations, provisional and established K-factors, scoring components, history decay, attendance-relative fairness, seeded reproducibility, and invariants. Every successful round must assign each eligible player exactly once to either a court or the sitting list, contain four distinct players per court, and never exceed available court capacity.

### Simulation tests

Run many seeded sessions at attendance sizes 4–16, 20, and 24. Verify:

- Games-played spread remains within one for equally present players whenever feasible.
- Consecutive sitting occurs only when unavoidable.
- Partner repeats are materially lower than an equivalent random baseline.
- Generated team-rating differences are generally lower than a random baseline.
- Identical inputs and seeds yield identical outputs.
- Different seeds can vary otherwise equivalent assignments.
- Generation completes under 500 ms for normal workloads up to 24 players in the target runtime.

Statistical assertions use fixed seed sets and explicit thresholds to avoid flaky tests.

### Domain and database integration tests

Cover proposal/regeneration isolation, atomic round start, late arrival and departure, cancelled matches, result editing/removal, latest-round undo, chronological rating replay, database constraints, authorization, concurrent mutations, and read-only sharing.

### End-to-end tests

Playwright covers the PRD's 14-player/3-court acceptance scenario in mobile and desktop viewports, plus invalid input, network recovery, and permission boundaries.

## 12. Delivery order

1. Core types, seeded random source, Elo calculations, scoring, sitting fairness, candidate generation, and automated engine tests.
2. Local functional organizer workflow backed by domain services.
3. Supabase schema, repositories, transactions, authentication, and durable history.
4. Mobile visual polish, accessibility verification, PWA metadata, and end-to-end tests.
5. Read-only group/session sharing.

QR codes and player self-check-in remain post-MVP follow-ups unless separately approved.

## 13. Success criteria

- An organizer can reach the first generated round in under one minute.
- Subsequent rounds require only results resolution and a few taps.
- Participation stays approximately even for players present over the same interval.
- Unique partnerships are favored before repeats where practical.
- Matches avoid extreme team-rating differences without isolating skill levels.
- Normal round generation completes in under 500 ms.
- Historical corrections reproduce ratings deterministically.
- The complete PRD acceptance scenario passes automated tests.
