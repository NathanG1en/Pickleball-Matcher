# Elo Rating System

This document outlines how individual player ratings (Elo) are calculated, adjusted, and maintained across doubles pickleball matches in Pickleball Matchmaker.

---

## 1. Internal Storage vs. User-Facing Presentation

Under the hood, all match calculations, replay systems, and database columns operate on a standard 1,000-centered Elo integer scale. **However, all user-facing screens and inputs exclusively display and accept decimal skill ratings aligned with standard DUPR ratings ($2.000$ to $8.000$)**:

- **Beginner**: `2.000` ($400$ Elo)
- **Advanced Beginner**: `2.500` ($600$ Elo)
- **Intermediate**: `3.000` ($800$ Elo)
- **Advanced Intermediate**: `3.500` ($1,000$ Elo default)
- **Competitive**: `4.000` ($1,200$ Elo)
- **Advanced Competitive**: `4.500` ($1,400$ Elo)
- **Expert / Pro / World-Class**: `5.000` – `8.000` ($1,600$ – $2,800$ Elo)

### Conversion Formula
Implementation reference: [`src/lib/domain/rating-display.ts`](file:///Users/nathanglen/Documents/ChatGPT/Pickleball%20Matcher/src/lib/domain/rating-display.ts)

$$\text{dupr}(\text{elo}) = 3.500 + \frac{\text{elo} - 1000}{400}$$

$$\text{elo}(\text{dupr}) = 1000 + (\text{dupr} - 3.500) \times 400$$

* Every **100 Elo points** corresponds to **0.250 DUPR points**.
* An even-match outcome ($\pm 10$ Elo) translates to $\pm 0.025$ DUPR points.
* Users never see or type raw 1,000s Elo numbers.

---

## 2. The Doubles Elo Algorithm

Implementation reference: [`src/lib/matchmaking/rating.ts`](../src/lib/matchmaking/rating.ts)

Because pickleball is typically played in doubles, ratings are calculated by evaluating two-player teams against each other.

### Step 1: Team Rating
The rating of a doubles team is the arithmetic average of both partners:

$$R_{\text{team}} = \frac{R_{\text{player 1}} + R_{\text{player 2}}}{2}$$

```typescript
export function teamRating(ratings: readonly [number, number]): number {
  return (ratings[0] + ratings[1]) / 2;
}
```

---

### Step 2: Expected Win Probability ($E$)
The expected outcome for Team 1 facing Team 2 uses the standard Elo logistic curve scaled across 400 points:

$$E_1 = \frac{1}{1 + 10^{(R_{\text{team 2}} - R_{\text{team 1}}) / 400}}$$

$$E_2 = 1 - E_1$$

- If Team 1 and Team 2 have equal ratings, each has an expected score of **0.50** (50% win probability).
- If Team 1 has a rating 100 points higher than Team 2, Team 1 has an expected score of **~0.64** (64% win probability).
- If Team 1 has a rating 400 points higher, Team 1 has an expected score of **~0.91** (91% win probability).

---

### Step 3: Dynamic K-Factor (Provisional vs. Established)
To help newer players reach their accurate rating quickly without destabilizing seasoned players, the system uses a 2-tier K-factor:

- **Provisional (Placement Phase)**: $K = 40$ when a player has played fewer than 10 rated games (`ratedGames < 10`).
- **Established Phase**: $K = 20$ once a player has played 10 or more rated games (`ratedGames \ge 10`).

A team's effective K-factor is the average of both partners' individual K-factors:

$$K_{\text{team}} = \frac{K_{\text{partner 1}} + K_{\text{partner 2}}}{2}$$

```typescript
export function kFactor(ratedGames: number): 40 | 20 {
  return ratedGames < 10 ? 40 : 20;
}

function commonTeamK(team: readonly [RatedPlayer, RatedPlayer]): number {
  return (kFactor(team[0].ratedGames) + kFactor(team[1].ratedGames)) / 2;
}
```

---

### Step 4: Rating Adjustment ($\Delta$)
Upon match completion, actual scores are treated as a binary outcome ($S = 1$ for win, $S = 0$ for loss):

$$\Delta_{\text{team 1}} = K_{\text{team 1}} \times (S_1 - E_1)$$

$$\Delta_{\text{team 2}} = K_{\text{team 2}} \times (S_2 - E_2)$$

Both partners on each team receive their team's delta:

$$R_{\text{player, new}} = R_{\text{player, old}} + \Delta_{\text{team}}$$

#### Example
- **Team 1** ($R_{\text{team}} = 1000$, both players established $K=20$) plays **Team 2** ($R_{\text{team}} = 1000$, both players established $K=20$).
- Expected score $E_1 = 0.50$.
- **Team 1 wins** ($S_1 = 1$):
  - $\Delta_{\text{team 1}} = 20 \times (1 - 0.50) = +10$
  - $\Delta_{\text{team 2}} = 20 \times (0 - 0.50) = -10$
- Both players on Team 1 gain **+10 points**.
- Both players on Team 2 lose **10 points**.

---

## 3. Historical Replay Architecture

Implementation reference: [`src/lib/domain/rating-replay.ts`](file:///Users/nathanglen/Documents/ChatGPT/Pickleball%20Matcher/src/lib/domain/rating-replay.ts)

Instead of mutating player ratings permanently in place, the application uses an **event-sourced replay design**:

1. **Deterministic Order**: When ratings are updated, all completed matches in the group are replayed chronologically (`first.completedAt - second.completedAt`).
2. **Score Corrections & Cancellations**: If an organizer fixes an earlier score typo or cancels a previous match, [`replayRatings()`](file:///Users/nathanglen/Documents/ChatGPT/Pickleball%20Matcher/src/lib/domain/rating-replay.ts#L5) recalculates the entire timeline starting from each player's `initialRating`.
3. **Audit Trail**: Every match retains an explicit [`RatingSnapshot`](file:///Users/nathanglen/Documents/ChatGPT/Pickleball%20Matcher/src/lib/domain/types.ts#L100) record showing the player's rating before and after the match.
