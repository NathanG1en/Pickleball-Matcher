# DUPR Rating Mapping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a 3-decimal DUPR rating presentation and input layer across Pickleball Matcher while maintaining raw Elo calculations and database compatibility under the hood.

**Architecture:** A pure mathematical converter (`src/lib/domain/rating-display.ts`) mapping between Elo and DUPR ($1000 \text{ Elo} = 3.500$, $400 \text{ Elo} = 1.000 \text{ DUPR}$), exposing the 9 standard pickleball tiers, presets (`2.000` to `4.500`), float conversion helpers, and updating UI components and test assertions.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, PostgreSQL (Neon), Tailwind CSS, Vitest, Playwright.

**Spec:** [docs/superpowers/specs/2026-10-12-dupr-rating-mapping-design.md](file:///Users/nathanglen/Documents/ChatGPT/Pickleball%20Matcher/docs/superpowers/specs/2026-10-12-dupr-rating-mapping-design.md)

---

## Global Constraints

- **Never modify underlying Elo rating formulas**: `rateMatch()`, `expectedScore()`, and `replayRatings()` must remain 100% untouched.
- **Never expose raw Elo to users**: All player-facing UI and inputs must exclusively use DUPR-style floating-point numbers formatted to 3 decimal places (e.g., `3.500`).
- **All tests run and pass**: Vitest (`npm test`), TypeScript (`npm run typecheck`), ESLint (`npm run lint`), and Playwright E2E (`npm run test:e2e`).

---

### Task 1: Core DUPR Converter & Tier Catalog

**Files:**
- Create: `src/lib/domain/rating-display.ts`
- Create: `tests/domain/rating-display.test.ts`

**Key Functions:**
- `eloToDupr(elo: number): number`
- `duprToElo(dupr: number): number`
- `formatDupr(elo: number): string` (3 decimals: `toFixed(3)`)
- `formatDuprDelta(deltaElo: number): string`
- `getSkillTier(dupr: number): SkillTier`
- `normalizeInitialRating(input: number): number`
- `DUPR_PRESETS`: `[2.000, 2.500, 3.000, 3.500, 4.000, 4.500]`
- `SKILL_TIERS`: 9 tiers with descriptions

- [x] **Step 1: Write failing unit tests for rating display and conversion**
- [x] **Step 2: Run test to verify failure (`npx vitest run tests/domain/rating-display.test.ts`)**
- [x] **Step 3: Implement `src/lib/domain/rating-display.ts`**
- [x] **Step 4: Run test to verify it passes**

---

### Task 2: Validation & Normalization Layer

**Files:**
- Modify: `src/lib/validation/group.ts`
- Modify: `tests/domain/group-validation.test.ts` (if applicable)

**Changes:**
- Update `playerSignupSchema` and `addPlayerSchema` to allow initial rating inputs either as DUPR floats ($2.000$ to $8.000$) or raw Elo ($100$ to $3000$) through `normalizeInitialRating`.
- Ensure server actions gracefully accept DUPR floats from forms and persist normalized Elo integers.

- [x] **Step 1: Update validation schema with normalization**
- [x] **Step 2: Verify existing validation unit tests pass**

---

### Task 3: Player Signup Form Dropdown & Custom DUPR Input

**Files:**
- Modify: `src/components/players/player-signup-form.tsx`
- Modify: `tests/components/player-signup-form.test.tsx` (or equivalent)

**Changes:**
- Replace legacy `beginner (900)`, `intermediate (1000)`, `advanced (1100)` dropdown with the 6 DUPR presets:
  - `2.000` (Beginner)
  - `2.500` (Advanced Beginner)
  - `3.000` (Intermediate)
  - `3.500` (Advanced Intermediate - default)
  - `4.000` (Competitive)
  - `4.500` (Advanced Competitive)
  - `"custom"` (Custom / Higher 5.000+)
- Display the official tier description for whichever level is selected.
- If `"custom"` is selected, show floating-point number input (step `0.001`, min `2.000`, max `8.000`).
- Convert to Elo via `duprToElo()` on form submit.

- [x] **Step 1: Update `PlayerSignupForm` component**
- [x] **Step 2: Run component tests to verify rendering and interaction**

---

### Task 4: Player Roster & Organizer Add Player Controls

**Files:**
- Modify: `src/components/players/player-roster.tsx`
- Modify: `src/app/g/[groupId]/players/players-client.tsx`
- Modify: `src/components/groups/group-organizers-panel.tsx`
- Modify: `src/app/g/[groupId]/join/join-group-client.tsx`

**Changes:**
- In `PlayerRoster`:
  - Format displayed player rating with `formatDupr(player.rating)`.
  - Add Player form input defaults to `3.500` with step `0.025` or `0.050`.
  - On submit, convert DUPR input to Elo via `duprToElo()`.
- In `GroupOrganizersPanel`:
  - Quick-add guest rating input defaults to `3.500` DUPR float.
- In `JoinGroupClient`:
  - Display player starting rating as `formatDupr(account.initialRating)`.

- [x] **Step 1: Update roster and join forms**
- [x] **Step 2: Run affected component tests**

---

### Task 5: Active Sessions, Match Cards & Profile Presentation

**Files:**
- Modify: `src/components/players/player-profile-controls.tsx`
- Modify: `src/components/groups/player-search-drawer.tsx`
- Modify: `src/components/players/score-history-chart.tsx`
- Modify: `src/components/attendance/attendance-manager.tsx`
- Modify: `src/components/tournaments/tournament-creation-form.tsx`
- Modify: `src/app/players/page.tsx`
- Modify: `src/app/g/[groupId]/sessions/[sessionId]/session-manager-client.tsx`

**Changes:**
- Profile view: Render `formatDupr(rating)` and display dynamic skill tier badge (`getSkillTier(dupr).name`).
- Active session board & match cards: Display partner/player ratings as `formatDupr(rating)`.
- Match score recap / delta (if displayed): Render `formatDuprDelta(delta)`.

- [x] **Step 1: Update displays across session board and profiles**
- [x] **Step 2: Verify UI and component tests pass**

---

### Task 6: E2E Test Suite & Test Helpers Synchronization

**Files:**
- Modify: `tests/e2e/test-helpers.ts`
- Modify: `tests/e2e/acceptance.spec.ts`
- Modify: `tests/e2e/corrections.spec.ts`
- Modify: `tests/e2e/permissions.spec.ts`
- Modify: `tests/e2e/resilience.spec.ts`

**Changes:**
- Update any test helper or assertion that expects `"1000"` to expect `"3.500"`.
- Update any form filler typing into initial rating fields to use DUPR floats (e.g. `3.500`).
- Ensure all Playwright tests pass without retries.

- [x] **Step 1: Update test helpers and assertions**
- [x] **Step 2: Run full quality gates (`npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e`)**
