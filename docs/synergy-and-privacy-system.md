# Doubles Partner Synergy & Privacy System

This document outlines the architecture, mathematical model, privacy policy enforcement, database schema, and user experience for the **Doubles Partner Synergy** feature (GitHub Issue #11) and **Public/Private Player Profiles** (GitHub Issue #18).

---

## 1. System Overview

Pickleball is fundamentally a partner-driven sport. While individual DUPR-style skill ratings reflect personal ability, two players often perform better (or worse) together than the sum of their individual ratings due to chemistry, court coverage, and communication.

The **Synergy System** tracks every doubles pairing across sessions, updates their shared track record upon round completion, and surfaces this chemistry across the platform:
1. **Active Matchmaking & Court Display**: Players see their synergy badge with their assigned partner on their court card.
2. **Organizer Reveal Modal**: Organizers can discreetly inspect synergy across all active courts via a popover without cluttering the court board.
3. **Player Profile Chemistry Spotlight**: Players can see their "Best Partner Overall" badge with their highest-synergy teammate.
4. **Username Search & Roster Addition**: Group organizers can search players by `@username`, view their public chemistry and rating, and add them directly to their group roster.

---

## 2. Mathematical Synergy Model

### The Challenge of Small Sample Sizes
In recreational pickleball groups, many partner pairings only play 1, 2, or 3 matches together. Using raw win percentages ($\frac{\text{wins}}{\text{matches}}$) creates extreme distortion:
- A pair that plays 1 match and wins would have **100% synergy**, ranking above a veteran pair with 9 wins out of 10 matches (90%).
- A pair that loses their first match together would plummet to **0% synergy**, discouraging them from ever pairing again.

### Bayesian Laplace Smoothing
To resolve this, synergy is calculated using **Laplace smoothing** (a Bayesian uniform prior $\text{Beta}(1, 1)$ with a prior mean of 50%):

$$\text{Synergy Score} = \frac{\text{wins} + 1}{\text{matches} + 2}$$

Where:
- $\text{matches}$ is the total doubles matches played by this pair together.
- $\text{wins}$ is the number of those matches won by this pair.

#### Score Progression Examples

| Matches Played | Wins | Losses | Raw Win % | Bayesian Synergy Score | Displayed Rating |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **0** | 0 | 0 | 0% | **50.0%** (Prior) | Calibration |
| **1** | 1 | 0 | 100% | **66.7%** | Bronze Chemistry |
| **1** | 0 | 1 | 0% | **33.3%** | Developing Chemistry |
| **3** | 3 | 0 | 100% | **80.0%** | Silver Chemistry |
| **5** | 4 | 1 | 80% | **71.4%** | Silver Chemistry |
| **10** | 9 | 1 | 90% | **83.3%** | Gold Chemistry |
| **20** | 18 | 2 | 90% | **86.4%** | Platinum Chemistry |

Implementation resides in [`src/lib/synergy/calculator.ts`](file:///Users/nathanglen/Documents/ChatGPT/Pickleball%20Matcher/src/lib/synergy/calculator.ts).

---

## 3. Decoupled Privacy Policy

### Decoupling Philosophy
Visibility rules change over time as new features (e.g. clubs, friend lists, tournament spectators) are introduced. To prevent security bugs and leaking private data, privacy evaluation is strictly decoupled from database queries and UI components into a dedicated policy module: [`src/lib/privacy/profile-visibility.ts`](file:///Users/nathanglen/Documents/ChatGPT/Pickleball%20Matcher/src/lib/privacy/profile-visibility.ts).

### Resolution Logic (`resolveProfileVisibility`)

```ts
export function resolveProfileVisibility(
  targetProfile: TargetProfile,
  viewerContext: ViewerContext
): ProfileVisibilityResult
```

- **Rule 1 (Self Access)**: A player can always view their own full profile, synergy, and match history.
- **Rule 2 (Group Members & Organizers)**: If the target player and the viewer share an active membership in the current group, chemistry and stats relevant to the group/session are visible.
- **Rule 3 (Public Profiles)**: If `targetProfile.isPublic === true`, their `@username`, display name, overall rating, and best partner synergy are publicly discoverable in username search and rosters.
- **Rule 4 (Private Profiles)**: If `targetProfile.isPublic === false` and the viewer is not a fellow group member, sensitive fields (`synergyScore`, `matchesPlayed`, rating details) are stripped and masked with `🔒 Private Profile`.

### Profile Privacy Switch
Players have a toggle in their profile header ([`src/components/players/player-profile-controls.tsx`](file:///Users/nathanglen/Documents/ChatGPT/Pickleball%20Matcher/src/components/players/player-profile-controls.tsx)):
- **🌐 Public**: Discoverable in username search; public chemistry card displayed.
- **🔒 Private**: Chemistry and rating details hidden from non-group members.

---

## 4. Serving Synergy in Active Rounds

### Player-Partner Only Visibility
To prevent anxiety or bias among opponents on the court, partner synergy badges are served **only to the player and their assigned partner**:
- If player $A$ and player $B$ are teammates on Court 1, both $A$ and $B$ see:
  `⚡ 84% Synergy (12 matches)`
- Opponents $C$ and $D$ on the other side of Court 1 do **not** see $A$ and $B$'s badge.

### Organizer "Reveal Synergy" Modal
Session organizers may need to balance courts or review pair dynamics. Organizers have access to a discreet button:
- **⚡ Reveal Synergy**: Opens [`SynergyRevealModal`](file:///Users/nathanglen/Documents/ChatGPT/Pickleball%20Matcher/src/components/rounds/synergy-reveal-modal.tsx) showing chemistry for each doubles pair across all active courts.

---

## 5. Database Schema & Storage

### Migration: `202610100003_player_privacy_and_synergy.sql`

```sql
-- 1. Profile visibility column on players
alter table players
  add column if not exists is_public boolean not null default true;

-- 2. Pairwise doubles synergy table
create table if not exists player_synergy (
  account_id_1 text not null references players(id) on delete cascade,
  account_id_2 text not null references players(id) on delete cascade,
  matches_played integer not null default 0,
  wins integer not null default 0,
  synergy_score double precision not null default 0.50,
  updated_at timestamp with time zone not null default now(),
  constraint player_synergy_pk primary key (account_id_1, account_id_2),
  constraint player_synergy_canonical_order check (account_id_1 < account_id_2)
);

create index if not exists idx_player_synergy_acc1 on player_synergy (account_id_1);
create index if not exists idx_player_synergy_acc2 on player_synergy (account_id_2);
```

### Canonical Ordering Guarantee
The check constraint `account_id_1 < account_id_2` ensures:
1. **Single Row per Pair**: Pairing Alice and Bob is always stored as `min(Alice, Bob)` and `max(Alice, Bob)`.
2. **No Duplication or Asymmetry**: Atomic upserts update a single row rather than two mirrored records.
3. **Symmetric Synergy**: Both players share the identical synergy calculation for matches played together.

---

## 6. Server Actions & Services

| Action / Service Method | Path | Description |
| :--- | :--- | :--- |
| `searchPlayersByUsernameAction` | `src/app/actions/players.ts` | Searches registered player accounts by `@username` prefix, sanitizing results through `resolveProfileVisibility`. |
| `updatePlayerPrivacyAction` | `src/app/actions/players.ts` | Toggles the authenticated player's `is_public` setting. |
| `addPlayerByAccountIdAction` | `src/app/actions/players.ts` | Adds an existing player account to a group roster by their account ID. |
| `completeRound` | `src/lib/domain/session-service.ts` | Automatically extracts doubles pairs from completed matches, determines winners/losers, and records updated synergy via `repository.recordMatchesSynergy`. |
| `getBestPartner` | `src/lib/domain/repositories.ts` | Queries the highest-synergy partner for a player who has played at least 1 match together. |
| `createPlayerAction` | `src/app/actions/players.ts` | Creates non-account temporary/guest players on the roster with custom initial skill rating. |

---

## 7. Roster Integration & Temporary Players

### Real-Time Live Search (Typeahead)
The Roster management card in [`src/components/groups/group-organizers-panel.tsx`](file:///Users/nathanglen/Documents/ChatGPT/Pickleball%20Matcher/src/components/groups/group-organizers-panel.tsx) features automatic live search:
- As soon as an organizer types **2 or more characters**, a debounced live search queries registered accounts.
- Matching public accounts display their `@username`, name, rating, and public chemistry preview.
- Organizers can click **"+ Add"** to immediately add the player to the roster without needing to know or type their exact full username.

### Temporary & Guest Players
Pickleball Matcher fully supports guest players who do not have registered accounts (`accountId: null`):
- **Inline Guest Creation**: Organizers can switch to the **"👤 + Add Guest"** tab directly in the Roster card.
- **Skill Rating**: Organizers specify a name (e.g., *"Jordan Smith"*) and an initial skill level (Beginner ~900, Intermediate ~1000, Advanced ~1100).
- **Matchmaking & Ratings**: Guest players are included in matchmaking, court rotations, round generation, and earn dynamic ratings throughout active sessions without requiring user credentials.

---

## 8. Verification & Test Suite

The feature is comprehensively verified by unit and integration tests:
- `tests/synergy/calculator.test.ts`: Mathematical Laplace smoothing calculations.
- `tests/privacy/profile-visibility.test.ts`: Decoupled privacy evaluation across viewers and targets.
- `tests/domain/synergy-repository.test.ts`: Database bidirectional queries, upserts, and best partner resolution.
- `tests/domain/session-synergy.test.ts`: Automatic synergy recording upon session round completion.
- `tests/actions/player-search-and-privacy.test.ts`: Server action validation, search, and privacy toggling.
- `tests/components/group-organizers-panel.test.tsx`: Roster mode tabs, live search, and guest addition options.
- `tests/components/player-search-drawer.test.tsx`: Standalone search drawer input, results rendering, and roster integration.
- `tests/components/current-round-synergy.test.tsx`: Partner-only badge display and organizer modal.
- `tests/components/player-profile-synergy.test.tsx`: Profile privacy toggle and "Best Partner" spotlight card.
