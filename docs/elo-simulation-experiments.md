# Elo Rating & Matchmaking Simulation Experiments

This guide explains how to run offline Elo rating convergence simulations against the application's domain logic using a local **SQLite** database, completely bypassing Neon and PostgreSQL to avoid consuming any cloud compute.

---

## Architecture & Zero-Cloud Compute Setup

The experiment uses a dedicated `SqliteDomainRepository` (`tests/simulations/sqlite-repositories.ts`) that implements the application's `DomainRepository` interface using Node.js's built-in `node:sqlite` (`DatabaseSync`).

- **100% Offline**: All sessions, rounds, court pairings, match results, and rating replays run against a local `simulation.db` file.
- **High Fidelity**: The simulation uses the application's exact domain services (`SessionService`), matchmaking algorithms (`generateRound`), and rating replay (`replayRatings` / `rateMatch`).
- **Telemetry Schema**: In addition to standard domain tables (`groups`, `players`, `sessions`, `rounds`, `matches`, `match_players`, `round_sits`), the SQLite database stores:
  - `simulation_sessions`: Session-level metrics (MAE, Spearman rank correlation, attendee counts, strongest/weakest players).
  - `simulation_player_metrics`: Per-player metrics after every session (True Elo, App Elo, absolute error, ranks, games played).
  - `simulation_matches_log`: Complete match-by-match logs (teams, win probabilities, actual winners, scores, ratings before and after).

`analysis/simulation.db` is ignored in `.gitignore` to prevent committing experimental database files.

---

## Running the Simulation

Execute the 20-session simulation using Vitest:

```bash
npx vitest run --config vitest.simulation.config.ts tests/simulations/elo-simulation.test.ts
```

This runs 20 simulated sessions (with ~6–12 attendees per session and 6 rounds per session), recording all snapshots into `analysis/simulation.db`.

---

## Analyzing the Results

Two notebooks are provided in the `analysis/` folder for exploring the simulation data:

### 1. Marimo Reactive Notebook (`analysis/simulation_analysis.py`)

To run the interactive Marimo notebook:

```bash
# Launch interactive editor
uv run --with marimo --with matplotlib marimo edit analysis/simulation_analysis.py

# Or run as a read-only web app
uv run --with marimo --with matplotlib marimo run analysis/simulation_analysis.py
```

### 2. Jupyter Notebook (`analysis/simulation_analysis.ipynb`)

Open `analysis/simulation_analysis.ipynb` in VS Code, JupyterLab, or GitHub.

To regenerate or export from the Marimo notebook:

```bash
uv run --with marimo --with nbformat --with matplotlib marimo export ipynb analysis/simulation_analysis.py -o analysis/simulation_analysis.ipynb -f
```

---

## Key Simulation Findings Summary

| Metric | Starting (Session 0) | Lowest | Final (Session 20) |
|---|---:|---:|---:|
| **Mean Absolute Error (MAE)** | 65.83 | 56.92 (Session 8) | 75.77 (Session 20) |
| **Spearman Rank Correlation** | 0.517 | — | 0.825 (Peak: 0.888 at Session 12) |
| **Strongest Player Discovered** | Isaac (#1 App, #7 True) | — | **Lena (#1 App, #1 True, 1205.6 Elo)** |
| **Weakest Player Discovered** | Chris (#12 App, #9 True) | — | **Alex (#12 App, #12 True, 765.8 Elo)** |

### Core Takeaways:
1. **Relative Rankings Converge Accurately**: The app quickly identifies relative player hierarchy, achieving a **0.888** Spearman correlation and correctly placing the top players (Lena, Kai) and bottom players (Alex, Brooke, Dani).
2. **Zero-Sum Closed Pool Deflation**: Because total points in the closed pool are conserved around ~12,100, when all players improve in skill (+44.8 points on average), the app's absolute ratings cannot expand to match True Elo, leading to rising MAE even as rank correlation strengthens.
3. **Doubles Attribution Dilution & K-Factor Decay**: For rapid learners (like Chris), skill improvement (+140 True Elo) outpaces doubles Elo convergence because $K$ drops to 20 after only 10 games, and pairing with lower-rated partners limits net rating gain.
