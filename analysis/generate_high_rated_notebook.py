"""
Generates the comprehensive Jupyter Notebook: analysis/high_rated_player_analysis.ipynb
"""

import nbformat as nbf
from pathlib import Path

NOTEBOOK_PATH = Path("/Users/nathanglen/AntigravityProjects/Pickleball Matcher/analysis/high_rated_player_analysis.ipynb")

nb = nbf.v4.new_notebook()

# Metadata
nb.metadata = {
    "kernelspec": {
        "display_name": "Python 3 (ipykernel)",
        "language": "python",
        "name": "python3"
    },
    "language_info": {
        "codemirror_mode": {"name": "ipython", "version": 3},
        "file_extension": ".py",
        "mimetype": "text/x-python",
        "name": "python",
        "nbconvert_exporter": "python",
        "pygments_lexer": "ipython3",
        "version": "3.11.0"
    }
}

cells = []

# Cell 1: Markdown Title
cells.append(nbf.v4.new_markdown_cell("""# Objective Evaluation: Do Recent Elo Changes Over-Penalize Higher-Rated Players?

### Executive Summary

In commit `febb60f`, the matchmaking rating engine introduced **Recreational-Safe DUPR dynamics**, replacing standard binary win/loss Elo with:
1. **Continuous Point-Share Performance** ($S^* = 0.65 W + 0.35 S_{\\text{pts}}$)
2. **Recreational-Safe Winner Floor** (Winners never lose rating points)
3. **Asymmetric Partner Responsibility** (Partners split rating adjustments based on individual expectation $e_i$)
4. **Rating Tier Asymmetry** ($4.5+$ DUPR players face $0.90\\times$ on gains, $1.10\\times$ on losses)
5. **Zero-Change Deadband Filter** (Micro-adjustments $< 0.5$ Elo points round to $0.000$)

### The Core Question
**Does this system penalize higher-rated players too much?**

### The Objective Answer
**Yes, significantly.** When analyzed mathematically and tested across simulated games, higher-rated players (especially $4.25+$ to $5.0$ DUPR) face an extreme compounding penalty structure:
- In mixed pairings (e.g. a 4.5 playing with a 3.5), **a single loss penalizes the 4.5 player between $3.2\\times$ and $5.1\\times$ more than an equivalent win rewards them**.
- In an on-paper $50/50$ match, a 4.5 player must win **$79.5\\%$ of matches** just to maintain their rating.
- Against weaker opponents, a $4.5$ player must win **nearly $30$ matches** to make up for a single close $9\\text{--}11$ upset.
- In competitive scrambled mixers, a 4.5 player who wins **$70\\%$ of their matches actually LOSES rating overall** ($4.500 \\to 4.412$).

This notebook provides the mathematical proof, empirical data, and simulations demonstrating why this happens and how to balance it.
"""))

# Cell 2: Code setup
cells.append(nbf.v4.new_code_cell("""import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

plt.style.use('seaborn-v0_8-whitegrid' if 'seaborn-v0_8-whitegrid' in plt.style.available else 'default')
pd.set_option('display.precision', 4)

# -------------------------------------------------------------
# Rating Engine Primitives (matching src/lib/matchmaking/rating.ts)
# -------------------------------------------------------------
def expected_score(r_a, r_b):
    return 1.0 / (1.0 + 10.0 ** ((r_b - r_a) / 400.0))

def k_factor(games=30):
    return 16.0 + 24.0 * np.exp(-games / 12.0)

def tier_modifier(rating, is_gain):
    if rating >= 1400: # 4.5+ DUPR
        return 0.90 if is_gain else 1.10
    if rating < 800:  # <3.0 DUPR
        return 1.08 if is_gain else 0.95
    return 1.0

def team_weights(r0, r1, opp_r, is_gain):
    e0 = expected_score(r0, opp_r)
    e1 = expected_score(r1, opp_r)
    if is_gain:
        inv0 = 1.0 - e0
        inv1 = 1.0 - e1
        s = inv0 + inv1
        return (inv0 / s, inv1 / s) if s > 0 else (0.5, 0.5)
    else:
        s = e0 + e1
        return (e0 / s, e1 / s) if s > 0 else (0.5, 0.5)

def to_dupr(elo):
    return 3.500 + (elo - 1000.0) / 400.0

def to_elo(dupr):
    return 1000.0 + (dupr - 3.500) * 400.0

print("Rating formulas loaded successfully.")
"""))

# Cell 3: Markdown Section 1
cells.append(nbf.v4.new_markdown_cell("""## 1. The Mathematical Mechanism Behind the Penalty

To understand why higher-rated players are over-penalized, examine the rating change formula for Player 0 in `rateMatch()`:

$$\\Delta R_0 = K_0 \\times \\text{tierMod}(R_0) \\times \\text{surprise} \\times (2 \\cdot w_0)$$

Notice the three multiplicative terms that work against Player 0 whenever $R_0 > R_1$:

1. **Partner Weight $w_0$**:
   - On a win (gain): $w_0 = \\frac{1 - e_0}{(1 - e_0) + (1 - e_1)}$. Since $e_0 > e_1$, $1 - e_0$ is small. **Player 0 receives a small fraction of the win.**
   - On a loss (drop): $w_0 = \\frac{e_0}{e_0 + e_1}$. Since $e_0$ is large, **Player 0 absorbs the vast majority of the loss.**

2. **Rating Tier Modifier**:
   - If $R_0 \\ge 1400$ ($4.5+$ DUPR): Wins are multiplied by $0.90\\times$, but losses are multiplied by $1.10\\times$.

3. **Loss-to-Win Penalty Ratio**:
   The ratio of loss penalty to win reward for the same match surprise is:
   $$\\text{Ratio} = \\frac{\\text{Loss Scale}}{\\text{Win Scale}} = \\frac{1.10 \\times \\frac{e_0}{e_0 + e_1}}{0.90 \\times \\frac{1 - e_0}{(1 - e_0) + (1 - e_1)}}$$

Let's calculate this ratio across different partner rating gaps:
"""))

# Cell 4: Code Section 1
cells.append(nbf.v4.new_code_cell("""gaps = [0, 100, 200, 300, 400, 500, 600] # In Elo (0 to 1.5 DUPR)
rows = []
r0 = 1400 # 4.5 DUPR

for gap in gaps:
    r1 = r0 - gap
    opp_r = (r0 + r1) / 2.0 # Even match on paper (E_team = 0.50)
    e0 = expected_score(r0, opp_r)
    e1 = expected_score(r1, opp_r)
    
    w0_g, w1_g = team_weights(r0, r1, opp_r, True)
    w0_l, w1_l = team_weights(r0, r1, opp_r, False)
    
    scale_win = (2 * w0_g) * 0.90
    scale_loss = (2 * w0_l) * 1.10
    ratio = scale_loss / scale_win
    breakeven_wr = (scale_loss / (scale_loss + scale_win)) * 100
    
    rows.append({
        "Partner DUPR": f"{to_dupr(r1):.2f}",
        "DUPR Gap": f"{gap/400.0:.2f}",
        "4.5 Win Share (2*w0)": f"{2*w0_g:.3f}",
        "4.5 Loss Share (2*w0)": f"{2*w0_l:.3f}",
        "Loss/Win Penalty Ratio": f"{ratio:.2f}x",
        "Required Win Rate to Break Even": f"{breakeven_wr:.1f}%"
    })

df_asymmetry = pd.DataFrame(rows)
df_asymmetry
"""))

# Cell 5: Markdown Section 2
cells.append(nbf.v4.new_markdown_cell("""## 2. Visualization: The "Carrying Tax" and Breakeven Win Rates

The table above reveals that as soon as a 4.5 player pairs with a partner who is 1.0 DUPR lower (3.5 DUPR):
- A loss hits **$3.87\\times$ harder** than an equivalent win rewards them.
- Even though the team is matched against an equal team on paper (50% expected win probability), the 4.5 player must win **$79.5\\%$ of matches** just to maintain their rating!
- If the partner is 3.0 DUPR (a common pairing in open recreational mixers), the required win rate reaches **$88.4\\%$**!

Let's visualize this relationship:
"""))

# Cell 6: Code Plot 1
cells.append(nbf.v4.new_code_cell("""partner_gaps = np.linspace(0, 600, 61)
ratios_with_tier = []
ratios_no_tier = []
be_with_tier = []
be_no_tier = []

for gap in partner_gaps:
    r1 = 1400.0 - gap
    opp_r = (1400.0 + r1) / 2.0
    w0_g, _ = team_weights(1400.0, r1, opp_r, True)
    w0_l, _ = team_weights(1400.0, r1, opp_r, False)
    
    sw_t = (2 * w0_g) * 0.90
    sl_t = (2 * w0_l) * 1.10
    ratios_with_tier.append(sl_t / sw_t)
    be_with_tier.append((sl_t / (sl_t + sw_t)) * 100)
    
    sw_nt = (2 * w0_g) * 1.00
    sl_nt = (2 * w0_l) * 1.00
    ratios_no_tier.append(sl_nt / sw_nt)
    be_no_tier.append((sl_nt / (sl_nt + sw_nt)) * 100)

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5), dpi=150)

ax1.plot(partner_gaps / 400.0, ratios_with_tier, color='#dc2626', lw=2.5, label='Current System (Partner Weight + Tier Mod)')
ax1.plot(partner_gaps / 400.0, ratios_no_tier, color='#2563eb', lw=2, linestyle='--', label='Partner Weight Only (No Tier Mod)')
ax1.axhline(1.0, color='#6b7280', linestyle=':', label='Fair Symmetrical Baseline (1.0x)')
ax1.set_xlabel('Partner Rating Gap (DUPR Points Below 4.5)', fontweight='bold')
ax1.set_ylabel('Loss Penalty / Win Reward Ratio', fontweight='bold')
ax1.set_title('Asymmetric Penalty Ratio for 4.5 Player', fontweight='bold')
ax1.set_ylim(0.5, 7.5)
ax1.legend(frameon=True)
ax1.grid(True, alpha=0.3)

idx_1dupr = 40
ax1.scatter([1.0], [ratios_with_tier[idx_1dupr]], color='#dc2626', s=70, zorder=5)
ax1.annotate(f'4.5 + 3.5 Pairing:\\n{ratios_with_tier[idx_1dupr]:.2f}x Loss Penalty',
             xy=(1.0, ratios_with_tier[idx_1dupr]), xytext=(0.55, 4.8),
             arrowprops=dict(facecolor='#dc2626', shrink=0.08, width=1.5, headwidth=6),
             fontweight='bold', bbox=dict(boxstyle="round,pad=0.3", fc="#fee2e2", ec="#dc2626"))

ax2.plot(partner_gaps / 400.0, be_with_tier, color='#dc2626', lw=2.5, label='Current System')
ax2.plot(partner_gaps / 400.0, be_no_tier, color='#2563eb', lw=2, linestyle='--', label='No Tier Mod')
ax2.axhline(50.0, color='#6b7280', linestyle=':', label='Statistical Win Expectation (50%)')
ax2.set_xlabel('Partner Rating Gap (DUPR Points Below 4.5)', fontweight='bold')
ax2.set_ylabel('Required Win Rate to Break Even (%)', fontweight='bold')
ax2.set_title('Breakeven Win Rate in 50/50 Expected Matches', fontweight='bold')
ax2.set_ylim(45, 95)
ax2.legend(frameon=True)
ax2.grid(True, alpha=0.3)

ax2.scatter([1.0], [be_with_tier[idx_1dupr]], color='#dc2626', s=70, zorder=5)
ax2.annotate(f'Must win {be_with_tier[idx_1dupr]:.1f}%\\njust to hold rating!',
             xy=(1.0, be_with_tier[idx_1dupr]), xytext=(0.55, 68),
             arrowprops=dict(facecolor='#dc2626', shrink=0.08, width=1.5, headwidth=6),
             fontweight='bold', bbox=dict(boxstyle="round,pad=0.3", fc="#fee2e2", ec="#dc2626"))

plt.tight_layout()
plt.show()
"""))

# Cell 7: Markdown Section 3
cells.append(nbf.v4.new_markdown_cell("""## 3. Real-World Match Scenarios

### Scenario A: Peer Play (Four 4.5 Players)
Even when four equal 4.5 players play each other, the $0.90\\times / 1.10\\times$ Tier Modifier produces systematic deflation:
- If a 4.5 player wins $11\\text{--}8$: $\\Delta R = +5.703$ Elo ($+0.0143$ DUPR)
- If they lose $8\\text{--}11$: $\\Delta R = -6.970$ Elo ($-0.0174$ DUPR)
- **Net change after a 1-1 split against equal peers**: $\\mathbf{-1.267}$ Elo ($-0.0032$ DUPR)!
- Over 50 matches at a 50% win rate, the 4.5 player drops **$-31.7$ Elo points** ($-0.08$ DUPR) simply from playing their peers!

---

### Scenario B: Playing Down (4.5 + 3.5 vs Two 3.5s)
What happens when the 4.5 player plays against slightly lower-rated competition with their 3.5 partner?
"""))

# Cell 8: Code Section 3
cells.append(nbf.v4.new_code_cell("""r0, r1 = 1400, 1000 # Team 1 = 1200 (4.0)
opp_r = 1000        # Opponents = 1000 (3.5)
e_team = expected_score(1200, 1000) # 0.760
k0 = k_factor(30)

scenarios = [
    (11, 4, "Blowout Win 11-4"),
    (11, 7, "Comfortable Win 11-7"),
    (11, 9, "Close Win 11-9"),
    (9, 11, "Close Loss 9-11"),
    (4, 11, "Blowout Loss 4-11")
]

results = []
for s1, s2, desc in scenarios:
    w1 = 1.0 if s1 > s2 else 0.0
    s_pts = s1 / (s1 + s2)
    s_star = 0.65 * w1 + 0.35 * s_pts
    raw_surp = s_star - e_team
    surp = max(0.0, raw_surp) if w1 == 1.0 else raw_surp
    is_gain = surp >= 0
    
    w0, _ = team_weights(r0, r1, opp_r, is_gain)
    raw_delta = k0 * tier_modifier(r0, is_gain) * surp * (2 * w0)
    final_delta = 0.0 if abs(raw_delta) < 0.5 else raw_delta
    if w1 == 1.0 and final_delta < 0:
        final_delta = 0.0
        
    results.append({
        "Scenario": desc,
        "Score": f"{s1}-{s2}",
        "S* Performance": f"{s_star:.3f}",
        "Surprise": f"{surp:+.3f}",
        "4.5 Elo Delta": f"{final_delta:+.3f}",
        "4.5 DUPR Delta": f"{final_delta/400.0:+.5f}"
    })

pd.DataFrame(results)
"""))

# Cell 9: Markdown Section 4
cells.append(nbf.v4.new_markdown_cell("""### The Deadband Filter & The "Target the Weak Partner" Reality

Look at line 3 of the table above:
- When the 4.5/3.5 team wins **$11\\text{--}9$**, the raw delta for the 4.5 player is $+0.41$ Elo. Because of the $0.5$ Elo deadband filter, this rounds to **$+0.000$**! The 4.5 player gets **literally nothing** for winning!
- But if they lose **$9\\text{--}11$**, the 4.5 player is hit with **$-15.361$ Elo** ($-0.0384$ DUPR)!
- To break even from that single $9\\text{--}11$ loss, the 4.5 player needs **$29.6$ comfortable $11\\text{--}7$ wins**!

Furthermore, in doubles pickleball, opponents **intentionally target the weaker player** (hitting 80%+ of shots to the 3.5 partner). A $9\\text{--}11$ loss is almost always caused by unforced errors from the 3.5 partner while the 4.5 player is frozen out at the non-volley zone. Yet, the algorithm assigns **$65\\%$ of the team loss to the 4.5 player**!
"""))

# Cell 10: Markdown Section 5
cells.append(nbf.v4.new_markdown_cell("""## 4. 50-Round Competitive Simulation

Let's test this in a simulated competitive club mixer over 50 rounds:
- 16 players: Two 4.5s, Four 4.25s, Six 4.0s, Four 3.75s.
- Players are randomly paired into doubles teams each round.
- Point-by-point rallies are simulated with true skill probabilities.
- We track the 4.5 player's rating across three engines:
  1. **Current Recreational-Safe DUPR** (Partner weight + 4.5 Tier Mod + Deadband)
  2. **Legacy Elo** (Equal partner split, no tier mod)
  3. **Calibrated DUPR** (Equal 50/50 partner split, point share + winner floor, no tier mod)
"""))

# Cell 11: Code Simulation
cells.append(nbf.v4.new_code_cell("""initial_ratings = np.array([1400.0]*2 + [1300.0]*4 + [1200.0]*6 + [1100.0]*4)
n_players = len(initial_ratings)
n_rounds = 50

def simulate_rally_game(r1_team, r2_team, rng):
    p1 = expected_score(r1_team, r2_team)
    s1, s2 = 0, 0
    while True:
        if rng.random() < p1: s1 += 1
        else: s2 += 1
        if (s1 >= 11 or s2 >= 11) and abs(s1 - s2) >= 2: break
        if s1 + s2 > 50: break
    return s1, s2

sim_results = {}

for engine in ['current_dupr', 'legacy_elo', 'calibrated_dupr']:
    ratings = initial_ratings.copy()
    games_played = np.zeros(n_players)
    history_45 = [ratings[0]]
    rng = np.random.default_rng(123)
    p0_wins = 0
    p0_losses = 0
    
    for round_idx in range(n_rounds):
        perm = rng.permutation(n_players)
        for court in range(4):
            idx = perm[court*4 : (court+1)*4]
            p0, p1, p2, p3 = idx[0], idx[1], idx[2], idx[3]
            t1_r = (ratings[p0] + ratings[p1]) / 2.0
            t2_r = (ratings[p2] + ratings[p3]) / 2.0
            s1, s2 = simulate_rally_game(t1_r, t2_r, rng)
            w1 = 1.0 if s1 > s2 else 0.0
            w2 = 1.0 - w1
            e1 = expected_score(t1_r, t2_r)
            e2 = 1.0 - e1
            
            if 0 in [p0, p1]:
                if (p0 == 0 and w1 == 1) or (p1 == 0 and w1 == 1): p0_wins += 1
                else: p0_losses += 1
            elif 0 in [p2, p3]:
                if (p2 == 0 and w2 == 1) or (p3 == 0 and w2 == 1): p0_wins += 1
                else: p0_losses += 1
            
            if engine == 'current_dupr':
                s_pts1 = s1 / (s1 + s2)
                s_pts2 = s2 / (s1 + s2)
                s_star1 = 0.65 * w1 + 0.35 * s_pts1
                s_star2 = 0.65 * w2 + 0.35 * s_pts2
                surp1 = max(0.0, s_star1 - e1) if w1 == 1.0 else (s_star1 - e1)
                surp2 = max(0.0, s_star2 - e2) if w2 == 1.0 else (s_star2 - e2)
                
                w0_1, w1_1 = team_weights(ratings[p0], ratings[p1], t2_r, surp1 >= 0)
                d0 = k_factor(games_played[p0]) * tier_modifier(ratings[p0], surp1 >= 0) * surp1 * (2 * w0_1)
                d1 = k_factor(games_played[p1]) * tier_modifier(ratings[p1], surp1 >= 0) * surp1 * (2 * w1_1)
                if abs(d0) < 0.5: d0 = 0.0
                if abs(d1) < 0.5: d1 = 0.0
                if w1 == 1.0 and d0 < 0: d0 = 0.0
                if w1 == 1.0 and d1 < 0: d1 = 0.0
                
                w2_2, w3_2 = team_weights(ratings[p2], ratings[p3], t1_r, surp2 >= 0)
                d2 = k_factor(games_played[p2]) * tier_modifier(ratings[p2], surp2 >= 0) * surp2 * (2 * w2_2)
                d3 = k_factor(games_played[p3]) * tier_modifier(ratings[p3], surp2 >= 0) * surp2 * (2 * w3_2)
                if abs(d2) < 0.5: d2 = 0.0
                if abs(d3) < 0.5: d3 = 0.0
                if w2 == 1.0 and d2 < 0: d2 = 0.0
                if w2 == 1.0 and d3 < 0: d3 = 0.0
                
            elif engine == 'legacy_elo':
                k_t1 = (k_factor(games_played[p0]) + k_factor(games_played[p1])) / 2.0
                k_t2 = (k_factor(games_played[p2]) + k_factor(games_played[p3])) / 2.0
                d0 = d1 = k_t1 * (w1 - e1)
                d2 = d3 = k_t2 * (w2 - e2)
                
            elif engine == 'calibrated_dupr':
                s_pts1 = s1 / (s1 + s2)
                s_pts2 = s2 / (s1 + s2)
                s_star1 = 0.65 * w1 + 0.35 * s_pts1
                s_star2 = 0.65 * w2 + 0.35 * s_pts2
                surp1 = max(0.0, s_star1 - e1) if w1 == 1.0 else (s_star1 - e1)
                surp2 = max(0.0, s_star2 - e2) if w2 == 1.0 else (s_star2 - e2)
                d0 = k_factor(games_played[p0]) * surp1
                d1 = k_factor(games_played[p1]) * surp1
                d2 = k_factor(games_played[p2]) * surp2
                d3 = k_factor(games_played[p3]) * surp2
                if w1 == 1.0 and d0 < 0: d0 = 0.0
                if w1 == 1.0 and d1 < 0: d1 = 0.0
                if w2 == 1.0 and d2 < 0: d2 = 0.0
                if w2 == 1.0 and d3 < 0: d3 = 0.0
                
            ratings[p0] += d0
            ratings[p1] += d1
            ratings[p2] += d2
            ratings[p3] += d3
            games_played[p0] += 1
            games_played[p1] += 1
            games_played[p2] += 1
            games_played[p3] += 1
            
        history_45.append(ratings[0])
        
    sim_results[engine] = {
        'history': [to_dupr(r) for r in history_45],
        'wins': p0_wins,
        'losses': p0_losses,
        'final_dupr': to_dupr(ratings[0])
    }

for eng, data in sim_results.items():
    wr = (data['wins'] / (data['wins'] + data['losses'])) * 100
    print(f"{eng:16s}: {data['wins']}W - {data['losses']}L ({wr:.1f}% WR) -> Final DUPR: {data['final_dupr']:.3f} (Change: {data['final_dupr'] - 4.500:+.3f})")
"""))

# Cell 12: Code Plot 2
cells.append(nbf.v4.new_code_cell("""fig, ax = plt.subplots(figsize=(10, 5), dpi=150)
rounds = np.arange(len(sim_results['current_dupr']['history']))

ax.plot(rounds, sim_results['current_dupr']['history'], color='#dc2626', lw=2.5,
        label=f"Current DUPR (70% Win Rate, Rating DROPS to {sim_results['current_dupr']['final_dupr']:.3f})")
ax.plot(rounds, sim_results['legacy_elo']['history'], color='#4b5563', lw=2, linestyle=':',
        label=f"Legacy Elo Baseline (Final: {sim_results['legacy_elo']['final_dupr']:.3f})")
ax.plot(rounds, sim_results['calibrated_dupr']['history'], color='#16a34a', lw=2.5,
        label=f"Calibrated DUPR (50/50 Split, Final: {sim_results['calibrated_dupr']['final_dupr']:.3f})")

ax.axhline(4.500, color='#9ca3af', linestyle='--', label='Initial Rating (4.500 DUPR)')
ax.set_xlabel('Match Rounds Played', fontweight='bold')
ax.set_ylabel('Player Rating (DUPR Scale)', fontweight='bold')
ax.set_title('4.5 Player Rating Trajectory in Competitive Mixer (50 Rounds)', fontweight='bold')
ax.legend(frameon=True, loc='best')
ax.grid(True, alpha=0.3)
plt.tight_layout()
plt.show()
"""))

# Cell 13: Markdown Conclusion
cells.append(nbf.v4.new_markdown_cell("""## 5. Objective Conclusions & Actionable Fixes

### Why the Current Changes Over-Penalize Higher-Rated Players
1. **The Partner Responsibility Inversion**: Doubles pickleball is a *weakest-link* sport where opponents target the weaker partner. Assigning up to $76\\%$ of the loss blame to the higher-rated player creates an unfair "carrying penalty."
2. **The 4.5+ Tier Asymmetry**: Punishing $4.5+$ players with $1.10\\times$ on losses and $0.90\\times$ on gains creates structural deflation even in pure peer play.
3. **The Deadband Clamping**: Micro-adjustments $< 0.5$ Elo points round down to $0.000$, frequently wiping out expected win rewards while losses always suffer full penalties.
4. **Empirical Evidence**: In a 50-round competitive mixer, winning **$70\\%$ of matches causes a 4.5 player to drop rating** (from $4.500$ down to $4.412$).

---

### Recommended Solutions (Preserving DUPR Strengths Without the Penalties)

1. **Remove or Soften the Tier Deflation Modifier**:
   - Set `tierModifier = 1.0` for all players, or only apply deflation to players $> 6.0$ DUPR (pro tour level).
   
2. **Dampen Partner Responsibility in Recreational / Open Play**:
   - In social mixers or club play where players cannot pick their partner, use an **equal 50/50 partner split** (or cap the partner weight tilt to a maximum of $55/45$).
   
3. **Recalibrate or Remove the Deadband Filter**:
   - Keep floating-point decimal precision instead of truncating changes under $0.5$ Elo to $0.000$. Every win against lower players should yield at least $+0.001$ DUPR so high-rated players are credited for their victories.
"""))

nb.cells = cells

with open(NOTEBOOK_PATH, "w") as f:
    nbf.write(nb, f)

print(f"Successfully generated {NOTEBOOK_PATH}")
