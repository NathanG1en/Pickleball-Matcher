import os
import sqlite3

db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "simulation.db")
conn = sqlite3.connect(db_path)
c = conn.cursor()

print("--- 1. MAE & Correlation Progression ---")
rows = c.execute("SELECT session_number, mae, rank_correlation, attendees_count, strongest_true_player, strongest_app_player, weakest_true_player, weakest_app_player FROM simulation_sessions ORDER BY session_number").fetchall()
for r in rows:
    print(f"Session {r[0]:2d}: MAE = {r[1]:6.2f} | Rank Corr = {r[2]:6.3f} | Attendees = {r[3]:2d} | Top True: {r[4]:5s} / App: {r[5]:5s} | Bot True: {r[6]:5s} / App: {r[7]:5s}")

print("\n--- Final Player Standings (Session 20) ---")
players = c.execute("""
    SELECT player_name, preset, sessions_attended_total, games_played_total, true_elo, app_elo, absolute_error, true_rank, app_rank
    FROM simulation_player_metrics
    WHERE session_number = 20
    ORDER BY true_elo DESC
""").fetchall()

header = f"{'Player':8s} | {'Preset':12s} | {'Att':3s} | {'Gms':3s} | {'True Elo':8s} | {'App Elo':8s} | {'Error':6s} | {'True Rk':7s} | {'App Rk':6s}"
print(header)
print("-" * len(header))
for p in players:
    print(f"{p[0]:8s} | {p[1]:12s} | {p[2]:3d} | {p[3]:3d} | {p[4]:8.1f} | {p[5]:8.1f} | {p[6]:6.1f} | {p[7]:7d} | {p[8]:6d}")

print("\n--- Initial vs Final Comparison for Key Misclassified Players ---")
misclassified = ["Chris", "Hannah", "Isaac"]
for name in misclassified:
    row0 = c.execute("SELECT true_elo, app_elo, absolute_error, true_rank, app_rank FROM simulation_player_metrics WHERE session_number = 0 AND player_name = ?", (name,)).fetchone()
    row20 = c.execute("SELECT true_elo, app_elo, absolute_error, true_rank, app_rank FROM simulation_player_metrics WHERE session_number = 20 AND player_name = ?", (name,)).fetchone()
    print(f"{name:8s}: Session 0 -> True={row0[0]:.0f}, App={row0[1]:.0f}, Err={row0[2]:.0f}, TrueRk={row0[3]}, AppRk={row0[4]}")
    print(f"          Session 20 -> True={row20[0]:.0f}, App={row20[1]:.1f}, Err={row20[2]:.1f}, TrueRk={row20[3]}, AppRk={row20[4]}")
