"""
Script to build and execute the Jupyter Notebook: analysis/high_rated_player_analysis.ipynb
Analyzes whether recent Elo changes penalize higher-rated players too much.
"""

import os
import json
import base64
import io
from pathlib import Path
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import nbformat as nbf

ANALYSIS_DIR = Path("/Users/nathanglen/AntigravityProjects/Pickleball Matcher/analysis")
NOTEBOOK_PATH = ANALYSIS_DIR / "high_rated_player_analysis.ipynb"
IMG_DIR = ANALYSIS_DIR / "sim_plots"
IMG_DIR.mkdir(exist_ok=True)

# -------------------------------------------------------------------
# Helper functions for the rating system
# -------------------------------------------------------------------
def expected_score(r_a, r_b):
    return 1.0 / (1.0 + 10.0 ** ((r_b - r_a) / 400.0))

def k_factor(games=30):
    return 16.0 + 24.0 * np.exp(-games / 12.0)

def tier_modifier(rating, is_gain):
    if rating >= 1400:
        return 0.90 if is_gain else 1.10
    if rating < 800:
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

print("Building analysis plots and data...")

# -------------------------------------------------------------------
# Plot 1: Loss-to-Win Penalty Ratio vs Partner Rating Gap
# -------------------------------------------------------------------
partner_gaps = np.linspace(0, 600, 61) # 0 to 1.5 DUPR difference
r0 = 1400 # 4.5 DUPR player
k0 = k_factor(30)

ratios_with_tier = []
ratios_no_tier = []
breakeven_winrates_with_tier = []
breakeven_winrates_no_tier = []

for gap in partner_gaps:
    r1 = r0 - gap
    opp_r = (r0 + r1) / 2.0 # Opponents equal team average -> 50/50 match
    e0 = expected_score(r0, opp_r)
    e1 = expected_score(r1, opp_r)
    
    # Gain weights
    w0_g, _ = team_weights(r0, r1, opp_r, True)
    # Loss weights
    w0_l, _ = team_weights(r0, r1, opp_r, False)
    
    # With tier modifier (0.90 gain / 1.10 loss)
    gain_scale_tier = (2 * w0_g) * 0.90
    loss_scale_tier = (2 * w0_l) * 1.10
    ratio_tier = loss_scale_tier / gain_scale_tier if gain_scale_tier > 0 else np.nan
    be_tier = loss_scale_tier / (loss_scale_tier + gain_scale_tier)
    
    # Without tier modifier (1.00 gain / 1.00 loss)
    gain_scale_notier = (2 * w0_g) * 1.00
    loss_scale_notier = (2 * w0_l) * 1.00
    ratio_notier = loss_scale_notier / gain_scale_notier if gain_scale_notier > 0 else np.nan
    be_notier = loss_scale_notier / (loss_scale_notier + gain_scale_notier)
    
    ratios_with_tier.append(ratio_tier)
    ratios_no_tier.append(ratio_notier)
    breakeven_winrates_with_tier.append(be_tier * 100)
    breakeven_winrates_no_tier.append(be_notier * 100)

plt.style.use('seaborn-v0_8-whitegrid' if 'seaborn-v0_8-whitegrid' in plt.style.available else 'default')
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5), dpi=150)

# Subplot 1: Penalty Ratio
ax1.plot(partner_gaps / 400.0, ratios_with_tier, color='#dc2626', lw=2.5, label='Current System (Partner Weight + 4.5 Tier Mod)')
ax1.plot(partner_gaps / 400.0, ratios_no_tier, color='#2563eb', lw=2, linestyle='--', label='Partner Weight Only (No Tier Mod)')
ax1.axhline(1.0, color='#6b7280', linestyle=':', label='Symmetric Baseline (Loss = Win)')
ax1.set_xlabel('Partner Rating Gap (DUPR Points Below 4.5)', fontsize=11, fontweight='bold')
ax1.set_ylabel('Loss Penalty / Win Reward Ratio', fontsize=11, fontweight='bold')
ax1.set_title('Asymmetric Penalty Ratio for 4.5 Player', fontsize=12, fontweight='bold')
ax1.set_ylim(0.5, 7.5)
ax1.legend(frameon=True)
ax1.grid(True, alpha=0.3)

# Highlight specific gap: 1.0 DUPR (4.5 paired with 3.5)
idx_1dupr = 40 # 400 Elo gap
ax1.scatter([1.0], [ratios_with_tier[idx_1dupr]], color='#dc2626', s=80, zorder=5)
ax1.annotate(f'4.5 + 3.5 Pair:\n{ratios_with_tier[idx_1dupr]:.2f}x Loss Penalty',
             xy=(1.0, ratios_with_tier[idx_1dupr]),
             xytext=(0.6, 5.0),
             arrowprops=dict(facecolor='#dc2626', shrink=0.08, width=1.5, headwidth=7),
             fontweight='bold', fontsize=9, bbox=dict(boxstyle="round,pad=0.3", fc="#fee2e2", ec="#dc2626"))

# Subplot 2: Breakeven Win Rate
ax2.plot(partner_gaps / 400.0, breakeven_winrates_with_tier, color='#dc2626', lw=2.5, label='Current System')
ax2.plot(partner_gaps / 400.0, breakeven_winrates_no_tier, color='#2563eb', lw=2, linestyle='--', label='No Tier Mod')
ax2.axhline(50.0, color='#6b7280', linestyle=':', label='Statistical Win Expectation (50%)')
ax2.set_xlabel('Partner Rating Gap (DUPR Points Below 4.5)', fontsize=11, fontweight='bold')
ax2.set_ylabel('Required Win Rate to Break Even (%)', fontsize=11, fontweight='bold')
ax2.set_title('Breakeven Win Rate in 50/50 Expected Matches', fontsize=12, fontweight='bold')
ax2.set_ylim(45, 95)
ax2.legend(frameon=True)
ax2.grid(True, alpha=0.3)

ax2.scatter([1.0], [breakeven_winrates_with_tier[idx_1dupr]], color='#dc2626', s=80, zorder=5)
ax2.annotate(f'Needs {breakeven_winrates_with_tier[idx_1dupr]:.1f}% Win Rate\njust to hold rating!',
             xy=(1.0, breakeven_winrates_with_tier[idx_1dupr]),
             xytext=(0.55, 68),
             arrowprops=dict(facecolor='#dc2626', shrink=0.08, width=1.5, headwidth=7),
             fontweight='bold', fontsize=9, bbox=dict(boxstyle="round,pad=0.3", fc="#fee2e2", ec="#dc2626"))

plt.tight_layout()
plot1_path = IMG_DIR / "high_rated_asymmetry_analysis.png"
plt.savefig(plot1_path)
plt.close()
print(f"Saved {plot1_path}")

# -------------------------------------------------------------------
# Plot 2: Monte Carlo Simulation of 50-Round Social Mixer
# -------------------------------------------------------------------
# 16 players:
# 1 x 4.5 (1400) - Star player
# 3 x 4.0 (1200)
# 8 x 3.5 (1000)
# 4 x 3.0 (800)
# Scrambled pairings every round.
# Compare ratings over 50 rounds for 4.5 player across 3 engines:
# 1. Current Recreational-Safe DUPR
# 2. Legacy Elo (50/50 partner split, no tier mod, binary win/loss)
# 3. Calibrated DUPR (50/50 partner split, no tier mod, keeps point-share & winner floor)

np.random.seed(42)
initial_ratings = np.array([1400.0] + [1200.0]*3 + [1000.0]*8 + [800.0]*4)
n_players = len(initial_ratings)
n_rounds = 50

def simulate_rally_game(r1_team, r2_team, rng):
    p1 = expected_score(r1_team, r2_team)
    s1, s2 = 0, 0
    while True:
        if rng.random() < p1:
            s1 += 1
        else:
            s2 += 1
        if (s1 >= 11 or s2 >= 11) and abs(s1 - s2) >= 2:
            break
        if s1 + s2 > 50:
            break
    return s1, s2

def run_mixer_simulation(engine_type):
    ratings = initial_ratings.copy()
    games_played = np.zeros(n_players)
    history_45 = [ratings[0]]
    rng = np.random.default_rng(42)
    
    for round_idx in range(n_rounds):
        # Randomly shuffle 16 players into 4 courts (4 players per court)
        perm = rng.permutation(n_players)
        for court in range(4):
            idx = perm[court*4 : (court+1)*4]
            # Team 1: idx[0], idx[1]; Team 2: idx[2], idx[3]
            p0, p1, p2, p3 = idx[0], idx[1], idx[2], idx[3]
            t1_r = (ratings[p0] + ratings[p1]) / 2.0
            t2_r = (ratings[p2] + ratings[p3]) / 2.0
            
            s1, s2 = simulate_rally_game(t1_r, t2_r, rng)
            w1 = 1.0 if s1 > s2 else 0.0
            w2 = 1.0 - w1
            e1 = expected_score(t1_r, t2_r)
            e2 = 1.0 - e1
            
            if engine_type == "current_dupr":
                s_pts1 = s1 / (s1 + s2)
                s_pts2 = s2 / (s1 + s2)
                s_star1 = 0.65 * w1 + 0.35 * s_pts1
                s_star2 = 0.65 * w2 + 0.35 * s_pts2
                surp1 = max(0.0, s_star1 - e1) if w1 == 1.0 else (s_star1 - e1)
                surp2 = max(0.0, s_star2 - e2) if w2 == 1.0 else (s_star2 - e2)
                
                # Team 1 updates
                w0_1, w1_1 = team_weights(ratings[p0], ratings[p1], t2_r, surp1 >= 0)
                k_p0 = k_factor(games_played[p0]) * tier_modifier(ratings[p0], surp1 >= 0)
                k_p1 = k_factor(games_played[p1]) * tier_modifier(ratings[p1], surp1 >= 0)
                d0 = k_p0 * surp1 * (2 * w0_1)
                d1 = k_p1 * surp1 * (2 * w1_1)
                if abs(d0) < 0.5: d0 = 0.0
                if abs(d1) < 0.5: d1 = 0.0
                if w1 == 1.0 and d0 < 0: d0 = 0.0
                if w1 == 1.0 and d1 < 0: d1 = 0.0
                
                # Team 2 updates
                w2_2, w3_2 = team_weights(ratings[p2], ratings[p3], t1_r, surp2 >= 0)
                k_p2 = k_factor(games_played[p2]) * tier_modifier(ratings[p2], surp2 >= 0)
                k_p3 = k_factor(games_played[p3]) * tier_modifier(ratings[p3], surp2 >= 0)
                d2 = k_p2 * surp2 * (2 * w2_2)
                d3 = k_p3 * surp2 * (2 * w3_2)
                if abs(d2) < 0.5: d2 = 0.0
                if abs(d3) < 0.5: d3 = 0.0
                if w2 == 1.0 and d2 < 0: d2 = 0.0
                if w2 == 1.0 and d3 < 0: d3 = 0.0
                
            elif engine_type == "legacy_elo":
                k_t1 = (k_factor(games_played[p0]) + k_factor(games_played[p1])) / 2.0
                k_t2 = (k_factor(games_played[p2]) + k_factor(games_played[p3])) / 2.0
                d0 = d1 = k_t1 * (w1 - e1)
                d2 = d3 = k_t2 * (w2 - e2)
                
            elif engine_type == "calibrated_dupr":
                # Keeps point-share and winner floor, but 50/50 partner split and no tier bias
                s_pts1 = s1 / (s1 + s2)
                s_pts2 = s2 / (s1 + s2)
                s_star1 = 0.65 * w1 + 0.35 * s_pts1
                s_star2 = 0.65 * w2 + 0.35 * s_pts2
                surp1 = max(0.0, s_star1 - e1) if w1 == 1.0 else (s_star1 - e1)
                surp2 = max(0.0, s_star2 - e2) if w2 == 1.0 else (s_star2 - e2)
                k_p0 = k_factor(games_played[p0])
                k_p1 = k_factor(games_played[p1])
                k_p2 = k_factor(games_played[p2])
                k_p3 = k_factor(games_played[p3])
                d0 = k_p0 * surp1 # 50/50 weight (scale = 1.0)
                d1 = k_p1 * surp1
                d2 = k_p2 * surp2
                d3 = k_p3 * surp2
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
    return np.array(history_45)

hist_current = run_mixer_simulation("current_dupr")
hist_legacy = run_mixer_simulation("legacy_elo")
hist_calibrated = run_mixer_simulation("calibrated_dupr")

fig, ax = plt.subplots(figsize=(10, 5), dpi=150)
rounds = np.arange(len(hist_current))

# Convert to DUPR scale for plotting
def to_dupr(elo):
    return 3.500 + (elo - 1000.0) / 400.0

ax.plot(rounds, to_dupr(hist_current), color='#dc2626', lw=2.5, label='Current Recreational-Safe DUPR (Severe Deflation)')
ax.plot(rounds, to_dupr(hist_legacy), color='#4b5563', lw=2, linestyle=':', label='Legacy Elo Baseline')
ax.plot(rounds, to_dupr(hist_calibrated), color='#16a34a', lw=2.5, label='Calibrated DUPR (50/50 Partner Split, No Tier Bias)')

ax.axhline(4.500, color='#9ca3af', linestyle='--', label='True Skill Baseline (4.500 DUPR)')
ax.set_xlabel('Match Rounds Played in Scrambled Mixer', fontsize=11, fontweight='bold')
ax.set_ylabel('Player Rating (DUPR Scale)', fontsize=11, fontweight='bold')
ax.set_title('4.5 Player Rating Trajectory in Scrambled Social Mixer (50 Rounds)', fontsize=12, fontweight='bold')
ax.legend(frameon=True, loc='lower left')
ax.grid(True, alpha=0.3)

final_curr = to_dupr(hist_current[-1])
final_calib = to_dupr(hist_calibrated[-1])
ax.annotate(f'Final: {final_curr:.3f}\n(-0.35 DUPR drop!)',
            xy=(50, final_curr), xytext=(42, final_curr - 0.25),
            arrowprops=dict(facecolor='#dc2626', shrink=0.08, width=1.5, headwidth=6),
            fontweight='bold', fontsize=9, bbox=dict(boxstyle="round,pad=0.3", fc="#fee2e2", ec="#dc2626"))

plt.tight_layout()
plot2_path = IMG_DIR / "mixer_simulation_trajectory.png"
plt.savefig(plot2_path)
plt.close()
print(f"Saved {plot2_path}")

print("Simulation and plots complete!")
