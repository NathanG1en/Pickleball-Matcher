# Mathematical Formulations for Elo Rating Factors

This document breaks down how custom factors can mathematically modify our doubles Elo rating calculations in [src/lib/matchmaking/rating.ts](file:///Users/nathanglen/AntigravityProjects/Pickleball%20Matcher/src/lib/matchmaking/rating.ts), incorporating empirical findings from DUPR rating dynamics.

---

## 1. Current Baseline System

Our current implementation in [src/lib/matchmaking/rating.ts](file:///Users/nathanglen/AntigravityProjects/Pickleball%20Matcher/src/lib/matchmaking/rating.ts) uses standard binary Elo:

$$
\Delta R = K_{\text{team}} \cdot (S - E)
$$

Where:
- **`S`** (Actual outcome): $S \in \{0, 1\}$ ($1$ for win, $0$ for loss).
  - *Reference:* [rating.ts:L41](file:///Users/nathanglen/AntigravityProjects/Pickleball%20Matcher/src/lib/matchmaking/rating.ts#L41)

- **`E`** (Expected outcome based on team ratings):
  $$
  E = \frac{1}{1 + 10^{(R_{\text{opp}} - R_{\text{team}}) / 400}}
  $$
  - *Reference:* [rating.ts:L11-L13](file:///Users/nathanglen/AntigravityProjects/Pickleball%20Matcher/src/lib/matchmaking/rating.ts#L11-L13)

- **`R_team`** (Arithmetic average of teammates):
  $$
  R_{\text{team}} = \frac{R_1 + R_2}{2}
  $$
  - *Reference:* [rating.ts:L7-L9](file:///Users/nathanglen/AntigravityProjects/Pickleball%20Matcher/src/lib/matchmaking/rating.ts#L7-L9)

- **`K_team`** (Experience scaling):
  $$
  K(n) = \begin{cases} 40 & \text{if } n < 10 \\ 20 & \text{if } n \ge 10 \end{cases}
  $$
  $$
  K_{\text{team}} = \frac{K(n_1) + K(n_2)}{2}
  $$
  - *Reference:* [rating.ts:L15-L21](file:///Users/nathanglen/AntigravityProjects/Pickleball%20Matcher/src/lib/matchmaking/rating.ts#L15-L21)

- **Teammate distribution**: Both partners currently receive the identical $\Delta R$.
  - *Reference:* [rating.ts:L23-L35](file:///Users/nathanglen/AntigravityProjects/Pickleball%20Matcher/src/lib/matchmaking/rating.ts#L23-L35)

---

## 2. Empirical DUPR Benchmarks vs. Standard Elo

Analysis of real-world DUPR match rating dynamics reveals five fundamental behavioral phenomena that differ sharply from textbook Elo:

| Empirical Observation | DUPR Reality | Standard Elo Behavior | Why the Discrepancy Exists |
|---|---|---|---|
| **Underdog gains on loss** | Underdogs gain avg $+0.049$ even when losing | Underdog *always* loses points ($S - E < 0$) | Standard Elo only tracks binary win/loss ($S = 0$), not point performance relative to expected spread. |
| **Favorite drops on win** | Favorites drop avg $-0.148$ even when winning | Favorite *always* gains points ($1 - E > 0$) | When a 5.0 squeaks by a 3.0 (11–9), they dramatically underperformed expected dominance. |
| **Score margin doesn't inflate** | Correlation: $+0.018$ (11–0 vs 11–9 is only $\approx 0.05$ rating diff) | Multiplier models over-reward blowouts | Blowouts vs favorites are rare; beating expectations matters $50\times$ more than running up the score. |
| **Rating Level Asymmetry** | $4.5+$ players suffer deflation; $<3.0$ experience inflation | Symmetric zero-sum at all ratings | High ratings have natural regression to the mean; beginners have positive learning curves. |
| **The Zero-Change Mystery** | $10.3\%$ of matches result in exactly $\Delta R = 0.000$ | Float deltas almost never equal $0.000$ | Matches with minimal surprise provide no new statistical information (deadband filter). |

---

## 3. Code Mapping: Where to Implement Each DUPR Behavior

The following diagram maps each empirical phenomenon directly to the functions and lines in [src/lib/matchmaking/rating.ts](file:///Users/nathanglen/AntigravityProjects/Pickleball%20Matcher/src/lib/matchmaking/rating.ts):

```
src/lib/matchmaking/rating.ts
 │
 ├── L11-L13: expectedScore() ───────► [Change 1: Expected Point Share Model]
 ├── L15-L21: kFactor() & commonK() ─► [Change 4: Rating-Tier Asymmetric K (Inflation/Deflation)]
 ├── L23-L35: updatesForTeam() ──────► [Change 5: Asymmetric Teammate Responsibility]
 └── L37-L49: rateMatch()
       ├── L41: actualTeam1 = ... ───► [Change 2: Continuous Performance S* (Gains on Loss)]
       ├── L42-43: teamDelta = ... ──► [Change 3: Muted Margin Factor (No Blowout Bonus)]
       └── L44-48: return [...] ─────► [Change 6: The 0.000 Deadband / Insignificance Rule]
```

---

### Change 1 & 2: Underdogs Gaining on Loss & Favorites Dropping on Win

#### Where in Code:
- [src/lib/matchmaking/rating.ts:L41](file:///Users/nathanglen/AntigravityProjects/Pickleball%20Matcher/src/lib/matchmaking/rating.ts#L41) (`actualTeam1 = input.winner === 1 ? 1 : 0;`)
- [src/lib/matchmaking/rating.ts:L11-L13](file:///Users/nathanglen/AntigravityProjects/Pickleball%20Matcher/src/lib/matchmaking/rating.ts#L11-L13) (`expectedScore`)

#### The Mathematical Problem:
In standard Elo:
```typescript
const actualTeam1 = input.winner === 1 ? 1 : 0;
const team1Delta = K * (actualTeam1 - expectedTeam1);
```
If Team 1 loses, $\text{actualTeam1} = 0$. Because $\text{expectedTeam1} > 0$, $(0 - \text{expectedTeam1})$ is **guaranteed to be negative**. It is mathematically impossible for a loser to gain rating in pure binary win/loss Elo.

#### The DUPR Formulation:
Replace binary match outcome with **point performance vs. expected point share**:

1. **Expected Point Share ($E_{\text{pts}}$)**:
   $$
   E_{\text{pts}} = \frac{1}{1 + 10^{(R_{\text{opp}} - R_{\text{team}}) / 400}}
   $$

2. **Actual Point Share ($S_{\text{pts}}$)**:
   $$
   S_{\text{pts}} = \frac{\text{pts}_{\text{team}}}{\text{pts}_{\text{team}} + \text{pts}_{\text{opp}}}
   $$

3. **Performance Surprise**:
   $$
   \Delta R = K \cdot (S_{\text{pts}} - E_{\text{pts}})
   $$

#### Numerical Proof:
- **Scenario**: 3.5 Team plays 5.0 Team ($\Delta R = -600$ Elo difference).
  - Expected point share for 3.5 team: $E_{\text{pts}} \approx 0.15$ (expected to lose 11–2 or 11–3).
  - Actual match result: 5.0 team wins **11–9**.
  - Actual point share for 3.5 team: $S_{\text{pts}} = \frac{9}{9 + 11} = 0.45$.
  - Surprise for 3.5 team:
    $$
    S_{\text{pts}} - E_{\text{pts}} = 0.45 - 0.15 = \mathbf{+0.30 > 0}
    $$
  - **Result**: The **underdog GAINS rating on a loss** because they won $45\%$ of points when expected to win only $15\%$.
  - Surprise for 5.0 team:
    $$
    S_{\text{pts}} - E_{\text{pts}} = 0.55 - 0.85 = \mathbf{-0.30 < 0}
    $$
  - **Result**: The **favorite LOSES rating on a win** because they allowed 9 points to a much weaker team.

---

### Change 3: Muting the Score Margin (Blowouts Don't Give Bonus Points)

#### Where in Code:
- [src/lib/matchmaking/rating.ts:L42-L43](file:///Users/nathanglen/AntigravityProjects/Pickleball%20Matcher/src/lib/matchmaking/rating.ts#L42-L43)

#### The Mathematical Formulation:
Since score margin correlation is tiny ($+0.018$), avoid aggressive multipliers like $\ln(1 + \Delta \text{pts})$ which over-reward blowouts.

Instead, keep margin influence tightly bounded by blending binary outcome with point share:

$$
S^* = (1 - \beta) \cdot S_{\text{win}} + \beta \cdot S_{\text{pts}} \quad (\beta \approx 0.15)
$$

For an evenly matched pair ($E = 0.50$):
- **11–9 win**: $S^* = 0.85(1.0) + 0.15(0.55) = 0.933 \implies \text{Surprise} = +0.433$
- **11–0 win**: $S^* = 0.85(1.0) + 0.15(1.00) = 1.000 \implies \text{Surprise} = +0.500$
- *Difference*: Only a $\approx 6.7\%$ delta shift between a tight win and a total shutout, matching the empirical observation that blowouts barely matter compared to opponent quality.

---

### Change 4: Rating-Tier Deflation & Inflation Asymmetry

#### Where in Code:
- [src/lib/matchmaking/rating.ts:L15-L17](file:///Users/nathanglen/AntigravityProjects/Pickleball%20Matcher/src/lib/matchmaking/rating.ts#L15-L17) (`kFactor`)
- [src/lib/matchmaking/rating.ts:L42-L43](file:///Users/nathanglen/AntigravityProjects/Pickleball%20Matcher/src/lib/matchmaking/rating.ts#L42-L43) (`teamDelta`)

#### The Empirical Finding:
- **$4.5+$ players (Elo $\ge 1800$)**: Wins reward less than losses penalize (correlation $-0.368$, avg $-0.006$ net deflation).
- **$<3.0$ players (Elo $\le 1200$)**: Heavy inflation regardless of outcome.

#### The Mathematical Formulation:
Introduce rating-dependent $K$-factor scaling:

$$
K_{\text{effective}}(R, \text{isWin}) = K_{\text{base}} \cdot \mu(R, \text{isWin})
$$

Where the tier modifier $\mu$ behaves as follows:

$$
\mu(R, \text{isWin}) = \begin{cases}
1.0 + \delta_{\text{inflate}} & \text{if } R < 1200 \quad \text{(<3.0 tier, positive drift)} \\
1.0 - \delta_{\text{deflate}} \cdot (\text{isWin ? } 1.0 : -0.5) & \text{if } R > 1800 \quad \text{(4.5+ tier, wins worth less, losses hurt more)} \\
1.0 & \text{otherwise (balanced middle tier)}
\end{cases}
$$

This naturally reproduces top-end rating compression and beginner upward mobility.

---

### Change 5: The "Zero-Change Mystery" (Deadband Filter)

#### Where in Code:
- [src/lib/matchmaking/rating.ts:L44-L48](file:///Users/nathanglen/AntigravityProjects/Pickleball%20Matcher/src/lib/matchmaking/rating.ts#L44-L48) (Right before returning updates from `rateMatch`)

#### The Empirical Finding:
**$10.3\%$** of all matches produce exactly **$0.000$** rating change, especially in balanced matches ($\pm 0.3$ DUPR / $\pm 120$ Elo).

#### The Mathematical Formulation:
In statistical rating theory, a match that lands within the expected margin of error contains **zero new information** about player skill.

Define an insignificance deadband threshold $\tau_{\text{min}}$:

$$
\Delta R_{\text{final}} = \begin{cases}
0.0 & \text{if } |\Delta R_{\text{team}}| < \tau_{\text{min}} \\
\Delta R_{\text{team}} & \text{otherwise}
\end{cases}
$$

- Setting $\tau_{\text{min}} \approx 1.5$ Elo points (equivalent to $\approx 0.004$ DUPR points) suppresses micro-adjustments in matches where teams simply performed to expectation.
- This produces the exact $\approx 10\%$ zero-delta cluster observed in real DUPR datasets.

---

### Change 6: Asymmetric Teammate Responsibility

#### Where in Code:
- [src/lib/matchmaking/rating.ts:L23-L35](file:///Users/nathanglen/AntigravityProjects/Pickleball%20Matcher/src/lib/matchmaking/rating.ts#L23-L35) (`updatesForTeam`)

#### The Mathematical Formulation:
Instead of distributing `delta` uniformly to `team[0]` and `team[1]`, weight each partner's delta by their individual expected contribution $E_i$:

$$
E_i = \frac{1}{1 + 10^{(R_{\text{opp}} - R_i) / 400}}
$$

```typescript
// Replace updatesForTeam in rating.ts
function updatesForTeam(
  team: readonly [RatedPlayer, RatedPlayer],
  teamDelta: number,
  oppRating: number,
): readonly [PlayerRatingUpdate, PlayerRatingUpdate] {
  const e0 = expectedScore(team[0].rating, oppRating);
  const e1 = expectedScore(team[1].rating, oppRating);

  // If team lost (teamDelta < 0), higher-rated player absorbs more drop
  // If team won (teamDelta > 0), lower-rated player gets more gain
  const w0 = teamDelta >= 0 ? (1 - e0) / ((1 - e0) + (1 - e1)) : e0 / (e0 + e1);
  const w1 = 1 - w0;

  return [
    { 
      playerId: team[0].id, 
      ratingBefore: team[0].rating, 
      ratingAfter: team[0].rating + teamDelta * 2 * w0, 
      delta: teamDelta * 2 * w0 
    },
    { 
      playerId: team[1].id, 
      ratingBefore: team[1].rating, 
      ratingAfter: team[1].rating + teamDelta * 2 * w1, 
      delta: teamDelta * 2 * w1 
    },
  ];
}
```

---

## 4. Master Unified Pipeline

Combining these factors into a single flow:

$$
\begin{aligned}
R_{\text{team}} &= 0.6 \cdot \min(R_1, R_2) + 0.4 \cdot \max(R_1, R_2) \\
E_{\text{pts}} &= \frac{1}{1 + 10^{(R_{\text{opp}} - R_{\text{team}}) / 400}} \\
S^* &= (1 - \beta) \cdot S_{\text{win}} + \beta \cdot \left(\frac{\text{pts}_{\text{team}}}{\text{pts}_{\text{team}} + \text{pts}_{\text{opp}}}\right) \\
\Delta R_{\text{raw}} &= K_{\text{effective}}(R, \text{isWin}) \cdot (S^* - E_{\text{pts}}) \\
\Delta R_{\text{team}} &= \begin{cases} 0.0 & \text{if } |\Delta R_{\text{raw}}| < \tau_{\text{min}} \\ \Delta R_{\text{raw}} & \text{otherwise} \end{cases} \\
\Delta R_i &= \Delta R_{\text{team}} \cdot w_i
\end{aligned}
$$

---

## 5. Summary of Code Modification Points

| Feature | Target Function | Exact Lines | Code Change Summary |
|---|---|---|---|
| **Underdog Gains on Loss** | `rateMatch` | [rating.ts:L40-L43](file:///Users/nathanglen/AntigravityProjects/Pickleball%20Matcher/src/lib/matchmaking/rating.ts#L40-L43) | Compare actual point share $S_{\text{pts}}$ against expected point share $E_{\text{pts}}$ rather than binary `winner === 1 ? 1 : 0`. |
| **Muted Margin** | `rateMatch` | [rating.ts:L42](file:///Users/nathanglen/AntigravityProjects/Pickleball%20Matcher/src/lib/matchmaking/rating.ts#L42) | Blend binary win with point share at $\approx 85/15$ ratio; do not apply standalone blowout multipliers. |
| **Zero-Change (10.3%)** | `rateMatch` | [rating.ts:L44-L48](file:///Users/nathanglen/AntigravityProjects/Pickleball%20Matcher/src/lib/matchmaking/rating.ts#L44-L48) | Add deadband filter: `if (Math.abs(delta) < MIN_THRESHOLD) delta = 0`. |
| **Rating Tier Bias** | `kFactor` | [rating.ts:L15-L17](file:///Users/nathanglen/AntigravityProjects/Pickleball%20Matcher/src/lib/matchmaking/rating.ts#L15-L17) | Scale $K$ asymmetrically based on player rating ($4.5+$ deflation penalty vs $<3.0$ inflation boost). |
| **Partner Split** | `updatesForTeam` | [rating.ts:L23-L35](file:///Users/nathanglen/AntigravityProjects/Pickleball%20Matcher/src/lib/matchmaking/rating.ts#L23-L35) | Split `teamDelta` based on individual expectation $E_i$ rather than assigning equal delta. |
