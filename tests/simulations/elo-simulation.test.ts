import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { SessionService } from "@/lib/domain/session-service";
import { SqliteDomainRepository } from "./sqlite-repositories";

export interface PlayerSimulationConfig {
  readonly id: string;
  readonly name: string;
  readonly preset: "Beginner" | "Intermediate" | "Advanced";
  readonly startingAppElo: number;
  readonly initialTrueElo: number;
  readonly G: number;
  readonly k: number;
}

export const TEST_ROSTER: readonly PlayerSimulationConfig[] = [
  { id: "player-alex", name: "Alex", preset: "Beginner", startingAppElo: 900, initialTrueElo: 820, G: 40, k: 0.05 },
  { id: "player-brooke", name: "Brooke", preset: "Beginner", startingAppElo: 900, initialTrueElo: 910, G: 100, k: 0.08 },
  { id: "player-chris", name: "Chris", preset: "Beginner", startingAppElo: 900, initialTrueElo: 980, G: 180, k: 0.10 },
  { id: "player-dani", name: "Dani", preset: "Intermediate", startingAppElo: 1000, initialTrueElo: 930, G: 80, k: 0.07 },
  { id: "player-ethan", name: "Ethan", preset: "Intermediate", startingAppElo: 1000, initialTrueElo: 990, G: 70, k: 0.06 },
  { id: "player-fatima", name: "Fatima", preset: "Intermediate", startingAppElo: 1000, initialTrueElo: 1020, G: 110, k: 0.07 },
  { id: "player-gabe", name: "Gabe", preset: "Intermediate", startingAppElo: 1000, initialTrueElo: 1080, G: 70, k: 0.05 },
  { id: "player-hannah", name: "Hannah", preset: "Intermediate", startingAppElo: 1000, initialTrueElo: 1140, G: 50, k: 0.04 },
  { id: "player-isaac", name: "Isaac", preset: "Advanced", startingAppElo: 1100, initialTrueElo: 1010, G: 90, k: 0.06 },
  { id: "player-julia", name: "Julia", preset: "Advanced", startingAppElo: 1100, initialTrueElo: 1090, G: 50, k: 0.04 },
  { id: "player-kai", name: "Kai", preset: "Advanced", startingAppElo: 1100, initialTrueElo: 1160, G: 30, k: 0.03 },
  { id: "player-lena", name: "Lena", preset: "Advanced", startingAppElo: 1100, initialTrueElo: 1240, G: 20, k: 0.03 },
];

export function computeTrueElo(config: PlayerSimulationConfig, sessionsAttended: number): number {
  return Math.round(config.initialTrueElo + config.G * (1 - Math.exp(-config.k * sessionsAttended)));
}

// PRNG for determinism
class Mulberry32 {
  private state: number;
  constructor(seed: number) {
    this.state = seed >>> 0;
  }
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
}

export function calculateSpearman(ranksA: number[], ranksB: number[]): number {
  const n = ranksA.length;
  if (n <= 1) return 1;
  let d2Sum = 0;
  for (let i = 0; i < n; i++) {
    const diff = ranksA[i] - ranksB[i];
    d2Sum += diff * diff;
  }
  return 1 - (6 * d2Sum) / (n * (n * n - 1));
}

describe("Pickleball Elo Simulation Test", () => {
  it("simulates 20 sessions and evaluates Elo discovery over time", async () => {
    const analysisDir = path.resolve(process.cwd(), "analysis");
    if (!fs.existsSync(analysisDir)) {
      fs.mkdirSync(analysisDir, { recursive: true });
    }
    const dbPath = path.resolve(analysisDir, "simulation.db");
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }

    const db = new DatabaseSync(dbPath);
    const repository = new SqliteDomainRepository(db);

    const prng = new Mulberry32(20261006);

    let idCounter = 0;
    let seedCounter = 1000;
    const service = new SessionService(repository, {
      now: () => new Date("2026-10-06T12:00:00Z"),
      nextId: (kind) => `${kind}-${++idCounter}`,
      nextSeed: () => ++seedCounter,
    });

    const groupId = "sim-group-1";
    await repository.insertGroup({
      id: groupId,
      name: "Pickleball Simulation League",
      organizerPinHash: "sim-pin-hash",
      createdAt: new Date("2026-10-06T09:00:00Z"),
    });

    // Create 12 players with UI preset initial ratings
    for (const player of TEST_ROSTER) {
      await repository.createPlayer({
        id: player.id,
        groupId,
        name: player.name,
        initialRating: player.startingAppElo,
        rating: player.startingAppElo,
        ratedGamesPlayed: 0,
        active: true,
      });
    }

    const sessionsAttended = new Map<string, number>();
    for (const player of TEST_ROSTER) {
      sessionsAttended.set(player.id, 0);
    }

    // Record Session 0 Baseline
    const baselineErrors = TEST_ROSTER.map((p) => Math.abs(p.startingAppElo - p.initialTrueElo));
    const startingMAE = baselineErrors.reduce((a, b) => a + b, 0) / baselineErrors.length;

    // Ranks for Session 0
    const sortedTrue0 = [...TEST_ROSTER].sort((a, b) => b.initialTrueElo - a.initialTrueElo);
    const sortedApp0 = [...TEST_ROSTER].sort((a, b) => b.startingAppElo - a.startingAppElo || a.name.localeCompare(b.name));
    const trueRank0 = new Map<string, number>();
    const appRank0 = new Map<string, number>();
    sortedTrue0.forEach((p, idx) => trueRank0.set(p.id, idx + 1));
    sortedApp0.forEach((p, idx) => appRank0.set(p.id, idx + 1));

    const spearman0 = calculateSpearman(
      TEST_ROSTER.map((p) => trueRank0.get(p.id)!),
      TEST_ROSTER.map((p) => appRank0.get(p.id)!),
    );

    db.prepare(`
      INSERT INTO simulation_sessions (
        session_number, session_id, attendees_count, attendee_names, court_count, round_count,
        mae, strongest_true_player, strongest_app_player, weakest_true_player, weakest_app_player, rank_correlation
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      0,
      "session-0",
      12,
      TEST_ROSTER.map((p) => p.name).join(", "),
      0,
      0,
      startingMAE,
      sortedTrue0[0].name,
      sortedApp0[0].name,
      sortedTrue0[sortedTrue0.length - 1].name,
      sortedApp0[sortedApp0.length - 1].name,
      spearman0,
    );

    for (const p of TEST_ROSTER) {
      db.prepare(`
        INSERT INTO simulation_player_metrics (
          session_number, player_id, player_name, preset, attended_this_session,
          sessions_attended_total, games_played_total, true_elo, app_elo, absolute_error, true_rank, app_rank
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        0,
        p.id,
        p.name,
        p.preset,
        0,
        0,
        0,
        p.initialTrueElo,
        p.startingAppElo,
        Math.abs(p.startingAppElo - p.initialTrueElo),
        trueRank0.get(p.id)!,
        appRank0.get(p.id)!,
      );
    }

    const sessionMaes: number[] = [startingMAE];

    // Simulate 20 sessions
    for (let sessionNum = 1; sessionNum <= 20; sessionNum++) {
      // 1. Select attendance (between 6 and 12 players, roughly 8-10 target)
      // Balance attendance to ensure all players receive a reasonable number of games across 20 sessions
      const targetCount = prng.range(8, 10);
      
      // Sort players by attendance count ascending + small jitter to prioritize those with fewer sessions
      const candidates = [...TEST_ROSTER].map((p) => ({
        player: p,
        attended: sessionsAttended.get(p.id)!,
        score: sessionsAttended.get(p.id)! + prng.next() * 1.5,
      }));
      candidates.sort((a, b) => a.score - b.score);

      const attendingPlayers = candidates.slice(0, targetCount).map((c) => c.player);
      const attendingPlayerIds = attendingPlayers.map((p) => p.id);
      const attendingSet = new Set(attendingPlayerIds);

      // Increment sessions attended for this session
      for (const p of attendingPlayers) {
        sessionsAttended.set(p.id, sessionsAttended.get(p.id)! + 1);
      }

      // Compute current True Elo for all players at this session
      const currentTrueElo = new Map<string, number>();
      for (const p of TEST_ROSTER) {
        currentTrueElo.set(p.id, computeTrueElo(p, sessionsAttended.get(p.id)!));
      }

      // Determine court count (all doubles)
      const courtCount = Math.floor(attendingPlayers.length / 4);

      // Start session in app
      const session = await service.startSession({
        groupId,
        courtCount,
        playerIds: attendingPlayerIds,
      });

      // Simulate 6 rounds per session
      const roundsPerSession = 6;
      for (let roundNum = 1; roundNum <= roundsPerSession; roundNum++) {
        const roundSeed = sessionNum * 1000 + roundNum * 10;
        const proposal = await service.proposeRound(session.id, roundSeed);
        const round = await service.startRound(session.id, proposal);

        const startedRounds = await repository.listStartedRounds(session.id);
        const currentRoundRecord = startedRounds.find((r) => r.round.id === round.id)!;

        // Simulate each match in the round
        for (const match of currentRoundRecord.matches) {
          const matchPlayers = currentRoundRecord.matchPlayers.filter((mp) => mp.matchId === match.id);
          const team1Ids = matchPlayers.filter((mp) => mp.team === 1).map((mp) => mp.playerId);
          const team2Ids = matchPlayers.filter((mp) => mp.team === 2).map((mp) => mp.playerId);

          if (team1Ids.length !== 2 || team2Ids.length !== 2) {
            continue;
          }

          const t1_p1_true = currentTrueElo.get(team1Ids[0])!;
          const t1_p2_true = currentTrueElo.get(team1Ids[1])!;
          const t2_p1_true = currentTrueElo.get(team2Ids[0])!;
          const t2_p2_true = currentTrueElo.get(team2Ids[1])!;

          const team1TrueElo = (t1_p1_true + t1_p2_true) / 2;
          const team2TrueElo = (t2_p1_true + t2_p2_true) / 2;

          // Win probability from True Elo
          const pTeam1Wins = 1 / (1 + Math.pow(10, (team2TrueElo - team1TrueElo) / 400));
          const team1Won = prng.next() < pTeam1Wins;

          const team1Score = team1Won ? 11 : prng.range(6, 9);
          const team2Score = team1Won ? prng.range(6, 9) : 11;

          // App ratings before match (for logging)
          const allPlayers = await repository.listPlayers(groupId);
          const pMap = new Map(allPlayers.map((p) => [p.id, p.rating]));
          const t1AppEloBefore = (pMap.get(team1Ids[0])! + pMap.get(team1Ids[1])!) / 2;
          const t2AppEloBefore = (pMap.get(team2Ids[0])! + pMap.get(team2Ids[1])!) / 2;

          // Record match outcome back to application
          await service.recordResult({
            matchId: match.id,
            team1Score,
            team2Score,
          });

          // Log match to SQLite
          db.prepare(`
            INSERT INTO simulation_matches_log (
              id, session_number, round_number, court_number,
              team1_p1, team1_p2, team2_p1, team2_p2,
              team1_true_elo, team2_true_elo, p_team1_wins,
              winner, team1_score, team2_score,
              team1_app_elo_before, team2_app_elo_before
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            match.id,
            sessionNum,
            roundNum,
            match.courtNumber,
            team1Ids[0],
            team1Ids[1],
            team2Ids[0],
            team2Ids[1],
            team1TrueElo,
            team2TrueElo,
            pTeam1Wins,
            team1Won ? 1 : 2,
            team1Score,
            team2Score,
            t1AppEloBefore,
            t2AppEloBefore,
          );
        }

        await service.completeRound(round.id);
      }

      await service.endSession(session.id);

      // Record metrics after session
      const currentPlayers = await repository.listPlayers(groupId);
      const appEloMap = new Map(currentPlayers.map((p) => [p.id, p.rating]));
      const gamesMap = new Map(currentPlayers.map((p) => [p.id, p.ratedGamesPlayed]));

      const absErrors: number[] = [];
      for (const p of TEST_ROSTER) {
        const trueVal = currentTrueElo.get(p.id)!;
        const appVal = appEloMap.get(p.id)!;
        absErrors.push(Math.abs(appVal - trueVal));
      }
      const sessionMae = absErrors.reduce((a, b) => a + b, 0) / absErrors.length;
      sessionMaes.push(sessionMae);

      // Rankings
      const sortedTrue = [...TEST_ROSTER].sort((a, b) => currentTrueElo.get(b.id)! - currentTrueElo.get(a.id)!);
      const sortedApp = [...TEST_ROSTER].sort((a, b) => appEloMap.get(b.id)! - appEloMap.get(a.id)! || a.name.localeCompare(b.name));
      const trueRankMap = new Map<string, number>();
      const appRankMap = new Map<string, number>();
      sortedTrue.forEach((p, idx) => trueRankMap.set(p.id, idx + 1));
      sortedApp.forEach((p, idx) => appRankMap.set(p.id, idx + 1));

      const rankCorr = calculateSpearman(
        TEST_ROSTER.map((p) => trueRankMap.get(p.id)!),
        TEST_ROSTER.map((p) => appRankMap.get(p.id)!),
      );

      db.prepare(`
        INSERT INTO simulation_sessions (
          session_number, session_id, attendees_count, attendee_names, court_count, round_count,
          mae, strongest_true_player, strongest_app_player, weakest_true_player, weakest_app_player, rank_correlation
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        sessionNum,
        session.id,
        attendingPlayers.length,
        attendingPlayers.map((p) => p.name).join(", "),
        courtCount,
        roundsPerSession,
        sessionMae,
        sortedTrue[0].name,
        sortedApp[0].name,
        sortedTrue[sortedTrue.length - 1].name,
        sortedApp[sortedApp.length - 1].name,
        rankCorr,
      );

      for (const p of TEST_ROSTER) {
        db.prepare(`
          INSERT INTO simulation_player_metrics (
            session_number, player_id, player_name, preset, attended_this_session,
            sessions_attended_total, games_played_total, true_elo, app_elo, absolute_error, true_rank, app_rank
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          sessionNum,
          p.id,
          p.name,
          p.preset,
          attendingSet.has(p.id) ? 1 : 0,
          sessionsAttended.get(p.id)!,
          gamesMap.get(p.id)!,
          currentTrueElo.get(p.id)!,
          appEloMap.get(p.id)!,
          Math.abs(appEloMap.get(p.id)! - currentTrueElo.get(p.id)!),
          trueRankMap.get(p.id)!,
          appRankMap.get(p.id)!,
        );
      }
    }

    // Verify simulation results
    // Verify simulation completed 20 sessions
    expect(sessionMaes).toHaveLength(21); // session 0 to 20
    const finalMae = sessionMaes[20];
    expect(finalMae).toBeGreaterThan(0);
  }, 90_000);
});
