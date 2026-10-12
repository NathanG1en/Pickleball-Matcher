# DUPR-Style Skill Rating Architecture Spec

**Date:** 2026-10-12  
**Status:** In Review / Ready for Plan  
**Related Documents:** [AGENTS.md](file:///Users/nathanglen/Documents/ChatGPT/Pickleball%20Matcher/AGENTS.md)  

---

## 1. Executive Summary

This specification establishes a **DUPR-aligned presentation and input layer** for player ratings across Pickleball Matcher. 

Pickleball players are accustomed to the universal DUPR floating-point rating scale (typically $2.000$ to $6.000+$, presented to 3 decimal places). The current application exposes raw Elo numbers (e.g., $1000$ starting rating, $+12$ / $-8$ deltas). Raw Elo numbers are unintuitive for recreational and competitive pickleball players.

### Core Principles
1. **Zero disruption to the underlying engine**: The core matchmaking algorithms, Elo formulas, database tables, and historical rating replay systems continue to operate on raw Elo ratings under the hood.
2. **DUPR on the surface**: Users never see or type raw Elo numbers. All user-facing displays and inputs exclusively use DUPR-style floating-point numbers formatted to 3 decimal places (e.g., `3.500`, `3.825`).
3. **Bi-directional translation layer**: Clean mathematical transformations convert DUPR to Elo at form boundaries, and Elo to DUPR at presentation boundaries.
4. **Structured skill level tiers**: Onboarding and profile displays map to the 9 standard DUPR pickleball tiers, with quick-select presets for common entry points ($2.000$ to $4.500$) and custom numerical entry for higher skill levels ($5.000$ to $8.000$).

---

## 2. Mathematical Transformation Model

### 2.1 The Mapping Formula (Option A)

Under the hood:
* Intermediate anchor: $1,000 \text{ Elo} \longleftrightarrow 3.500 \text{ DUPR}$
* Rating spread ratio: $400 \text{ Elo points} \longleftrightarrow 1.000 \text{ DUPR point}$ ($100 \text{ Elo} = 0.250 \text{ DUPR}$)

$$\text{dupr}(\text{elo}) = 3.500 + \frac{\text{elo} - 1000}{400}$$

$$\text{elo}(\text{dupr}) = 1000 + (\text{dupr} - 3.500) \times 400$$

### 2.2 Clamping & Bounds
* **DUPR bounds**: $[2.000, 8.000]$
* **Elo bounds**: $[400, 2800]$ (comfortably within existing Elo validation boundaries $[100, 3000]$)

```ts
export const DUPR_BASE_ELO = 1000;
export const DUPR_BASE_RATING = 3.5;
export const ELO_PER_DUPR = 400;

export const DUPR_MIN = 2.0;
export const DUPR_MAX = 8.0;

export function eloToDupr(elo: number): number {
  const dupr = DUPR_BASE_RATING + (elo - DUPR_BASE_ELO) / ELO_PER_DUPR;
  return Math.min(DUPR_MAX, Math.max(DUPR_MIN, dupr));
}

export function duprToElo(dupr: number): number {
  const clamped = Math.min(DUPR_MAX, Math.max(DUPR_MIN, dupr));
  return Math.round(DUPR_BASE_ELO + (clamped - DUPR_BASE_RATING) * ELO_PER_DUPR);
}

export function formatDupr(elo: number): string {
  return eloToDupr(elo).toFixed(3);
}

export function formatDuprDelta(deltaElo: number): string {
  const deltaDupr = deltaElo / ELO_PER_DUPR;
  const sign = deltaDupr > 0 ? "+" : "";
  return `${sign}${deltaDupr.toFixed(3)}`;
}
```

### 2.3 Win Probability & Match Delta Equivalence

| Scenario | Elo Metric | DUPR Metric |
| :--- | :--- | :--- |
| Even match win ($K = 20$) | $+10$ Elo | **$+0.025$** DUPR |
| Even match loss ($K = 20$) | $-10$ Elo | **$-0.025$** DUPR |
| Provisional match win ($K = 40$) | $+20$ Elo | **$+0.050$** DUPR |
| Upset win (underdog $+150$ Elo) | $+16.4$ Elo | **$+0.041$** DUPR |
| $76\%$ win expectancy | $200$ Elo spread | **$0.500$** DUPR spread |
| $91\%$ win expectancy | $400$ Elo spread | **$1.000$** DUPR spread |

---

## 3. Skill Level Tiers & Preset Mappings

### 3.1 The 9 DUPR Skill Tiers

| Tier Name | DUPR Range | Elo Range | Preset Option | Description |
| :--- | :--- | :--- | :---: | :--- |
| **Beginner** | 2.000 – 2.499 | 400 – 599 | `2.000` | Basic idea of the game, building basic skills. |
| **Advanced Beginner** | 2.500 – 2.999 | 600 – 799 | `2.500` | More consistent, beginning to understand strategy. |
| **Intermediate** | 3.000 – 3.499 | 800 – 999 | `3.000` | Consistent, accurate shots, strategic play. |
| **Advanced Intermediate** | 3.500 – 3.999 | 1000 – 1199 | `3.500` | Good basic skills, strategic thinking, beginning competitive play. |
| **Competitive** | 4.000 – 4.499 | 1200 – 1399 | `4.000` | Very skilled, performs well in regional tournaments. |
| **Advanced Competitive** | 4.500 – 4.999 | 1400 – 1599 | `4.500` | Very good skills, performs well in national events. |
| **Expert** | 5.000 – 5.499 | 1600 – 1799 | Custom | High-level tournament competitor, amazing game knowledge. |
| **Professional** | 5.500 – 5.999 | 1800 – 1999 | Custom | Top players competing at the national professional level. |
| **World-Class Professional** | 6.000 – 8.000 | 2000 – 2800 | Custom | Among the best in the world, elite planning and consistency. |

### 3.2 Dynamic Tier Resolution
Instead of locking a player into the static category chosen during signup, the UI dynamically computes their tier from their active rating:

```ts
export function getSkillTier(dupr: number): {
  id: string;
  name: string;
  range: string;
  description: string;
}
```

---

## 4. UI & Form Workflows

### 4.1 Player Signup (`PlayerSignupForm`)
* **Rating Selection Mode**:
  * Dropdown offers the standard presets: `2.000`, `2.500`, `3.000`, `3.500`, `4.000`, `4.500`, plus an option for `"Custom / Higher (5.000+)"`.
  * Selecting a preset displays the corresponding tier name and description.
  * When `"Custom / Higher (5.000+)"` is chosen, a numerical input is revealed:
    * Step: `0.001` (or `0.01`)
    * Min: `2.000`, Max: `8.000`
    * Placeholder: `e.g. 5.125`
* **Form Submission**:
  * The form converts the chosen DUPR value into the corresponding Elo integer via `duprToElo()` before submitting to `playerSignupAction`.
  * Server-side action schema validates `initialRating` within $[400, 2800]$ Elo (or accepts `duprRating` and converts on server).

### 4.2 Adding Players to Roster (`player-roster.tsx`, `players-client.tsx`, `group-organizers-panel.tsx`)
* **Organizer Adding Guest/Player**:
  * Initial rating input default: `3.500` (step `0.025` or `0.050`, min `2.000`, max `8.000`).
  * Converted to Elo via `duprToElo()` when passing to `addPlayerToRosterAction`.

### 4.3 Roster, Match Board & Profile Presentation
* **Roster Lists (`player-roster.tsx`, `player-group-view.tsx`)**:
  * Displays `formatDupr(player.rating)` (e.g., `3.525`).
  * Shows skill tier badge (e.g., `Advanced Intermediate`).
* **Active Session Cards (`match-card.tsx`, `active-session-board.tsx`)**:
  * Displays player ratings in DUPR format: `3.650`.
* **Match Scoring & Recaps**:
  * When scores are submitted, rating changes display as `+0.025` or `-0.025` rather than `+10` / `-10`.

---

## 5. Schema & Validation Updates

### 5.1 Validation Schema (`src/lib/validation/group.ts`)
* Update `playerSignupSchema` and `addPlayerSchema`:
  * Either accept `initialDupr: z.coerce.number().min(2.0).max(8.0)` and translate to Elo, or continue accepting `initialRating` with automatic translation helpers.
  * To guarantee backwards-compatibility with existing tests and API callers, `initialRating` can accept both Elo integers ($[100, 3000]$) and DUPR floats ($[2.0, 8.0]$) transparently:
    ```ts
    // If value <= 8.0, interpret as DUPR and convert to Elo; otherwise treat as raw Elo
    export function normalizeInitialRating(input: number): number {
      return input <= 8.0 ? duprToElo(input) : Math.round(input);
    }
    ```

---

## 6. Testing & Quality Gates

Per [AGENTS.md](file:///Users/nathanglen/Documents/ChatGPT/Pickleball%20Matcher/AGENTS.md):
1. **Unit Tests (`tests/domain/rating-display.test.ts`)**:
   * Exact conversion checks for all presets ($2.000 \to 400$, $3.500 \to 1000$, $4.500 \to 1400$).
   * Boundary clamping ($1.5 \to 2.000$, $9.0 \to 8.000$).
   * Delta formatting with signs and 3 decimal places.
   * Dynamic tier naming.
2. **Component Tests**:
   * Signup form rendering presets and tier descriptions.
   * Custom rating toggle revealing float input.
3. **E2E Tests (`tests/e2e/acceptance.spec.ts`, `tests/e2e/test-helpers.ts`)**:
   * Update test helpers and assertions that expect raw `1000` to expect `3.500`.
   * Full suite verification (`npm test`, `npm run typecheck`, `npm run lint`, `npm run test:e2e`).
