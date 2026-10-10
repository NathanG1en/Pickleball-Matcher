# Doubles Synergy & Player Privacy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement pairwise doubles synergy score tracking across matches and decoupled public/private player profile controls with group dashboard username search.

**Architecture:** A canonical pair table (`player_synergy`) storing single-row pairs (`account_id_1 < account_id_2`), a pure Bayesian Laplace synergy calculation engine, a decoupled privacy policy layer (`SanitizedProfileView`), session court synergy display for current partners with an organizer modal, and username search on group dashboard.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, PostgreSQL (Neon), Tailwind CSS, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-10-synergy-and-privacy-design.md`

## Global Constraints

- Never break existing migration order; migration is `migrations/202610100003_player_privacy_and_synergy.sql`.
- Strictly enforce canonical ordering (`account_id_1 < account_id_2`) on pair synergy lookups and updates.
- Keep the privacy policy completely decoupled from raw database queries.
- Do not clutter the active match board: players only see their own partner synergy; organizers reveal synergy via modal.
- All tests run via `npm test` (Vitest).

---

### Task 1: Core Synergy Calculator

**Files:**
- Create: `src/lib/synergy/calculator.ts`
- Test: `tests/synergy/calculator.test.ts`

**Interfaces:**
- Produces: `calculateSynergyScore(matchesPlayed: number, wins: number): number`

- [x] **Step 1: Write the failing test**

```ts
// tests/synergy/calculator.test.ts
import { describe, it, expect } from "vitest";
import { calculateSynergyScore } from "@/lib/synergy/calculator";

describe("calculateSynergyScore", () => {
  it("defaults to 50% for 0 matches played", () => {
    expect(calculateSynergyScore(0, 0)).toBe(50);
  });

  it("applies Bayesian Laplace smoothing for low sample sizes", () => {
    // 1 match, 1 win: (1 + 1) / (1 + 2) = 2/3 = 67%
    expect(calculateSynergyScore(1, 1)).toBe(67);
    // 1 match, 0 wins: (0 + 1) / (1 + 2) = 1/3 = 33%
    expect(calculateSynergyScore(1, 0)).toBe(33);
  });

  it("converges toward actual win rate as sample size increases", () => {
    // 10 matches, 10 wins: (10 + 1) / (10 + 2) = 11/12 = 92%
    expect(calculateSynergyScore(10, 10)).toBe(92);
    // 100 matches, 80 wins: (80 + 1) / (100 + 2) = 81/102 = 79%
    expect(calculateSynergyScore(100, 80)).toBe(79);
  });

  it("clamps between 0 and 100", () => {
    expect(calculateSynergyScore(-1, 0)).toBe(50);
    expect(calculateSynergyScore(5, 5)).toBeGreaterThanOrEqual(0);
    expect(calculateSynergyScore(5, 5)).toBeLessThanOrEqual(100);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/synergy/calculator.test.ts`  
Expected: FAIL with "Cannot find module '@/lib/synergy/calculator'"

- [x] **Step 3: Write minimal implementation**

```ts
// src/lib/synergy/calculator.ts
/**
 * Calculates synergy score (0 - 100%) using Bayesian Laplace smoothing.
 * Prior is 50% (1 win out of 2 pseudogames) to prevent volatility with small sample sizes.
 */
export function calculateSynergyScore(matchesPlayed: number, wins: number): number {
  if (matchesPlayed <= 0) return 50;
  const clampedWins = Math.max(0, Math.min(wins, matchesPlayed));
  const smoothed = (clampedWins + 1) / (matchesPlayed + 2);
  return Math.max(0, Math.min(100, Math.round(smoothed * 100)));
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/synergy/calculator.test.ts`  
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/lib/synergy/calculator.ts tests/synergy/calculator.test.ts
git commit -m "feat(synergy): add Bayesian Laplace synergy calculator"
```

---

### Task 2: Decoupled Privacy Policy Resolver

**Files:**
- Create: `src/lib/privacy/profile-visibility.ts`
- Test: `tests/privacy/profile-visibility.test.ts`

**Interfaces:**
- Produces: `resolveProfileVisibility(viewerAccountId: string | null, targetAccount: PlayerAccountRecord, stats: { bestPartner: BestPartnerData | null; viewerSynergyScore: number | null }): SanitizedProfileView`

- [x] **Step 1: Write the failing test**

```ts
// tests/privacy/profile-visibility.test.ts
import { describe, it, expect } from "vitest";
import { resolveProfileVisibility } from "@/lib/privacy/profile-visibility";
import type { PlayerAccountRecord } from "@/lib/domain/types";

describe("resolveProfileVisibility", () => {
  const publicAccount: PlayerAccountRecord = {
    id: "acc_1",
    username: "pickle_pro",
    name: "Alex Pro",
    isPublic: true,
    skillLevel: "advanced",
    initialRating: 1400,
    createdAt: new Date(),
  };

  const privateAccount: PlayerAccountRecord = {
    id: "acc_2",
    username: "stealth_ace",
    name: "Sam Stealth",
    isPublic: false,
    skillLevel: "intermediate",
    initialRating: 1100,
    createdAt: new Date(),
  };

  const stats = {
    bestPartner: {
      partnerAccountId: "acc_3",
      username: "top_partner",
      synergyScore: 88,
      matchesPlayed: 12,
    },
    viewerSynergyScore: 75,
  };

  it("returns full profile when target is public", () => {
    const view = resolveProfileVisibility("viewer_acc", publicAccount, stats);
    expect(view.isRestricted).toBe(false);
    expect(view.username).toBe("pickle_pro");
    expect(view.rating).toBe(1400);
    expect(view.bestPartner?.username).toBe("top_partner");
    expect(view.viewerSynergyScore).toBe(75);
  });

  it("strips ratings and partner stats when target is private and viewer is another user", () => {
    const view = resolveProfileVisibility("viewer_acc", privateAccount, stats);
    expect(view.isRestricted).toBe(true);
    expect(view.username).toBe("stealth_ace");
    expect(view.name).toBe("Sam Stealth");
    expect(view.rating).toBeUndefined();
    expect(view.skillLevel).toBeUndefined();
    expect(view.bestPartner).toBeUndefined();
  });

  it("returns full profile when viewer is the owner even if account is private", () => {
    const view = resolveProfileVisibility("acc_2", privateAccount, stats);
    expect(view.isRestricted).toBe(false);
    expect(view.username).toBe("stealth_ace");
    expect(view.rating).toBe(1100);
    expect(view.bestPartner?.username).toBe("top_partner");
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/privacy/profile-visibility.test.ts`  
Expected: FAIL with "Cannot find module '@/lib/privacy/profile-visibility'"

- [x] **Step 3: Write minimal implementation**

```ts
// src/lib/privacy/profile-visibility.ts
import type { PlayerAccountRecord } from "@/lib/domain/types";

export interface BestPartnerData {
  readonly partnerAccountId: string;
  readonly username: string;
  readonly synergyScore: number;
  readonly matchesPlayed: number;
}

export interface SanitizedProfileView {
  readonly accountId: string;
  readonly username: string;
  readonly name: string;
  readonly isPublic: boolean;
  readonly isRestricted: boolean;
  readonly skillLevel?: "beginner" | "intermediate" | "advanced";
  readonly rating?: number;
  readonly bestPartner?: BestPartnerData | null;
  readonly viewerSynergyScore?: number | null;
}

export function resolveProfileVisibility(
  viewerAccountId: string | null,
  targetAccount: PlayerAccountRecord,
  stats: {
    bestPartner: BestPartnerData | null;
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

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/privacy/profile-visibility.test.ts`  
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/lib/privacy/profile-visibility.ts tests/privacy/profile-visibility.test.ts
git commit -m "feat(privacy): add decoupled profile visibility policy resolver"
```

---

### Task 3: Database Migration & Repository Extensions

**Files:**
- Create: `migrations/202610100003_player_privacy_and_synergy.sql`
- Modify: `src/lib/domain/types.ts`
- Modify: `src/lib/domain/repositories.ts`
- Modify: `src/lib/db/postgres-repositories.ts`
- Test: `tests/domain/synergy-repository.test.ts`

**Interfaces:**
- Consumes: `calculateSynergyScore`, types from `src/lib/domain/types.ts`
- Produces:
  - `updatePlayerPrivacy(accountId: string, isPublic: boolean): Promise<void>`
  - `getPairSynergy(accountIdA: string, accountIdB: string): Promise<PlayerSynergyRecord | null>`
  - `getBestPartner(accountId: string): Promise<BestPartnerData | null>`
  - `recordMatchesSynergy(pairResults: readonly { accountIdA: string; accountIdB: string; won: boolean }[]): Promise<void>`
  - `searchPlayerAccounts(query: string, limit?: number): Promise<readonly PlayerAccountRecord[]>`

- [x] **Step 1: Write migration SQL file**

```sql
-- migrations/202610100003_player_privacy_and_synergy.sql
alter table players
  add column if not exists is_public boolean not null default true;

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

- [x] **Step 2: Update types and repositories interface**

Add `isPublic: boolean` to `PlayerAccountRecord`.  
Add `PlayerSynergyRecord` and repository method signatures to `src/lib/domain/repositories.ts`.

- [x] **Step 3: Implement repository methods in `postgres-repositories.ts`**

Implement `getPairSynergy`, `getBestPartner`, `recordMatchesSynergy`, `updatePlayerPrivacy`, and `searchPlayerAccounts`.

- [x] **Step 4: Write repository test to verify canonical ordering and synergy tracking**

```ts
// tests/domain/synergy-repository.test.ts
import { describe, it, expect } from "vitest";
import { calculateSynergyScore } from "@/lib/synergy/calculator";

describe("Canonical pair ordering", () => {
  it("orders accounts deterministically", () => {
    const accA = "acc_aaa";
    const accB = "acc_bbb";
    const [first, second] = accA < accB ? [accA, accB] : [accB, accA];
    expect(first).toBe("acc_aaa");
    expect(second).toBe("acc_bbb");
  });
});
```

- [x] **Step 5: Run tests and apply migration to Neon**

Run: `node scripts/migrate.js && npx vitest run tests/domain/synergy-repository.test.ts`  
Expected: Migration executes successfully, test PASS.

- [x] **Step 6: Commit**

```bash
git add migrations/202610100003_player_privacy_and_synergy.sql src/lib/domain/ src/lib/db/ tests/domain/synergy-repository.test.ts
git commit -m "feat(db): add player_synergy table and repository methods"
```

---

### Task 4: Match Completion Synergy Updates

**Files:**
- Modify: `src/app/actions/sessions.ts` (in `completeRoundAction`)
- Test: `tests/domain/session-synergy.test.ts`

**Interfaces:**
- Consumes: `repository.recordMatchesSynergy`
- Produces: automatically increments matches and wins for teammates with accounts upon round completion

- [x] **Step 1: Write failing test for session synergy update extraction**

```ts
// tests/domain/session-synergy.test.ts
import { describe, it, expect } from "vitest";

describe("Session synergy pair extraction", () => {
  it("extracts teammates pairs when both have accounts", () => {
    const court = {
      team1: [{ accountId: "acc_1" }, { accountId: "acc_2" }],
      team2: [{ accountId: "acc_3" }, { accountId: null }],
      winnerTeam: 1,
    };
    const pairs: { accountIdA: string; accountIdB: string; won: boolean }[] = [];
    if (court.team1[0].accountId && court.team1[1].accountId) {
      pairs.push({
        accountIdA: court.team1[0].accountId,
        accountIdB: court.team1[1].accountId,
        won: court.winnerTeam === 1,
      });
    }
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toEqual({ accountIdA: "acc_1", accountIdB: "acc_2", won: true });
  });
});
```

- [x] **Step 2: Run test to verify it passes**

Run: `npx vitest run tests/domain/session-synergy.test.ts`  
Expected: PASS

- [x] **Step 3: Integrate pair synergy recording into `completeRoundAction`**

In `src/app/actions/sessions.ts`:
When matches are recorded in `completeRoundAction`, collect doubles teams where both players have an `accountId`, determine if their team won, and call `repository.recordMatchesSynergy(pairs)`.

- [x] **Step 4: Run full test suite**

Run: `npm test`  
Expected: PASS (all existing tests still pass)

- [x] **Step 5: Commit**

```bash
git add src/app/actions/sessions.ts tests/domain/session-synergy.test.ts
git commit -m "feat(sessions): record player synergy upon round completion"
```

---

### Task 5: Server Actions for Username Search & Privacy Updates

**Files:**
- Modify: `src/app/actions/players.ts`
- Test: `tests/actions/player-search-and-privacy.test.ts`

**Interfaces:**
- Produces:
  - `searchPlayersByUsernameAction(query: string, currentGroupId: string): Promise<ActionResult<readonly SearchPlayerResult[]>>`
  - `updatePlayerPrivacyAction(isPublic: boolean): Promise<ActionResult<void>>`
  - `addPlayerByAccountIdAction(params: { groupId: string; accountId: string }): Promise<ActionResult<PlayerRecord>>`

- [x] **Step 1: Write the failing test**

```ts
// tests/actions/player-search-and-privacy.test.ts
import { describe, it, expect } from "vitest";
import { searchPlayersByUsernameAction, updatePlayerPrivacyAction } from "@/app/actions/players";

describe("searchPlayersByUsernameAction validation", () => {
  it("rejects search queries shorter than 2 characters", async () => {
    const res = await searchPlayersByUsernameAction("a", "grp_1");
    expect(res.ok).toBe(false);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/actions/player-search-and-privacy.test.ts`  
Expected: FAIL (action not exported yet)

- [x] **Step 3: Implement server actions in `src/app/actions/players.ts`**

Export:
- `searchPlayersByUsernameAction` (sanitizes results with `resolveProfileVisibility`)
- `updatePlayerPrivacyAction`
- `addPlayerByAccountIdAction`

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/actions/player-search-and-privacy.test.ts`  
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/app/actions/players.ts tests/actions/player-search-and-privacy.test.ts
git commit -m "feat(actions): add username search and privacy update server actions"
```

---

### Task 6: Group Dashboard Player Search & Add UI

**Files:**
- Create: `src/components/groups/player-search-drawer.tsx`
- Modify: `src/app/g/[groupId]/page.tsx`
- Modify: `src/app/g/[groupId]/players/players-client.tsx`
- Test: `tests/components/player-search-drawer.test.tsx`

**Interfaces:**
- Consumes: `searchPlayersByUsernameAction`, `addPlayerByAccountIdAction`
- Produces: Interactive search component allowing organizers to search `@username`, preview public chemistry (or private lock badge), and add to the group roster.

- [x] **Step 1: Write component test**

```tsx
// tests/components/player-search-drawer.test.tsx
import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { PlayerSearchDrawer } from "@/components/groups/player-search-drawer";

describe("PlayerSearchDrawer", () => {
  it("renders search input with placeholder", () => {
    render(<PlayerSearchDrawer groupId="test_grp" onPlayerAdded={() => {}} />);
    expect(screen.getByPlaceholderText(/search by @username/i)).toBeDefined();
  });
});
```

- [x] **Step 2: Implement `PlayerSearchDrawer` component**

Include debounced search input, results list, preview card showing `@username`, public stats / "Best Partner" (or `🔒 Private Profile`), and an "Add to Group" button.

- [x] **Step 3: Integrate into Group Dashboard & Players Roster**

Embed `PlayerSearchDrawer` into `src/app/g/[groupId]/page.tsx` and `src/app/g/[groupId]/players/players-client.tsx`.

- [x] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/player-search-drawer.test.tsx`  
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/components/groups/player-search-drawer.tsx src/app/g/[groupId]/page.tsx src/app/g/[groupId]/players/players-client.tsx tests/components/player-search-drawer.test.tsx
git commit -m "feat(ui): add username search drawer to group dashboard and roster"
```

---

### Task 7: Serving Synergy in Active Rounds (Partner Badge & Organizer Modal)

**Files:**
- Create: `src/components/rounds/synergy-reveal-modal.tsx`
- Modify: `src/components/rounds/current-round.tsx`
- Modify: `src/app/g/[groupId]/sessions/[sessionId]/page.tsx`
- Test: `tests/components/current-round-synergy.test.tsx`

**Interfaces:**
- Consumes: Pairwise synergy data passed down to round view
- Produces:
  - Partner synergy badge on court card when viewer is a court participant
  - "⚡ Reveal Synergy" modal for organizers to inspect court chemistry

- [x] **Step 1: Write test for partner synergy badge display**

```tsx
// tests/components/current-round-synergy.test.tsx
import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { CurrentRoundView } from "@/components/rounds/current-round";

describe("CurrentRoundView synergy badge", () => {
  it("shows partner synergy badge when viewer is on court with partner", () => {
    render(
      <CurrentRoundView
        round={{ id: "r1", roundNumber: 1, status: "started", seed: 1 }}
        courts={[{ courtNumber: 1, team1: ["p1", "p2"], team2: ["p3", "p4"] }]}
        sittingPlayerIds={[]}
        playerNames={{ p1: "Alice", p2: "Bob", p3: "Charlie", p4: "Dave" }}
        currentViewerPlayerId="p1"
        partnerSynergy={{ score: 84, matchesPlayed: 10 }}
      />
    );
    expect(screen.getByText(/84% synergy/i)).toBeDefined();
  });
});
```

- [x] **Step 2: Implement `SynergyRevealModal` and update `CurrentRoundView`**

Add partner badge to active court card, and add "⚡ Reveal Synergy" button/modal for organizers.

- [x] **Step 3: Run test to verify it passes**

Run: `npx vitest run tests/components/current-round-synergy.test.tsx`  
Expected: PASS

- [x] **Step 4: Commit**

```bash
git add src/components/rounds/synergy-reveal-modal.tsx src/components/rounds/current-round.tsx src/app/g/[groupId]/sessions/[sessionId]/page.tsx tests/components/current-round-synergy.test.tsx
git commit -m "feat(rounds): serve partner synergy to players and add organizer reveal modal"
```

---

### Task 8: Player Profile Privacy Toggle, Best Partner Spotlight & Documentation

**Files:**
- Modify: `src/components/players/player-profile-controls.tsx`
- Modify: `src/app/players/page.tsx`
- Create: `docs/synergy-and-privacy-system.md`
- Test: `tests/components/player-profile-synergy.test.tsx`

**Interfaces:**
- Consumes: `updatePlayerPrivacyAction`, `repository.getBestPartner`
- Produces:
  - Interactive Privacy switch in player profile
  - "Best Partner Overall" spotlight card
  - Comprehensive documentation in `docs/synergy-and-privacy-system.md`

- [x] **Step 1: Write test for profile privacy toggle & best partner card**

```tsx
// tests/components/player-profile-synergy.test.tsx
import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { PlayerProfileHeader } from "@/components/players/player-profile-controls";

describe("PlayerProfileHeader privacy toggle", () => {
  it("displays current privacy state", () => {
    render(
      <PlayerProfileHeader
        initialName="Alex"
        initialUsername="alex123"
        initialGender="male"
        skillLevel="advanced"
        initialRating={1400}
        initialIsPublic={true}
      />
    );
    expect(screen.getByText(/public/i)).toBeDefined();
  });
});
```

- [x] **Step 2: Update `PlayerProfileHeader` & `PlayerProfilePage`**

Add the privacy toggle and "Best Partner Overall" card (displaying `@partner_username` and synergy score %).

- [x] **Step 3: Create documentation in `docs/synergy-and-privacy-system.md`**

Document the system architecture, mathematical formula, privacy model, and user guides for organizers and players.

- [x] **Step 4: Run full test suite to verify all tests pass**

Run: `npm test && npm run typecheck`  
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/components/players/player-profile-controls.tsx src/app/players/page.tsx docs/synergy-and-privacy-system.md tests/components/player-profile-synergy.test.tsx
git commit -m "feat(profile): add privacy toggle, best partner spotlight, and documentation"
```
