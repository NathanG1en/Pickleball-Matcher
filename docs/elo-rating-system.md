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

#### Step 3: Dynamic K-Factor (Gradual Decay & Inactivity Uncertainty)
To help newer players reach their accurate rating quickly without destabilizing seasoned players, the system uses a smooth, continuous K-factor model with sensible documented bounds:

- **Bounds**: $K \in [16, 40]$ ($K_{\max} = 40$, $K_{\min} = 16$).
  - **Established Baseline ($K_{\min} = 16$)**: Starting with $K = 16$ for seasoned players (rather than $20$) gives the new score-margin signal room to matter without making ratings overly reactive.
- **Gradual Experience Decay**: Rather than an abrupt cliff at 10 games, base K decays exponentially as rated-game history grows:

$$K_{\text{base}}(g) = K_{\min} + (K_{\max} - K_{\min}) \times e^{-g / 12} = 16 + 24 \times e^{-g / 12}$$

  - At $g = 0$ (new player): $K_{\text{base}} = 40.0$.
  - At $g = 5$: $K_{\text{base}} \approx 31.8$.
  - At $g = 10$: $K_{\text{base}} \approx 26.4$.
  - At $g = 20$: $K_{\text{base}} \approx 20.5$.
  - At $g \ge 40$: $K_{\text{base}} \to 16.0$.

- **Recency & Reliability (Inactivity Boost)**: Inactivity increases uncertainty about a player's current form, which increases responsiveness ($K$) without silently altering their rating:
  - **Grace Period**: Inactivity $\le 14$ days incurs no uncertainty increase ($\text{boost} = 0$).
  - **Uncertainty Scaling**: Beyond 14 days, uncertainty rises smoothly over a 30-day characteristic timescale toward $K_{\max}$:

$$\text{boost}(\Delta t) = (K_{\max} - K_{\text{base}}) \times \left(1 - e^{-(\Delta t - 14) / 30}\right) \quad (\text{for } \Delta t > 14 \text{ days})$$

$$K_{\text{effective}} = \min(K_{\max}, K_{\text{base}} + \text{boost})$$

  - **No Rating Drift**: A dormant player's rating never moves toward 1,000 or any other value while inactive. The increased uncertainty only increases responsiveness ($K$) when they return and produce new match evidence.
  - **Rapid Resensitization**: Immediately after completing their return match, their last-match timestamp resets, restoring active base K for subsequent games.

```typescript
export function kFactor(
  ratedGames: number,
  options?: { daysInactive?: number | null } | number | null,
): number {
  const games = Math.max(0, ratedGames);
  const baseK = K_MIN + (K_MAX - K_MIN) * Math.exp(-games / K_DECAY_RATE);
  const daysInactive = ...;
  if (daysInactive <= INACTIVITY_GRACE_DAYS) return baseK;
  const uncertaintyFactor = 1 - Math.exp(-(daysInactive - INACTIVITY_GRACE_DAYS) / INACTIVITY_SCALE_DAYS);
  return Math.min(K_MAX, baseK + (K_MAX - baseK) * uncertaintyFactor);
}
```

---

### Step 4: Score Margin Multiplier ($M$)
To make decisive wins count more than narrow squeakers while protecting ratings from blowout volatility, match outcomes incorporate a bounded diminishing-returns score margin multiplier:

- **Baseline Margin ($d_0 = 4$)**: A typical pickleball game (e.g. 11–7, margin 4) produces a neutral multiplier of exactly $M = 1.00$.
- **Blowout Cap ($M_{\max} = 1.25$)**: Capped so an 11–0 blowout win cannot produce a larger swing than the previous winner-only system allowed. For an established player ($K = 16$), the maximum blowout swing ($16 \times 1.25 \times 0.5 = 10.0$) matches the old $K = 20$ system's fixed swing ($20 \times 0.5 = 10.0$).
- **Bounds**: Multiplier is strictly clamped to $[0.75, 1.25]$.
- **Diminishing Returns**: Uses a logarithmic curve scaling smoothly between the baseline margin ($d_0 = 4$) and full blowout ($d = 11$):

$$d = |S_1 - S_2|$$

$$M(d) = \text{clamp}\left(1.0 + (M_{\max} - 1.0) \times \frac{\ln(d + 2) - \ln(6)}{\ln(13) - \ln(6)}, 0.75, 1.25\right)$$

  - **Narrow win ($d = 1$, e.g. 11–10)**: $M \approx 0.776$ (swing $\approx 6.2$ pts for $K=16$).
  - **Close win ($d = 2$, e.g. 11–9)**: $M \approx 0.869$ (swing $\approx 7.0$ pts for $K=16$).
  - **Standard win ($d = 4$, e.g. 11–7)**: $M = 1.000$ (swing $= 8.0$ pts for $K=16$).
  - **Decisive win ($d = 7$, e.g. 11–4)**: $M \approx 1.132$ (swing $\approx 9.1$ pts for $K=16$).
  - **Shutout blowout ($d \ge 11$, e.g. 11–0)**: $M = 1.250$ (swing $= 10.0$ pts for $K=16$).
  - **Invalid/tied/missing scores**: Fall back to $M = 1.00$ according to validation rules.

---

### Step 5: Player-Specific Rating Adjustment ($\Delta$) & Rating Conservation
Unlike systems that assign both teammates a single averaged team K factor, each player receives an **individualized rating update** reflecting their own experience and reliability:

$$\Delta_{1, i} = K_{1, i} \times (W_1 - E_1) \times M$$

$$\Delta_{2, j} = K_{2, j} \times (W_2 - E_2) \times M = - K_{2, j} \times (W_1 - E_1) \times M$$

$$R_{\text{player, new}} = R_{\text{player, old}} + \Delta_{\text{player}}$$

#### Effect on Rating Conservation & Tradeoffs
- **When all 4 players share identical K**: $\sum \Delta = 0$. The rating exchange is perfectly zero-sum.
- **When partners have different experience**: A provisional player ($K=40$) paired with an established veteran ($K=20$) gains or loses more points than the veteran.
- **Tradeoff Analysis**:
  - *Advantage*: Prevents veteran ratings from being artificially destabilized by a newer partner's volatile calibration phase, while allowing the provisional player to converge quickly to their true skill.
  - *Conservation Tradeoff*: Net rating points in a single match are not strictly zero-sum ($\sum \Delta \ne 0$). Across the population, ratings remain stable and bounded because expected win probabilities remain centered around population averages, and established players anchor the network.

---

## 3. Historical Replay Architecture

Implementation reference: [`src/lib/domain/rating-replay.ts`](file:///Users/nathanglen/Documents/ChatGPT/Pickleball%20Matcher/src/lib/domain/rating-replay.ts)

Instead of mutating player ratings permanently in place, the application uses an **event-sourced replay design**:

1. **Deterministic Order**: All completed matches are replayed chronologically by `completedAt` timestamp, with ties broken deterministically by match ID (`first.id.localeCompare(second.id)`).
2. **Exclusion of Non-Doubles Games**: Singles (1-vs-1) and 2-vs-1 matches do not affect doubles Elo ratings and are excluded from rating replays.
3. **Inactivity Replay Without Schema Additions**: During chronological replay, each player's prior match timestamp is tracked in-memory, computing elapsed inactivity days without requiring extra database persistence or schema migrations.
4. **Score Corrections & Cancellations**: If an organizer edits a score, fixes an error, or cancels a match, [`replayRatings()`](file:///Users/nathanglen/Documents/ChatGPT/Pickleball%20Matcher/src/lib/domain/rating-replay.ts) recalculates the entire timeline starting from each player's `initialRating`.
5. **Audit Trail**: Every match retains an explicit [`RatingSnapshot`](file:///Users/nathanglen/Documents/ChatGPT/Pickleball%20Matcher/src/lib/domain/types.ts) showing each participant's rating before and after the match.
