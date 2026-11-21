# Elo Rating System

This document outlines how individual player ratings (Elo) are calculated, adjusted, and maintained across doubles pickleball matches in Pickleball Matchmaker, incorporating empirical findings from DUPR rating dynamics in a recreational-safe formulation.

---

## 1. Internal Storage vs. User-Facing Presentation

Under the hood, all match calculations, replay systems, and database columns operate on a standard 1,000-centered Elo scale. **All user-facing screens and inputs exclusively display and accept decimal skill ratings aligned with standard DUPR ratings ($2.000$ to $8.000$)**:

- **Beginner**: `2.000` ($400$ Elo)
- **Advanced Beginner**: `2.500` ($600$ Elo)
- **Intermediate**: `3.000` ($800$ Elo)
- **Advanced Intermediate**: `3.500` ($1,000$ Elo default)
- **Competitive**: `4.000` ($1,200$ Elo)
- **Advanced Competitive**: `4.500` ($1,400$ Elo)
- **Expert / Pro / World-Class**: `5.000` – `8.000` ($1,600$ – $2,800$ Elo)

### Conversion Formula
Implementation reference: [`src/lib/domain/rating-display.ts`](../src/lib/domain/rating-display.ts)

$$\text{dupr}(\text{elo}) = 3.500 + \frac{\text{elo} - 1000}{400}$$

$$\text{elo}(\text{dupr}) = 1000 + (\text{dupr} - 3.500) \times 400$$

* Every **100 Elo points** corresponds to **0.250 DUPR points**.
* An even-match outcome ($\pm 10$ Elo) translates to $\pm 0.025$ DUPR points.
* Users never see or type raw 1,000s Elo numbers in the UI.

---

## 2. The Recreational-Safe DUPR Doubles Algorithm

Implementation reference: [`src/lib/matchmaking/rating.ts`](../src/lib/matchmaking/rating.ts)

Analysis of real-world match rating records demonstrates that ratings in pickleball are driven primarily by **opponent strength relative to yours** rather than binary win/loss or running up the score in blowouts. Recreational-Safe DUPR incorporates these empirical principles while guaranteeing that winning players never drop rating.

### Step 1: Team Rating (Weak-Link Weighting)
In doubles pickleball, opponents naturally target and isolate the lower-rated player (80–90% of shots directed at the weaker link). Rather than assuming a naive 50/50 arithmetic average, the effective team rating is skewed toward the lower-rated partner ($65\%$ weight on weaker player, $35\%$ on stronger player):

$$R_{\text{team}} = R_{\text{weak}} + 0.35 \times (R_{\text{strong}} - R_{\text{weak}})$$

```typescript
export const WEAK_LINK_WEIGHT = 0.35;

export function teamRating(ratings: readonly [number, number]): number {
  const rMin = Math.min(ratings[0], ratings[1]);
  const rMax = Math.max(ratings[0], ratings[1]);
  return rMin + WEAK_LINK_WEIGHT * (rMax - rMin);
}
```

---

### Step 2: Expected Win Probability ($E$)
The expected outcome for Team 1 facing Team 2 uses the standard Elo logistic curve scaled across 400 points:

$$E_1 = \frac{1}{1 + 10^{(R_{\text{team 2}} - R_{\text{team 1}}) / 400}}$$

$$E_2 = 1 - E_1$$

- If Team 1 and Team 2 have equal ratings, each has an expected score of **0.50** (50% win probability).
- If Team 1 has a rating 400 points higher, Team 1 has an expected score of **~0.91** (91% win probability).

---

### Step 3: Dynamic K-Factor (Gradual Decay & Inactivity Uncertainty)
To help newer players reach their accurate rating quickly without destabilizing seasoned players, the system uses a smooth, continuous K-factor model:

- **Bounds**: $K \in [16, 40]$ ($K_{\max} = 40$, $K_{\min} = 16$).
  - **Established Baseline ($K_{\min} = 16$)**: Starting with $K = 16$ for seasoned players (rather than $20$) gives score-margin room to matter without making ratings overly reactive.
- **Gradual Experience Decay**: Rather than an abrupt cliff at 10 games, base K decays exponentially as rated-game history grows:

$$K_{\text{base}}(g) = 16 + 24 \times e^{-g / 12}$$

- **Recency & Reliability (Inactivity Boost)**: Inactivity increases uncertainty about a player's current form without silently altering their rating:
  - **Grace Period**: Inactivity $\le 14$ days incurs no uncertainty increase ($\text{boost} = 0$).
  - **Uncertainty Scaling**: Beyond 14 days, uncertainty rises smoothly over a 30-day characteristic timescale toward $K_{\max}$:

$$\text{boost}(\Delta t) = (K_{\max} - K_{\text{base}}) \times \left(1 - e^{-(\Delta t - 14) / 30}\right) \quad (\text{for } \Delta t > 14 \text{ days})$$

$$K_{\text{effective}} = \min(K_{\max}, K_{\text{base}} + \text{boost})$$

---

### Step 4: Continuous Point Share Performance ($S^*$)
In pickleball, match scores carry critical evidence about relative team ability. We evaluate match results through continuous performance blending match victory ($65\%$) with actual point share ($35\%$):

$$S_{\text{pts}, 1} = \frac{s_1}{s_1 + s_2}, \quad S_{\text{pts}, 2} = \frac{s_2}{s_1 + s_2}$$

$$S^*_1 = 0.65 \times W_1 + 0.35 \times S_{\text{pts}, 1}$$

$$S^*_2 = 0.65 \times W_2 + 0.35 \times S_{\text{pts}, 2}$$

Team surprise is calculated against expected match outcome:

$$\text{rawSurprise}_1 = S^*_1 - E_1, \quad \text{rawSurprise}_2 = S^*_2 - E_2$$

---

### Step 5: The Recreational-Safe Floor Rule
* In pure DUPR, when a 5.0 player squeaks by a 3.0 beginner 11–9, the favorite drops rating because they underperformed the expected point spread. In a recreational setting, losing rating on a win is confusing and demoralizing for players.
* **The Recreational-Safe Guarantee**:
  - **Winners never lose rating**: If a team won the match, their surprise is floored at $\ge 0$:
    $$\text{surprise}_{\text{winner}} = \max(0, \text{rawSurprise}_{\text{winner}})$$
  - **Underdogs can gain on close losses**: If a lower-rated team plays up against a much stronger team and loses a tight 11–9 battle, their point share ($S_{\text{pts}} = 9/20 = 0.45$) significantly beats their low expected score ($E \approx 0.09$). Their raw surprise is positive ($\text{rawSurprise} > 0$), so they **gain rating even when losing**.

---

### Step 6: Teammate Responsibility & Carrier Shielding
In doubles, teammates with different ratings receive individualized adjustments based on their expectation against the opposing team:

$$e_i = \text{expectedScore}(R_{\text{player } i}, R_{\text{opp}})$$

* **On rating gains (wins / spread beats)**: The lower-rated partner faced a harder challenge and receives a proportionally larger share of the gain:
  $$w_i = \frac{1 - e_i}{(1 - e_0) + (1 - e_1)}$$
* **On rating drops (losses)**: Both partners share the loss drop equally ($w_0 = w_1 = 0.5$). This **shields the higher-rated carrier**: because opponents naturally isolate the weaker partner, the stronger player cannot touch the ball enough to carry the match alone. Blaming the higher-rated partner for the loss would unfairly penalize them for mentoring or partnering with lower-rated friends.

Each partner's scale is $2 \cdot w_i$, so partners with equal ratings split 50/50 ($2 \cdot 0.5 = 1.0$).

---

### Step 7: Rating Tier Deflation & Inflation Asymmetry
To reflect empirical rating dynamics across skill tiers:
* **4.5+ DUPR Tier (Elo $\ge 1400$)**: Experiences slight natural deflation (wins reward 10% less, losses penalize 10% more).
* **<3.0 DUPR Tier (Elo $< 800$)**: Experiences positive learning-curve mobility (+8% on gains, -5% on losses).
* **Intermediate Tier ($800 \le \text{Elo} < 1400$)**: Completely balanced ($\mu = 1.00$).

---

### Step 8: The Zero-Change Mystery ($10.3\%$ Deadband Filter)
In empirical DUPR data, $10.3\%$ of matches result in exactly $0.000$ rating change, especially in balanced matches where the outcome falls within expected measurement noise.

We apply an insignificance deadband filter ($\tau_{\min} = 0.5$ Elo points $\approx 0.00125$ DUPR):
$$\Delta R_{\text{final}} = \begin{cases}
0.0 & \text{if } |\Delta R| < 0.5 \\
\Delta R & \text{otherwise}
\end{cases}$$

This prevents pointless rating jitter when matches proceed as statistically expected.

---

## 3. Historical Replay Architecture

Implementation reference: [`src/lib/domain/rating-replay.ts`](../src/lib/domain/rating-replay.ts)

Instead of mutating player ratings permanently in place, the application uses an **event-sourced replay design**:

1. **Deterministic Order**: All completed matches are replayed chronologically by `completedAt` timestamp, with ties broken deterministically by match ID (`first.id.localeCompare(second.id)`).
2. **Exclusion of Non-Doubles Games**: Singles (1-vs-1) and 2-vs-1 matches do not affect doubles Elo ratings and are excluded from rating replays.
3. **Inactivity Replay Without Schema Additions**: During chronological replay, each player's prior match timestamp is tracked in-memory, computing elapsed inactivity days without requiring extra database persistence or schema migrations.
4. **Score Corrections & Cancellations**: If an organizer edits a score, fixes an error, or cancels a match, [`replayRatings()`](../src/lib/domain/rating-replay.ts) recalculates the entire timeline starting from each player's `initialRating`.
5. **Audit Trail**: Every match retains an explicit [`RatingSnapshot`](../src/lib/domain/types.ts) showing each participant's rating before and after the match.
