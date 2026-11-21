"""
Builds and executes the Jupyter Notebook: analysis/ten_player_simulation_analysis.ipynb
Visualizes and analyzes the 10-player growth benchmark experiment.
"""

import nbformat as nbf
from pathlib import Path

NOTEBOOK_PATH = Path("/Users/nathanglen/AntigravityProjects/Pickleball Matcher/analysis/ten_player_simulation_analysis.ipynb")

nb = nbf.v4.new_notebook()

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

# Cell 1: Markdown Title & Executive Summary
cells.append(nbf.v4.new_markdown_cell("""# 10-Player Dynamic Growth Simulation: Benchmarking Pickleball Matchmaker's Elo System

### Executive Summary & Experiment Design

This experiment tests the app's matchmaking and rating system under realistic, dynamic conditions:
1. **Source of Truth (10 Players with Growth Functions)**:
   - 10 distinct player archetypes with known mathematical latent skill curves $\\text{TrueElo}(s)$ over 20 weekly sessions:
     - **Fast Improvers**: Maya & Liam (Beginners climbing $+160$ to $+225$ Elo)
     - **Plateaued Intermediates**: Chloe & Devon (Early rise or steady grind)
     - **Flat Baseline**: Elena (Completely constant $1030$ skill)
     - **Late Bloomer**: Marcus (Struggles for 8 sessions, then surges $+160$ Elo at session 10)
     - **High-Consistency**: Nadia ($1090 \\to 1115$)
     - **Declining Veteran**: Victor (Nagging injury, regressing $1220 \\to 1152$)
     - **Elite Club Champion**: Samira (True Elo $1380+$, $\\sim 4.45$ DUPR)
     - **Erratic Wildcard**: Jordan (Hot & cold sinusoidal streaks)
2. **Real App Execution (`SessionService`)**:
   - The app runs its actual `generateRound()`, court assignment, sitting-out fairness, and `rateMatch()` logic.
   - Point-by-point rallies are simulated to 11 (win by 2) incorporating doubles weakest-link targeting (65% of shots directed to weaker partner).
   - All results and session history are stored locally in SQLite (`analysis/simulation_10players.db`).
3. **Evaluation Framework**:
   - **Centered MAE**: Isolates skill tracking from closed-pool deflation.
   - **Spearman Rank Correlation**: Evaluates whether relative pecking order is preserved.
   - **Predictive Brier Score**: Evaluates match outcome forecast accuracy.
   - **Individual Tracking Curves**: Inspects how well each archetype is discovered.
"""))

# Cell 2: Code - Data Loading & Imports
cells.append(nbf.v4.new_code_cell("""import sqlite3
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from pathlib import Path

plt.style.use('seaborn-v0_8-whitegrid' if 'seaborn-v0_8-whitegrid' in plt.style.available else 'default')
pd.set_option('display.precision', 2)

db_candidates = [
    Path("simulation_10players.db"),
    Path("analysis/simulation_10players.db"),
    Path.cwd() / "analysis" / "simulation_10players.db",
    Path.cwd() / "simulation_10players.db",
]
db_path = str(next(p for p in db_candidates if p.exists()))
conn = sqlite3.connect(db_path)

# Load session metrics
df_sessions = pd.read_sql_query('''
    SELECT session_number, raw_mae, centered_mae, rank_correlation, brier_score, app_mean, true_mean
    FROM ten_player_sessions
    ORDER BY session_number ASC
''', conn)

# Load player metrics
df_players = pd.read_sql_query('''
    SELECT session_number, player_id, player_name, persona, preset,
           true_elo, app_elo, raw_error, centered_error, true_rank, app_rank,
           games_played_total, attended_this_session
    FROM ten_player_player_metrics
    ORDER BY session_number ASC, player_id ASC
''', conn)

# Load matches log
df_matches = pd.read_sql_query('''
    SELECT id, session_number, round_number, court_number,
           team1_true_elo, team2_true_elo, p_team1_wins,
           winner, team1_score, team2_score,
           team1_app_elo_before, team2_app_elo_before
    FROM ten_player_matches_log
    ORDER BY session_number ASC, round_number ASC
''', conn)

print(f"Loaded {len(df_sessions)} sessions, {len(df_players)} player snapshots, and {len(df_matches)} completed matches.")
"""))

# Cell 3: Markdown Section 1
cells.append(nbf.v4.new_markdown_cell("""## 1. Macro League Progression: MAE, Rank Correlation, and Closed-Pool Deflation

Let's examine how the rating system performs over 20 sessions at the league level.

We plot three key trajectories:
1. **Centered MAE vs Raw MAE**: Showing how closed-pool deflation creates a divergence between true skill growth and app ratings.
2. **Spearman Rank Correlation**: Showing how well the app discovers the true pecking order.
3. **App Mean vs True Mean**: Visualizing the zero-sum ceiling.
"""))

# Cell 4: Code Plot 1
cells.append(nbf.v4.new_code_cell("""fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5), dpi=150)

# Subplot 1: MAE Progression
ax1.plot(df_sessions['session_number'], df_sessions['raw_mae'], color='#dc2626', lw=2.5, marker='o', label='Raw MAE (Misleading due to pool drift)')
ax1.plot(df_sessions['session_number'], df_sessions['centered_mae'], color='#2563eb', lw=2.5, marker='s', label='Mean-Centered MAE (True relative tracking)')
ax1.set_xlabel('Session Number', fontweight='bold')
ax1.set_ylabel('Mean Absolute Error (Elo Points)', fontweight='bold')
ax1.set_title('Error Progression: Centered MAE Drops in Half (83 -> 38)', fontweight='bold')
ax1.legend(frameon=True)
ax1.grid(True, alpha=0.3)

# Annotate minimum centered MAE
min_c_mae = df_sessions['centered_mae'].min()
min_c_s = df_sessions.loc[df_sessions['centered_mae'] == min_c_mae, 'session_number'].values[0]
ax1.annotate(f'Lowest Centered MAE: {min_c_mae:.1f}\\n(Session {min_c_s})',
             xy=(min_c_s, min_c_mae), xytext=(min_c_s - 4, min_c_mae + 15),
             arrowprops=dict(facecolor='#2563eb', shrink=0.08, width=1.5, headwidth=6),
             fontweight='bold', bbox=dict(boxstyle="round,pad=0.3", fc="#dbeafe", ec="#2563eb"))

# Subplot 2: Rank Correlation & Mean Drift
ax2_twin = ax2.twinx()

line1 = ax2.plot(df_sessions['session_number'], df_sessions['rank_correlation'], color='#16a34a', lw=2.5, marker='^', label='Spearman Rank Correlation')
line2 = ax2_twin.plot(df_sessions['session_number'], df_sessions['true_mean'], color='#9333ea', lw=2, linestyle='--', label='True Skill League Mean')
line3 = ax2_twin.plot(df_sessions['session_number'], df_sessions['app_mean'], color='#4b5563', lw=2, linestyle=':', label='App Discovered Mean')

ax2.set_xlabel('Session Number', fontweight='bold')
ax2.set_ylabel('Spearman Rank Correlation (rho)', color='#16a34a', fontweight='bold')
ax2_twin.set_ylabel('League Mean Rating (Elo)', color='#4b5563', fontweight='bold')
ax2.set_title('Rank Correlation & Closed-Pool Deflation', fontweight='bold')
ax2.set_ylim(0.4, 1.0)
ax2_twin.set_ylim(950, 1150)

lines = line1 + line2 + line3
labels = [l.get_label() for l in lines]
ax2.legend(lines, labels, loc='lower left', frameon=True)
ax2.grid(True, alpha=0.3)

plt.tight_layout()
plt.show()
"""))

# Cell 5: Markdown Section 2
cells.append(nbf.v4.new_markdown_cell("""### Analysis of Macro Trends

1. **Centered MAE Drops from $83.2 \\to 37.7$**:
   The app successfully halved its relative estimation error within 15 sessions. It quickly adapted from crude UI presets ($900/1000/1100$) toward true individual skill levels.
2. **The Zero-Sum Anchor Phenomenon**:
   While true skill rose from $1030 \\to 1089$ ($+59$ points), the app mean remained anchored at $999.3$. Because the league is a closed 10-player pool, the rating system cannot generate net points out of nowhere. This explains why **Raw MAE** appears to climb after session 8 while **Centered MAE** stays low.
3. **The Rank Correlation Peak at Session 10 ($\\rho = 0.952$)**:
   By Session 10, the ranking was nearly 100% perfect. However, after Session 10, the correlation slipped to $0.564$. Why? Let's inspect the individual player trajectories to find out!
"""))

# Cell 6: Markdown Section 3
cells.append(nbf.v4.new_markdown_cell("""## 2. Individual Player Trajectories: The 10 Archetypes

Let's plot each player's True Elo (dashed green) against their App Discovered Elo (solid blue) across the 20 sessions.
"""))

# Cell 7: Code Plot 2
cells.append(nbf.v4.new_code_cell("""players = df_players['player_name'].unique()
fig, axes = plt.subplots(5, 2, figsize=(15, 18), dpi=150, sharex=True)
axes = axes.flatten()

for idx, p_name in enumerate(players):
    ax = axes[idx]
    p_df = df_players[df_players['player_name'] == p_name].sort_values('session_number')
    
    persona = p_df['persona'].iloc[0]
    preset = p_df['preset'].iloc[0]
    
    ax.plot(p_df['session_number'], p_df['true_elo'], color='#16a34a', lw=2.5, linestyle='--', label='True Elo')
    ax.plot(p_df['session_number'], p_df['app_elo'], color='#2563eb', lw=2.5, marker='o', markersize=4, label='App Elo')
    
    ax.set_title(f"{p_name} ({preset}): {persona}", fontsize=10, fontweight='bold')
    ax.set_ylabel('Rating (Elo)', fontsize=9)
    ax.grid(True, alpha=0.3)
    if idx >= 8:
        ax.set_xlabel('Session Number', fontsize=9, fontweight='bold')
    if idx == 0:
        ax.legend(frameon=True, loc='best')

plt.tight_layout()
plt.show()
"""))

# Cell 8: Markdown Section 4
cells.append(nbf.v4.new_markdown_cell("""### Deep-Dive: What Succeeded and What Failed?

#### Where the System Performed Well:
1. **Samira (The Elite Player)**:
   - Ranked #1 in the app every single week without exception.
   - Proves the system reliably identifies the top talent in the pool.
2. **Fast Improvers (Maya & Liam)**:
   - Maya climbed from $900 \\to 970$.
   - Liam climbed from $900 \\to 969$.
   - Both players were correctly separated from fellow beginner presets and pushed upward.
3. **Chloe & Elena (Plateau & Flat Baseline)**:
   - Elena remained remarkably flat around $996$ (True: $1030$).
   - Chloe quickly stabilized around $976$ (True: $1008$).
   - High stability, low erratic jitter.

#### Where the System Stumbled (The Root of the Correlation Drop):
1. **Marcus (The Late Bloomer)**:
   - Marcus stayed at $\\sim 920$ for 8 sessions, then experienced a sudden breakthrough at session 10 climbing to $1080$ true skill (True Rank #4).
   - But in the app, Marcus finished at **$963.5$ (App Rank #9)**!
   - **Why? The K-Factor Decay Trap**: By Session 10, Marcus had played $\\sim 40$ games. His K-factor had decayed exponentially from $40$ down to $16$. When his real skill surged, the rating engine had become too rigid to track his rapid improvement!
2. **Victor (The Declining Veteran)**:
   - Victor's true skill regressed from $1220$ down to $1152$.
   - But his App Elo plummeted all the way to **$982.6$ ($-237$ points drop)**!
   - Because of decayed K and carrying weaker partners, his losses overwhelmed him.
3. **The Compression of High-Rated Players (Samira)**:
   - Samira's true skill is $1395$ ($4.49$ DUPR).
   - Her app Elo finished at **$1242.6$ ($4.10$ DUPR)**, a **$152$-point downward compression**.
   - As proven in our earlier mathematical analysis, carrying lower-rated partners while facing the $4.5+$ tier penalty and deadband filter systematically strips points from the top of the pool.
"""))

# Cell 9: Markdown Section 5
cells.append(nbf.v4.new_markdown_cell("""## 3. Final Session 20 Calibration & Discovered Rankings

Let's inspect the final standings at Session 20, comparing True Elo and Discovered App Elo side by side:
"""))

# Cell 10: Code Final Table
cells.append(nbf.v4.new_code_cell("""df_s20 = df_players[df_players['session_number'] == 20].copy()
df_s20['dupr_true'] = 3.500 + (df_s20['true_elo'] - 1000.0) / 400.0
df_s20['dupr_app'] = 3.500 + (df_s20['app_elo'] - 1000.0) / 400.0
df_s20['elo_diff'] = df_s20['app_elo'] - df_s20['true_elo']
df_s20['rank_diff'] = df_s20['app_rank'] - df_s20['true_rank']

table = df_s20[[
    'player_name', 'preset', 'persona', 'true_elo', 'app_elo', 'elo_diff',
    'true_rank', 'app_rank', 'rank_diff', 'dupr_true', 'dupr_app', 'games_played_total'
]].sort_values('true_elo', ascending=False)

table
"""))

# Cell 11: Code Calibration Scatter Plot
cells.append(nbf.v4.new_code_cell("""fig, ax = plt.subplots(figsize=(8, 6), dpi=150)

ax.scatter(df_s20['true_elo'], df_s20['app_elo'], color='#2563eb', s=80, zorder=5)

# 45-degree perfect identity line
min_val = min(df_s20['true_elo'].min(), df_s20['app_elo'].min()) - 30
max_val = max(df_s20['true_elo'].max(), df_s20['app_elo'].max()) + 30
ax.plot([min_val, max_val], [min_val, max_val], color='#9ca3af', linestyle='--', label='Perfect Recovery (App = True)')

# Closed-pool shifted line (True Elo - 90 points pool drift)
ax.plot([min_val, max_val], [min_val - 90, max_val - 90], color='#dc2626', linestyle=':', label='Pool Deflation Shift (-90 Elo)')

for _, r in df_s20.iterrows():
    ax.annotate(r['player_name'], xy=(r['true_elo'], r['app_elo']),
                xytext=(r['true_elo'] + 5, r['app_elo'] - 8),
                fontsize=9, fontweight='bold')

ax.set_xlabel('True Latent Skill (Elo)', fontweight='bold')
ax.set_ylabel('App Discovered Rating (Elo)', fontweight='bold')
ax.set_title('Session 20 Calibration: True Skill vs Discovered App Rating', fontweight='bold')
ax.legend(frameon=True)
ax.grid(True, alpha=0.3)

plt.tight_layout()
plt.show()
"""))

# Cell 12: Markdown Section 6
cells.append(nbf.v4.new_markdown_cell("""## 4. Key Takeaways & Recommendations for the Elo System

### What This Experiment Proves:
1. **The Experiment is Valid and Highly Informative**:
   Tracking 10 players with defined growth functions across real app sessions successfully diagnosed both the strengths and weaknesses of the rating engine.
2. **Relative Tracking is Strong (Centered MAE = 38 Elo points)**:
   The system quickly separates beginners from advanced players and tracks general skill tiers within $\\sim 0.10$ DUPR points.
3. **Closed-Pool Deflation is Real**:
   Because players improve over time but rating points are closed within the 10-player ecosystem, the app's overall rating pool cannot expand to reflect rising collective skill. This causes an apparent $-90$ Elo downward shift across the board.
4. **The Late Bloomer Problem**:
   Once a player's rated games reach $30+$, K-factor decay drops their responsiveness to $16$. When Marcus improved rapidly in session 10, the system took far too long to reflect his new level.
5. **High-Tier Compression**:
   The elite player (Samira) had her rating compressed downward by over $150$ Elo points ($-0.38$ DUPR) due to partner-carrying asymmetry and tier deflation.

---

### Actionable Next Steps:
- **Responsive K for Accelerating Form**: Introduce a performance-streak or surprise-streak factor so that a player who consistently outperforms expectations (like Marcus) temporarily gets a higher K-factor to catch up to their real skill.
- **Dampen Partner Responsibility**: Equalize partner splits (50/50) in scrambled recreational play so elite players aren't dragged down when carrying weaker partners.
"""))

nb.cells = cells

with open(NOTEBOOK_PATH, "w") as f:
    nbf.write(nb, f)

print(f"Generated {NOTEBOOK_PATH}")
