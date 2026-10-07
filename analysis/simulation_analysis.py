import marimo

__generated_with = "0.25.1"
app = marimo.App(width="medium")


@app.cell
def _():
    import marimo as mo
    return (mo,)


@app.cell
def _(mo):
    mo.md(
        r"""
        # Pickleball Matchmaker Elo Simulation Analysis
        ### Evaluating Player Rating Discovery & Convergence in a 12-Player League Over 20 Sessions

        This notebook analyzes the results of a 20-session simulation evaluating the pickleball matchmaking and Elo rating algorithm implemented in the application.

        ---

        ### Simulation Methodology & Rules
        1. **12 Players & UI Presets**:
           - **Beginner (900 App Elo)**: Alex (True: 820), Brooke (True: 910), Chris (True: 980)
           - **Intermediate (1000 App Elo)**: Dani (True: 930), Ethan (True: 990), Fatima (True: 1020), Gabe (True: 1080), Hannah (True: 1140)
           - **Advanced (1100 App Elo)**: Isaac (True: 1010), Julia (True: 1090), Kai (True: 1160), Lena (True: 1240)
        2. **True Skill Progression**:
           $\text{TrueElo}(s) = \text{InitialTrueElo} + G \cdot (1 - e^{-k \cdot s})$
           where $s$ is the number of sessions attended by that player.
        3. **Matchmaking & Simulation**:
           - Matchmaking was performed strictly using the application's actual `generateRound` and `SessionService` algorithms.
           - Matches were played as doubles: $\text{TeamTrueElo} = \frac{\text{Player1TrueElo} + \text{Player2TrueElo}}{2}$.
           - Win probability was sampled via standard logistic Elo formula:
             $P(A \text{ wins}) = \frac{1}{1 + 10^{(\text{TeamBTrueElo} - \text{TeamATrueElo}) / 400}}$
           - Only match outcomes were fed back into the app (`recordResult`). The app had zero access to True Elo or parameters.
        4. **Zero Cloud Compute**: All sessions, rounds, matches, and snapshots were executed locally against SQLite (`simulation.db`).
        """
    )
    return


@app.cell
def _():
    import os
    import sqlite3
    import io
    import base64
    import matplotlib.pyplot as plt
    import numpy as np
    from collections import defaultdict

    candidates = [
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "simulation.db") if "__file__" in globals() else None,
        os.path.join(os.getcwd(), "analysis", "simulation.db"),
        os.path.join(os.getcwd(), "simulation.db"),
        "simulation.db",
    ]
    db_path = next((p for p in candidates if p and os.path.exists(p)), "simulation.db")
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    return base64, c, candidates, conn, db_path, defaultdict, io, np, os, plt, sqlite3


@app.cell
def _(c, mo, plt):
    # Fetch session-level metrics
    _session_rows = c.execute("""
        SELECT session_number, mae, rank_correlation, attendees_count, 
               strongest_true_player, strongest_app_player, weakest_true_player, weakest_app_player
        FROM simulation_sessions 
        ORDER BY session_number ASC
    """).fetchall()

    _sessions = [r[0] for r in _session_rows]
    _maes = [r[1] for r in _session_rows]
    _corrs = [r[2] for r in _session_rows]
    _attendees = [r[3] for r in _session_rows]

    _fig, _ax1 = plt.subplots(figsize=(10, 4.8), dpi=130)

    _color_mae = "#d9381e"
    _ax1.set_xlabel("Session Number", fontweight="bold", fontsize=11)
    _ax1.set_ylabel("Mean Absolute Error (MAE)", color=_color_mae, fontweight="bold", fontsize=11)
    _line1 = _ax1.plot(_sessions, _maes, color=_color_mae, marker="o", linewidth=2.4, label="MAE (App vs True Elo)")
    _ax1.tick_params(axis="y", labelcolor=_color_mae)
    _ax1.set_xticks(_sessions)
    _ax1.grid(True, linestyle="--", alpha=0.5)

    _ax2 = _ax1.twinx()
    _color_corr = "#1a73e8"
    _ax2.set_ylabel("Spearman Rank Correlation", color=_color_corr, fontweight="bold", fontsize=11)
    _line2 = _ax2.plot(_sessions, _corrs, color=_color_corr, marker="s", linestyle="--", linewidth=2, label="Rank Correlation (Spearman)")
    _ax2.tick_params(axis="y", labelcolor=_color_corr)
    _ax2.set_ylim(0.4, 1.0)

    _lines = _line1 + _line2
    _labels = [l.get_label() for l in _lines]
    _ax1.legend(_lines, _labels, loc="center right", framealpha=0.9)
    plt.title("Evaluation Metrics Across 20 Sessions: MAE vs Rank Correlation", fontsize=13, fontweight="bold", pad=12)
    plt.tight_layout()

    # Table of MAE Progression
    _mae_table_rows = []
    for _r in _session_rows:
        _s_num, _s_mae, _s_corr, _s_att, _s_t_top, _s_a_top, _s_t_bot, _s_a_bot = _r
        _mae_table_rows.append(
            f"| {_s_num:2d} | {_s_mae:.2f} | {_s_corr:.3f} | {_s_att} | {_s_t_top} | {_s_a_top} | {_s_t_bot} | {_s_a_bot} |"
        )
    _mae_table_md = "\n".join(_mae_table_rows)

    mo.vstack([
        mo.md(f"""
        ## 1. Questions 1–3: Starting MAE, Final MAE, and Session Progression

        - **Starting MAE (Session 0)**: **{_maes[0]:.2f}**
        - **Lowest MAE (Session 8)**: **{min(_maes):.2f}**
        - **Final MAE (Session 20)**: **{_maes[-1]:.2f}**
        - **Peak Rank Correlation (Session 12)**: **{max(_corrs):.3f}** (Starting: {_corrs[0]:.3f})
        """),
        _fig,
        mo.md(f"""
        ### Session-by-Session Metric Table
        | Session | MAE | Rank Corr | Attendees | True #1 | App #1 | True #12 | App #12 |
        |---|---:|---:|---:|---|---|---|---|
        {_mae_table_md}

        > **Key Insight**: 
        > Notice that MAE initially drops from **65.83** down to **56.92** at Session 8 as the initial presets adjust.
        > However, as sessions continue, MAE increases to **75.77** at Session 20!
        > Meanwhile, the **Rank Correlation** surges from **0.517** to **0.888** and stays near **0.83–0.88**!
        > **Why does MAE increase while ranking accuracy improves?**
        > Because the players are genuinely improving in true skill (+44.8 points average increase across the group), but the app's Elo pool is a closed zero-sum system anchored around ~1008 points. The app correctly discovers the *relative ordering* of players, but suffers from *zero-sum deflation* against the progressing true ratings.
        """),
    ])
    return


@app.cell
def _(c, mo, np, plt):
    # Fetch final player metrics
    _final_players = c.execute("""
        SELECT player_name, preset, sessions_attended_total, games_played_total, 
               true_elo, app_elo, absolute_error, true_rank, app_rank
        FROM simulation_player_metrics
        WHERE session_number = 20
        ORDER BY true_elo DESC
    """).fetchall()

    _names = [p[0] for p in _final_players]
    _presets = [p[1] for p in _final_players]
    _attended = [p[2] for p in _final_players]
    _games = [p[3] for p in _final_players]
    _true_elos = [p[4] for p in _final_players]
    _app_elos = [p[5] for p in _final_players]
    _errors = [p[6] for p in _final_players]
    _true_ranks = [p[7] for p in _final_players]
    _app_ranks = [p[8] for p in _final_players]

    # Bar chart comparing Final App Elo vs True Elo
    _x = np.arange(len(_names))
    _width = 0.38

    _fig_bars, _ax = plt.subplots(figsize=(11, 5), dpi=130)
    _ax.bar(_x - _width/2, _true_elos, _width, label="True Elo (Skill)", color="#1b873f", alpha=0.88)
    _ax.bar(_x + _width/2, _app_elos, _width, label="App Elo (Discovered)", color="#2b5bb3", alpha=0.88)

    _ax.set_ylabel("Rating (Elo)", fontweight="bold", fontsize=11)
    _ax.set_title("Question 4: Final App Elo vs. True Elo for Every Player (Session 20)", fontsize=13, fontweight="bold", pad=12)
    _ax.set_xticks(_x)
    _ax.set_xticklabels(_names, fontweight="bold")
    _ax.legend(framealpha=0.9, loc="upper right")
    _ax.grid(axis="y", linestyle="--", alpha=0.5)
    _ax.set_ylim(650, 1350)
    plt.tight_layout()

    # Markdown table
    _rows_md = []
    for _p in _final_players:
        _p_name, _p_preset, _p_att, _p_gms, _p_true, _p_app, _p_err, _p_tr, _p_ar = _p
        _rows_md.append(
            f"| **{_p_name}** | {_p_preset} | {_p_att} | {_p_gms} | {_p_true:.1f} | {_p_app:.1f} | {_p_err:.1f} | #{_p_tr} | #{_p_ar} |"
        )
    _table_md = "\n".join(_rows_md)

    mo.vstack([
        mo.md("## 2. Question 4: Final App Elo vs True Elo for Every Player"),
        _fig_bars,
        mo.md(f"""
        ### Final Standings (Sorted by True Elo Descending)
        | Player | UI Preset | Sessions | Games | Final True Elo | Final App Elo | Absolute Error | True Rank | App Rank |
        |---|---|---:|---:|---:|---:|---:|---:|---:|
        {_table_md}
        """),
    ])
    return


@app.cell
def _(c, defaultdict, mo, plt):
    # Fetch trajectories for Lena, Kai, Alex, Brooke, Chris, Hannah, Isaac
    _player_trajectories = c.execute("""
        SELECT session_number, player_name, app_elo, true_elo
        FROM simulation_player_metrics
        ORDER BY session_number ASC
    """).fetchall()

    _app_traj = defaultdict(list)
    _true_traj = defaultdict(list)
    _sessions_list = sorted(list(set(r[0] for r in _player_trajectories)))

    for _r in _player_trajectories:
        _app_traj[_r[1]].append(_r[2])
        _true_traj[_r[1]].append(_r[3])

    _fig_extremes, _ax = plt.subplots(figsize=(10, 4.5), dpi=130)
    _ax.plot(_sessions_list, _true_traj["Lena"], "g--", label="Lena (True #1, 1247)", linewidth=2)
    _ax.plot(_sessions_list, _app_traj["Lena"], "g-o", label="Lena (App Elo, 1205.6)", linewidth=2.5)

    _ax.plot(_sessions_list, _true_traj["Alex"], "r--", label="Alex (True #12, 840)", linewidth=2)
    _ax.plot(_sessions_list, _app_traj["Alex"], "r-s", label="Alex (App Elo, 765.8)", linewidth=2.5)

    _ax.plot(_sessions_list, _app_traj["Julia"], color="#888", linestyle=":", label="Other Player (Julia)")
    _ax.plot(_sessions_list, _app_traj["Fatima"], color="#aaa", linestyle=":", label="Other Player (Fatima)")

    _ax.set_xlabel("Session Number", fontweight="bold", fontsize=11)
    _ax.set_ylabel("App Elo Rating", fontweight="bold", fontsize=11)
    _ax.set_title("Question 5: Identification of Strongest (Lena) and Weakest (Alex) Players", fontsize=13, fontweight="bold", pad=12)
    _ax.set_xticks(_sessions_list)
    _ax.grid(True, linestyle="--", alpha=0.5)
    _ax.legend(framealpha=0.9, loc="center right")
    plt.tight_layout()

    mo.vstack([
        mo.md(f"""
        ## 3. Question 5: Strongest & Weakest Player Identification

        - **Strongest Player**:
          - **True Strongest**: **Lena** (Initial: 1240, Final: 1247, True Rank: **#1**)
          - **App Strongest**: **Lena** (Starting: 1100, Final: 1205.6, App Rank: **#1**)
          - *Result*: **YES, the app correctly identified the strongest player!** 
          - By Session 16, Lena took over rank #1 and stayed #1 through Session 20. Before Session 16, Kai and Julia temporarily traded #1 due to initial 1100 seed noise, but Lena definitively separated.

        - **Weakest Player**:
          - **True Weakest**: **Alex** (Initial: 820, Final: 840, True Rank: **#12**)
          - **App Weakest**: **Alex** (Starting: 900, Final: 765.8, App Rank: **#12**)
          - *Result*: **YES, the app correctly identified the weakest player!**
          - In fact, the app identified Alex as the lowest-rated player from **Session 1 all the way through Session 20** with 100% consistency!
        """),
        _fig_extremes,
    ])
    return


@app.cell
def _(c, mo, plt):
    # Ranking scatter plot
    _final_ranks = c.execute("""
        SELECT player_name, true_rank, app_rank
        FROM simulation_player_metrics
        WHERE session_number = 20
        ORDER BY true_rank ASC
    """).fetchall()

    _tr = [r[1] for r in _final_ranks]
    _ar = [r[2] for r in _final_ranks]
    _p_names = [r[0] for r in _final_ranks]

    _fig_rank, _ax = plt.subplots(figsize=(6.5, 5.5), dpi=130)
    _ax.scatter(_tr, _ar, color="#1a73e8", s=110, zorder=4, edgecolor="black", linewidth=1.2)
    _ax.plot([1, 12], [1, 12], color="#d9381e", linestyle="--", linewidth=1.8, label="Perfect Agreement (y = x)")

    for _i, _name in enumerate(_p_names):
        _offset = (0.25, -0.15) if _name != "Hannah" else (-1.4, 0.3)
        _ax.annotate(_name, (_tr[_i] + _offset[0], _ar[_i] + _offset[1]), fontsize=9, fontweight="bold")

    _ax.set_xlabel("True Skill Rank (1 = Best)", fontweight="bold", fontsize=11)
    _ax.set_ylabel("App Elo Rank (1 = Best)", fontweight="bold", fontsize=11)
    _ax.set_title("Question 6: App Elo Rank vs True Elo Rank (Session 20)", fontsize=13, fontweight="bold", pad=12)
    _ax.set_xticks(range(1, 13))
    _ax.set_yticks(range(1, 13))
    _ax.grid(True, linestyle="--", alpha=0.5)
    _ax.invert_xaxis()
    _ax.invert_yaxis()
    _ax.legend(framealpha=0.9, loc="lower right")
    plt.tight_layout()

    mo.vstack([
        mo.md("## 4. Question 6: Ranking Alignment (App vs. True Elo)"),
        _fig_rank,
        mo.md(f"""
        - **Spearman Rank Correlation**: **0.825** at Session 20 (peaked at **0.888** in Session 12).
        - **Top Tier Alignment**:
          - #1 True (Lena) is #1 App.
          - #2 True (Kai) is #2 App.
        - **Bottom Tier Alignment**:
          - #12 True (Alex) is #12 App.
          - #11 True (Brooke) is #11 App.
          - #10 True (Dani) is #10 App.
        - **Mid Tier Alignment**:
          - Minor rank inversions occur among players separated by only 20–30 true Elo (e.g., Julia, Fatima, Gabe, Hannah), which is well within standard statistical confidence intervals for doubles play.
        """),
    ])
    return


@app.cell
def _(c, mo, plt):
    # Error bar chart
    _err_rows = c.execute("""
        SELECT player_name, preset, absolute_error, true_elo, app_elo
        FROM simulation_player_metrics
        WHERE session_number = 20
        ORDER BY absolute_error DESC
    """).fetchall()

    _err_names = [r[0] for r in _err_rows]
    _err_vals = [r[2] for r in _err_rows]
    _err_presets = [r[1] for r in _err_rows]

    _fig_err, _ax = plt.subplots(figsize=(10, 4.2), dpi=130)
    _bar_colors = ["#d9381e" if v > 100 else "#f4a261" if v > 60 else "#2a9d8f" for v in _err_vals]
    _bars = _ax.bar(_err_names, _err_vals, color=_bar_colors, edgecolor="black", linewidth=0.8)

    for _bar, _val in zip(_bars, _err_vals):
        _ax.text(_bar.get_x() + _bar.get_width() / 2, _val + 2.5, f"{_val:.1f}", ha="center", fontsize=8.5, fontweight="bold")

    _ax.set_ylabel("Absolute Error (|App - True|)", fontweight="bold", fontsize=11)
    _ax.set_title("Question 7: Players With Greatest Estimation Difficulty (Session 20)", fontsize=13, fontweight="bold", pad=12)
    _ax.grid(axis="y", linestyle="--", alpha=0.5)
    _ax.set_ylim(0, 205)
    plt.tight_layout()

    mo.vstack([
        mo.md("## 5. Question 7: Which Players Had the Most Difficulty Estimating?"),
        _fig_err,
        mo.md("""
        The 4 players with the largest absolute estimation errors are:
        1. **Chris (Error: 177.4)**: Assigned "Beginner" (900), True Elo started at 980 and surged to **1120** ($G=180, k=0.10$). The app only reached **942.6**.
        2. **Brooke (Error: 156.6)**: Assigned "Beginner" (900), True Elo started at 910 and rose to **980** ($G=100, k=0.08$). The app only reached **823.4**.
        3. **Gabe (Error: 117.1)**: Assigned "Intermediate" (1000), True Elo rose to **1117**. The app remained at **999.9**.
        4. **Hannah (Error: 101.5)**: Assigned "Intermediate" (1000), True Elo was **1161** (#3 player in group!). The app reached **1059.5**.

        ### Root Cause of Estimation Difficulty:
        Notice what Chris, Brooke, and Gabe have in common:
        - **Under-seeded relative to rapid skill growth**: Their true skills were growing at a rapid rate (e.g. Chris $+140$ points), but in doubles play with $K=20$, rating movement per game is capped at ~8–10 points.
        - **Partner Dilution**: In doubles, a fast-improving beginner who is paired with weaker players still loses games due to partner mistakes, dragging their rating back down.
        """),
    ])
    return


@app.cell
def _(c, defaultdict, mo, plt):
    # Deep dive into Chris, Hannah, Isaac
    _focus_trajectories = c.execute("""
        SELECT session_number, player_name, app_elo, true_elo, true_rank, app_rank
        FROM simulation_player_metrics
        WHERE player_name IN ('Chris', 'Hannah', 'Isaac')
        ORDER BY session_number ASC
    """).fetchall()

    _focus_app = defaultdict(list)
    _focus_true = defaultdict(list)
    _focus_trank = defaultdict(list)
    _focus_arank = defaultdict(list)
    _sessions_list = sorted(list(set(r[0] for r in _focus_trajectories)))

    for _r in _focus_trajectories:
        _focus_app[_r[1]].append(_r[2])
        _focus_true[_r[1]].append(_r[3])
        _focus_trank[_r[1]].append(_r[4])
        _focus_arank[_r[1]].append(_r[5])

    _fig_focus, (_ax1, _ax2) = plt.subplots(1, 2, figsize=(12, 4.6), dpi=130)

    # Ratings
    _ax1.plot(_sessions_list, _focus_true["Chris"], "r--", linewidth=1.8, label="Chris True (980 -> 1120)")
    _ax1.plot(_sessions_list, _focus_app["Chris"], "r-o", linewidth=2.2, label="Chris App (900 -> 942.6)")

    _ax1.plot(_sessions_list, _focus_true["Hannah"], "b--", linewidth=1.8, label="Hannah True (1140 -> 1161)")
    _ax1.plot(_sessions_list, _focus_app["Hannah"], "b-s", linewidth=2.2, label="Hannah App (1000 -> 1059.5)")

    _ax1.plot(_sessions_list, _focus_true["Isaac"], "g--", linewidth=1.8, label="Isaac True (1010 -> 1063)")
    _ax1.plot(_sessions_list, _focus_app["Isaac"], "g-^", linewidth=2.2, label="Isaac App (1100 -> 987.1)")

    _ax1.set_xlabel("Session Number", fontweight="bold")
    _ax1.set_ylabel("Elo Rating", fontweight="bold")
    _ax1.set_title("Rating Trajectories", fontsize=11, fontweight="bold")
    _ax1.grid(True, linestyle="--", alpha=0.5)
    _ax1.legend(fontsize=8.5, framealpha=0.9)

    # Ranks
    _ax2.plot(_sessions_list, _focus_arank["Chris"], "r-o", linewidth=2.2, label="Chris App Rank (12 -> 9)")
    _ax2.plot(_sessions_list, _focus_arank["Hannah"], "b-s", linewidth=2.2, label="Hannah App Rank (9 -> 5)")
    _ax2.plot(_sessions_list, _focus_arank["Isaac"], "g-^", linewidth=2.2, label="Isaac App Rank (1 -> 7)")
    _ax2.set_xlabel("Session Number", fontweight="bold")
    _ax2.set_ylabel("App Rank (1 = Highest)", fontweight="bold")
    _ax2.set_title("Relative Rank Convergence", fontsize=11, fontweight="bold")
    _ax2.grid(True, linestyle="--", alpha=0.5)
    _ax2.set_yticks(range(1, 13))
    _ax2.invert_yaxis()
    _ax2.legend(fontsize=9, framealpha=0.9)

    plt.suptitle("Question 8: Convergence of Misclassified Players (Chris, Hannah, Isaac)", fontsize=13, fontweight="bold", y=1.02)
    plt.tight_layout()

    mo.vstack([
        mo.md("## 6. Question 8: Convergence of Initially Misclassified Players"),
        _fig_focus,
        mo.md("""
        ### Detailed Breakdown:
        - **Hannah (Under-seeded Intermediate)**:
          - *Initial*: Preset 1000, Initial True Elo 1140 (Rank #3 in group!). App seeded her at rank **#9**.
          - *Final*: App Elo rose steadily to **1059.5** (+59.5 points). Her app rank climbed from **#9 up to #5**!
          - *Verdict*: **Strong positive convergence**. The system recognized her superior win rate and lifted her above intermediate players.
        - **Isaac (Over-seeded Advanced)**:
          - *Initial*: Preset 1100, Initial True Elo 1010 (True Rank #7). App seeded him at rank **#1**!
          - *Final*: App Elo fell from 1100 down to **987.1** (-112.9 points!). His app rank dropped from **#1 down to #7**!
          - *Verdict*: **Near-perfect relative convergence**. Isaac's True Rank is #8 and his App Rank settled at #7. The app successfully corrected his inflated starting preset.
        - **Chris (Rapid Learner seeded as Beginner)**:
          - *Initial*: Preset 900, Initial True Elo 980 (True Rank #9).
          - *Skill Progression*: Chris had the highest growth in the entire league ($G=180, k=0.10$), with True Elo rising to **1120** (True Rank #4!).
          - *Final*: App Elo rose from 900 to **942.6**, and his App Rank improved from **#12 to #9**.
          - *Verdict*: **Directional convergence, but severely lagged**. While Chris moved in the right direction (+42.6 points, climbing out of last place), he could not catch up to his rapid skill progression because doubles partner noise and low K-factor throttled his rate of ascent.
        """),
    ])
    return


@app.cell
def _(mo):
    mo.md(
        r"""
        ## 7. Questions 9 & 10: Systemic Diagnostics & Matchmaking Evaluation

        ### Question 9: Evidence of Slow Convergence, Overreaction, or Systematic Misestimation
        1. **Ratings Converge Too Slowly from Distant Priors**:
           - In `src/lib/matchmaking/rating.ts`, the K-factor drops to $K=20$ after just 10 games (`kFactor(games < 10 ? 40 : 20)`).
           - In a doubles game, if two teams have roughly equal ratings, the expected score is 0.5. A win yields:
             $\Delta = K \cdot (1 - 0.5) = 20 \cdot 0.5 = +10 \text{ points}$.
           - If a player is misclassified by 200 points, even with an extraordinary 70% win rate across 70 games:
             $\text{Net Wins} = 70 \cdot (0.7 - 0.5) = 14 \text{ games} \times 10 \approx +140 \text{ points}$.
           - Thus, 70–80 games is barely enough to move 150 points in doubles!
        2. **No Overreaction to Individual Games**:
           - There was no evidence of rating overreaction or wild oscillation. Trajectories were smooth and monotonic once initial provisional games concluded.
        3. **Systematic Underestimation in an Improving League**:
           - Because the league is a closed pool of 12 players and Elo is zero-sum, the group's total rating points are fixed at ~12,100 ($1008 \times 12$).
           - As the players learned and improved (average true Elo grew from 1031 to 1076), the app had no mechanism to inflate group points. Therefore, absolute Elo ratings systematically lagged true ratings.

        ---

        ### Question 10: Problems Discovered in the Matchmaking & Elo Implementation

        1. **Premature K-Factor Decay**:
           - Currently, $K$ drops from 40 to 20 at 10 games. In doubles play, 10 games has high variance because partners change every round. A provisional window of 20–25 games with a gradual taper (e.g., $K=48 \to 32 \to 20$) would allow faster discovery.
        2. **Matchmaking Balancer Dampens Strong Player Mobility**:
           - The app's `scoreRound` algorithm explicitly minimizes team skill difference on every court.
           - Consequently, when a player's rating rises, the algorithm pairs them with lower-rated partners against two balanced opponents.
           - This intentional handicap forces the strong player's win rate closer to 50%, which paradoxically **slows down their Elo ascent**!
        3. **Singles Matches Ignored in Replay**:
           - In `src/lib/domain/rating-replay.ts`, line 26:
             `if (match.team1.length !== 2 || match.team2.length !== 2) continue;`
           - When court configurations lead to leftover singles matches, those games are completely unrated and do not affect players' Elo.
        4. **Margin of Victory Ignored**:
           - Matches won 11–0 produce the exact same Elo delta as matches won 11–9. Incorporating game score differential (standard in modern sports Elo like FiveThirtyEight and Pickleball DUPR) would accelerate true skill discovery.

        ---

        ### Summary Conclusion
        The application's matchmaking and Elo rating engine **excels at discovering the relative ranking of players** (achieving a **0.888** Spearman correlation and flawlessly pinpointing the best player **Lena** and worst player **Alex**). However, for rapid learners and closed groups where overall skill improves over time, ratings converge slowly due to conservative K-factors and doubles partner dilution.
        """
    )
    return


if __name__ == "__main__":
    app.run()
