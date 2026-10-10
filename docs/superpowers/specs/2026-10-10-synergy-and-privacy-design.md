# Doubles Synergy & Player Privacy Architecture Spec

**Date:** 2026-10-10  
**Issues:** NathanG1en/Pickleball-Matcher [#11](https://github.com/NathanG1en/Pickleball-Matcher/issues/11), [#18](https://github.com/NathanG1en/Pickleball-Matcher/issues/18)  
**Status:** Approved for Implementation Planning  

---

## 1. Executive Summary

This specification establishes the infrastructure and user experience for two interconnected features:
1. **Doubles Synergy Score**: A pairwise global chemistry score between two registered player accounts, updated automatically upon completion of doubles matches.
2. **Player Profile Privacy & Discovery**: A privacy toggle (`is_public` vs `private`) with a decoupled permissions layer, paired with an `@username` search workflow on the group dashboard to discover players, preview their public chemistry, and add them to group rosters.

The user experience prioritizes relevant, non-distracting presentation:
- **Players**: View their synergy score exclusively with their currently assigned doubles partner during active sessions.
- **Organizers**: Access an on-demand "Reveal Synergy" modal to inspect court pairings without cluttering the active match board.
- **Profiles**: Highlight each player's "Best Partner Overall" based on top synergy.

---

## 2. Architecture & Data Model

### 2.1 Database Schema (`migrations/202610100003_player_privacy_and_synergy.sql`)

Existing tables in the Neon PostgreSQL database (`db-pickleball`) remain untouched except for adding `is_public` to the `players` table and introducing a canonical `player_synergy` table.

```sql
-- 1. Add privacy flag to players
alter table players
  add column if not exists is_public boolean not null default true;

-- 2. Create canonical pairwise synergy table
create table if not exists player_synergy (
  account_id_1 text not null references players(id) on delete cascade,
  account_id_2 text not null references players(id) on delete cascade,
  matches_played integer not null default 0 check (matches_played >= 0),
  wins integer not null default 0 check (wins >= 0 and wins <= matches_played),
  synergy_score integer not null default 50 check (synergy_score between 0 and 100),
  updated_at timestamptz not null default now(),
  primary key (account_id_1, account_id_2),
  check (account_id_1 < account_id_2)
);

create index if not exists player_synergy_account_2_idx
  on player_synergy (account_id_2);

alter table player_synergy enable row level security;
grant select, insert, update, delete on player_synergy to anon;
```

#### Canonical Pair Storage
By enforcing `account_id_1 < account_id_2`, every partnership pair `(A, B)` or `(B, A)` maps to a single row where:
```ts
const [id1, id2] = accountA < accountB ? [accountA, accountB] : [accountB, accountA];
```
This eliminates duplicate inverted records, prevents concurrent write deadlocks, and simplifies bi-directional queries.

---

## 3. Core Logic & Calculation Engine

### 3.1 Pure Synergy Calculation (`src/lib/synergy/calculator.ts`)
The calculation algorithm is isolated into a pure, testable function so that the formula can be refined independently of data models:

```ts
/**
 * Calculates synergy score (0 - 100%) using Bayesian Laplace smoothing.
 * Prior is 50% (1 win out of 2 pseudogames) to prevent volatility with small sample sizes.
 */
export function calculateSynergyScore(matchesPlayed: number, wins: number): number {
  if (matchesPlayed <= 0) return 50;
  const smoothed = (wins + 1) / (matchesPlayed + 2);
  return Math.round(smoothed * 100);
}
```

### 3.2 Pairwise Update Lifecycle
During `completeRoundAction`:
1. For each completed doubles match in the round:
   - Identify Team 1 (`player1`, `player2`) and Team 2 (`player3`, `player4`).
   - If both players in a team possess linked `account_id`s, retrieve their existing record from `player_synergy`.
   - Increment `matches_played += 1`.
   - If that team won, increment `wins += 1`.
   - Recalculate `synergy_score = calculateSynergyScore(matches_played, wins)`.
   - Upsert the row in `player_synergy`.
2. Singles matches and guest players without an `account_id` are skipped without error.

---

## 4. Decoupled Privacy Policy

### 4.1 Policy Layer (`src/lib/privacy/profile-visibility.ts`)
Privacy rules must not be tightly coupled with SQL queries or React components. A dedicated policy resolver filters sensitive fields:

```ts
export interface SanitizedProfileView {
  readonly accountId: string;
  readonly username: string;
  readonly name: string;
  readonly isPublic: boolean;
  readonly isRestricted: boolean;
  readonly skillLevel?: "beginner" | "intermediate" | "advanced";
  readonly rating?: number;
  readonly bestPartner?: {
    readonly username: string;
    readonly synergyScore: number;
    readonly matchesPlayed: number;
  } | null;
  readonly viewerSynergyScore?: number | null;
}

export function resolveProfileVisibility(
  viewerAccountId: string | null,
  targetAccount: PlayerAccountRecord,
  stats: {
    bestPartner: { username: string; synergyScore: number; matchesPlayed: number } | null;
    viewerSynergyScore: number | null;
  }
): SanitizedProfileView {
  const isOwner = viewerAccountId === targetAccount.id;
  const isRestricted = !targetAccount.isPublic && !isOwner;

  if (isRestricted) {
    return {
      accountId: targetAccount.id,
      username: targetAccount.username,
      name: targetAccount.name,
      isPublic: false,
      isRestricted: true,
      // Ratings, partner stats, and historical metrics stripped
    };
  }

  return {
    accountId: targetAccount.id,
    username: targetAccount.username,
    name: targetAccount.name,
    isPublic: targetAccount.isPublic,
    isRestricted: false,
    skillLevel: targetAccount.skillLevel,
    rating: targetAccount.initialRating,
    bestPartner: stats.bestPartner,
    viewerSynergyScore: stats.viewerSynergyScore,
  };
}
```

---

## 5. User Interface & Experience

### 5.1 Group Dashboard Username Search (`src/components/groups/player-search-drawer.tsx`)
- Accessible from `/g/[groupId]` and `/g/[groupId]/players`.
- Organizers/players can search registered users by `@username`.
- Selection displays the `SanitizedProfileView`:
  - **Public Profile**: Displays `@username`, full name, skill level, rating, and "Best Partner Overall" with synergy score.
  - **Private Profile**: Displays `@username`, full name, and a badge: `🔒 Private Profile (Stats & Partners Hidden)`.
- Button: **"Add to Group Roster"** creates or links the player into this group's active roster.

### 5.2 Active Session Round View (`src/components/rounds/current-round.tsx`)
- **Player View**:
  - If the active session viewer is a logged-in account playing doubles, their court card shows their partner synergy badge:
    `⚡ 84% Synergy` (or `⚡ New Duo` for first-time pairs).
  - Opponents and other courts show no synergy badges to avoid distraction.
- **Organizer View**:
  - Main round board remains clean.
  - A button **"⚡ Reveal Synergy"** opens a modal breaking down each court's doubles pairings and historic chemistry.

### 5.3 Player Profile & Settings (`src/app/players/page.tsx`)
- **Privacy Setting**: Header control toggles `Public` / `Private` mode with instant persistence.
- **Best Partner Spotlight**: Card highlighting:
  - Top partner `@username`
  - Synergy % (e.g., `88% Synergy`)
  - Total matches played together.

---

## 6. Testing & Verification

1. **Unit Tests**:
   - `calculateSynergyScore`: Boundary tests for 0 matches, 100% win rate, 0% win rate, smoothing behavior.
   - `resolveProfileVisibility`: Verifies field stripping for unauthenticated viewers, third-party viewers, and account owners.
2. **Integration / Repository Tests**:
   - Canonical ordering in `getPairSynergy` and `recordMatchesSynergy`.
   - `getBestPartner` query returns the highest-scoring partner with >= 1 match.
3. **End-to-End / Flow Verification**:
   - Complete a doubles match with two registered accounts and verify `player_synergy` updates.
   - Verify private accounts hide ratings and best partner in username search.
   - Verify organizer "Reveal Synergy" modal displays chemistry.
