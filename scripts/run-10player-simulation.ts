import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { SessionService } from "@/lib/domain/session-service";
import { SqliteDomainRepository } from "../tests/simulations/sqlite-repositories";

export interface PlayerGrowthProfile {
  readonly id: string;
  readonly name: string;
  readonly preset: "Beginner" | "Intermediate" | "Advanced";
  readonly startingAppElo: number;
  readonly initialTrueElo: number;
  readonly persona: string;
  readonly getTrueElo: (sessionNum: number) => number;
}

export const TEN_PLAYERS: readonly PlayerGrowthProfile[] = [
  {
    id: "p1-maya",
    name: "Maya",
    preset: "Beginner",
    startingAppElo: 900,
    initialTrueElo: 820,
    persona: "Fast Improver A (Weekly coaching)",
    getTrueElo: (s) => Math.round(820 + 260 * (1 - Math.exp(-0.10 * s))),
  },
  {
    id: "p2-liam",
    name: "Liam",
    preset: "Beginner",
    startingAppElo: 900,
    initialTrueElo: 880,
    persona: "Fast Improver B (Tennis background)",
    getTrueElo: (s) => Math.round(880 + 200 * (1 - Math.exp(-0.08 * s))),
  },
  {
    id: "p3-chloe",
    name: "Chloe",
    preset: "Intermediate",
    startingAppElo: 1000,
    initialTrueElo: 940,
    persona: "Early Plateau (Quick rise then flat)",
    getTrueElo: (s) => Math.round(940 + 70 * (1 - Math.exp(-0.18 * s))),
  },
  {
    id: "p4-devon",
    name: "Devon",
    preset: "Intermediate",
    startingAppElo: 1000,
    initialTrueElo: 980,
    persona: "Slow Grinder (Linear progression)",
    getTrueElo: (s) => Math.round(980 + 3.5 * s),
  },
  {
    id: "p5-elena",
    name: "Elena",
    preset: "Intermediate",
    startingAppElo: 1000,
    initialTrueElo: 1030,
    persona: "Completely Flat Baseline",
    getTrueElo: () => 1030,
  },
  {
    id: "p6-marcus",
    name: "Marcus",
    preset: "Intermediate",
    startingAppElo: 1000,
    initialTrueElo: 920,
    persona: "Late Bloomer (Breakthrough at S10)",
    getTrueElo: (s) => Math.round(920 + 160 / (1 + Math.exp(-0.6 * (s - 10)))),
  },
  {
    id: "p7-nadia",
    name: "Nadia",
    preset: "Intermediate",
    startingAppElo: 1000,
    initialTrueElo: 1090,
    persona: "Consistent Upper-Intermediate",
    getTrueElo: (s) => Math.round(1090 + 40 * (1 - Math.exp(-0.05 * s))),
  },
  {
    id: "p8-victor",
    name: "Victor",
    preset: "Advanced",
    startingAppElo: 1100,
    initialTrueElo: 1220,
    persona: "Declining Veteran (Injury/fatigue)",
    getTrueElo: (s) => Math.round(1220 - 90 * (1 - Math.exp(-0.07 * s))),
  },
  {
    id: "p9-samira",
    name: "Samira",
    preset: "Advanced",
    startingAppElo: 1100,
    initialTrueElo: 1380,
    persona: "Elite Anchor (Club Champion, 4.45 DUPR)",
    getTrueElo: (s) => Math.round(1380 + 15 * Math.sin(0.4 * s)),
  },
  {
    id: "p10-jordan",
    name: "Jordan",
    preset: "Intermediate",
    startingAppElo: 1000,
    initialTrueElo: 1000,
    persona: "Erratic / Hot & Cold Streaks",
    getTrueElo: (s) => Math.round(1000 + 45 * Math.sin(0.6 * s)),
  },
];

// PRNG for deterministic, reproducible simulation runs
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

/**
 * Simulates a realistic rally-by-rally pickleball game to 11 (win by 2).
 * Incorporates a modest weakest-link targeting weight:
 * Opponents target the weaker partner 65% of the time.
 */
export function simulatePickleballGame(
  t1_p1_true: number,
  t1_p2_true: number,
  t2_p1_true: number,
  t2_p2_true: number,
  prng: Mulberry32,
): { team1Score: number; team2Score: number; winner: 1 | 2 } {
  const t1_weak = Math.min(t1_p1_true, t1_p2_true);
  const t1_strong = Math.max(t1_p1_true, t1_p2_true);
  const t2_weak = Math.min(t2_p1_true, t2_p2_true);
  const t2_strong = Math.max(t2_p1_true, t2_p2_true);

  // Effective rally strength (65% weak, 35% strong)
  const t1_eff = 0.65 * t1_weak + 0.35 * t1_strong;
  const t2_eff = 0.65 * t2_weak + 0.35 * t2_strong;

  const pRallyT1 = 1 / (1 + Math.pow(10, (t2_eff - t1_eff) / 400));

  let s1 = 0;
  let s2 = 0;
  while (true) {
    if (prng.next() < pRallyT1) {
      s1++;
    } else {
      s2++;
    }

    if ((s1 >= 11 || s2 >= 11) && Math.abs(s1 - s2) >= 2) {
      break;
    }
    // Safety cap against infinite deuce
    if (s1 + s2 >= 40) {
      if (s1 === s2) s1++;
      break;
    }
  }

  return {
    team1Score: s1,
    team2Score: s2,
    winner: s1 > s2 ? 1 : 2,
  };
}

async function runSimulation() {
  const analysisDir = path.resolve(process.cwd(), "analysis");
  if (!fs.existsSync(analysisDir)) {
    fs.mkdirSync(analysisDir, { recursive: true });
  }

  const dbPath = path.resolve(analysisDir, "simulation_10players.db");
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }

  console.log(`Initializing 10-player simulation SQLite database at: ${dbPath}`);
  const db = new DatabaseSync(dbPath);
  const repository = new SqliteDomainRepository(db);

  // Setup simulation schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS ten_player_sessions (
      session_number INTEGER PRIMARY KEY,
      session_id TEXT NOT NULL,
      attendees_count INTEGER NOT NULL,
      attendee_names TEXT NOT NULL,
      court_count INTEGER NOT NULL,
      round_count INTEGER NOT NULL,
      raw_mae REAL NOT NULL,
      centered_mae REAL NOT NULL,
      rank_correlation REAL NOT NULL,
      brier_score REAL NOT NULL,
      app_mean REAL NOT NULL,
      true_mean REAL NOT NULL,
      strongest_true_player TEXT NOT NULL,
      strongest_app_player TEXT NOT NULL,
      weakest_true_player TEXT NOT NULL,
      weakest_app_player TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ten_player_player_metrics (
      session_number INTEGER NOT NULL,
      player_id TEXT NOT NULL,
      player_name TEXT NOT NULL,
      persona TEXT NOT NULL,
      preset TEXT NOT NULL,
      attended_this_session INTEGER NOT NULL,
      sessions_attended_total INTEGER NOT NULL,
      games_played_total INTEGER NOT NULL,
      true_elo REAL NOT NULL,
      app_elo REAL NOT NULL,
      raw_error REAL NOT NULL,
      centered_error REAL NOT NULL,
      true_rank INTEGER NOT NULL,
      app_rank INTEGER NOT NULL,
      PRIMARY KEY (session_number, player_id)
    );

    CREATE TABLE IF NOT EXISTS ten_player_matches_log (
      id TEXT PRIMARY KEY,
      session_number INTEGER NOT NULL,
      round_number INTEGER NOT NULL,
      court_number INTEGER NOT NULL,
      team1_p1 TEXT NOT NULL,
      team1_p2 TEXT NOT NULL,
      team2_p1 TEXT NOT NULL,
      team2_p2 TEXT NOT NULL,
      team1_true_elo REAL NOT NULL,
      team2_true_elo REAL NOT NULL,
      p_team1_wins REAL NOT NULL,
      winner INTEGER NOT NULL,
      team1_score INTEGER NOT NULL,
      team2_score INTEGER NOT NULL,
      team1_app_elo_before REAL NOT NULL,
      team2_app_elo_before REAL NOT NULL
    );
  `);

  const prng = new Mulberry32(42);
  let idCounter = 0;
  let seedCounter = 1000;

  let simDate = new Date("2026-06-01T18:00:00Z");
  const service = new SessionService(repository, {
    now: () => simDate,
    nextId: (kind) => `${kind}-${++idCounter}`,
    nextSeed: () => ++seedCounter,
  });

  const groupId = "ten-player-league";
  await repository.insertGroup({
    id: groupId,
    name: "10-Player Benchmark League",
    organizerPinHash: "sim-pin-hash",
    createdAt: simDate,
  });

  // Create the 10 players in the app
  for (const player of TEN_PLAYERS) {
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
  for (const player of TEN_PLAYERS) {
    sessionsAttended.set(player.id, 0);
  }

  // Session 0 (Pre-play baseline)
  const true0 = TEN_PLAYERS.map((p) => p.getTrueElo(0));
  const app0 = TEN_PLAYERS.map((p) => p.startingAppElo);
  const trueMean0 = true0.reduce((a, b) => a + b, 0) / true0.length;
  const appMean0 = app0.reduce((a, b) => a + b, 0) / app0.length;

  const rawMae0 = true0.map((t, i) => Math.abs(app0[i] - t)).reduce((a, b) => a + b, 0) / 10;
  const centeredMae0 = true0.map((t, i) => Math.abs((app0[i] - appMean0) - (t - trueMean0))).reduce((a, b) => a + b, 0) / 10;

  const sortedTrue0 = [...TEN_PLAYERS].sort((a, b) => b.getTrueElo(0) - a.getTrueElo(0));
  const sortedApp0 = [...TEN_PLAYERS].sort((a, b) => b.startingAppElo - a.startingAppElo || a.name.localeCompare(b.name));
  const trueRank0 = new Map(sortedTrue0.map((p, idx) => [p.id, idx + 1]));
  const appRank0 = new Map(sortedApp0.map((p, idx) => [p.id, idx + 1]));

  const spearman0 = calculateSpearman(
    TEN_PLAYERS.map((p) => trueRank0.get(p.id)!),
    TEN_PLAYERS.map((p) => appRank0.get(p.id)!),
  );

  db.prepare(`
    INSERT INTO ten_player_sessions (
      session_number, session_id, attendees_count, attendee_names, court_count, round_count,
      raw_mae, centered_mae, rank_correlation, brier_score, app_mean, true_mean,
      strongest_true_player, strongest_app_player, weakest_true_player, weakest_app_player
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    0, "session-0", 10, TEN_PLAYERS.map((p) => p.name).join(", "), 0, 0,
    rawMae0, centeredMae0, spearman0, 0.25, appMean0, trueMean0,
    sortedTrue0[0].name, sortedApp0[0].name, sortedTrue0[9].name, sortedApp0[9].name
  );

  for (const p of TEN_PLAYERS) {
    const t = p.getTrueElo(0);
    const a = p.startingAppElo;
    db.prepare(`
      INSERT INTO ten_player_player_metrics (
        session_number, player_id, player_name, persona, preset, attended_this_session,
        sessions_attended_total, games_played_total, true_elo, app_elo, raw_error, centered_error, true_rank, app_rank
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      0, p.id, p.name, p.persona, p.preset, 0, 0, 0,
      t, a, Math.abs(a - t), Math.abs((a - appMean0) - (t - trueMean0)),
      trueRank0.get(p.id)!, appRank0.get(p.id)!
    );
  }

  console.log(`Session 0 Baseline: Raw MAE = ${rawMae0.toFixed(2)}, Centered MAE = ${centeredMae0.toFixed(2)}, Rank Corr = ${spearman0.toFixed(3)}`);

  // Simulate 20 league sessions
  const TOTAL_SESSIONS = 20;
  const ROUNDS_PER_SESSION = 5;

  for (let sNum = 1; sNum <= TOTAL_SESSIONS; sNum++) {
    // Increment date by 7 days for weekly sessions
    simDate = new Date(simDate.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Attendance selection: 8 or 10 players attend
    // 70% chance all 10 attend (2 sit out per round), 30% chance 8 attend (full 2 courts)
    const attendCount = prng.next() < 0.70 ? 10 : 8;
    
    // Sort players by attendance count to keep games roughly balanced across the league
    const candidates = [...TEN_PLAYERS].map((p) => ({
      player: p,
      score: sessionsAttended.get(p.id)! + prng.next() * 1.5,
    }));
    candidates.sort((a, b) => a.score - b.score);

    const attendingPlayers = candidates.slice(0, attendCount).map((c) => c.player);
    const attendingIds = attendingPlayers.map((p) => p.id);
    const attendingSet = new Set(attendingIds);

    for (const p of attendingPlayers) {
      sessionsAttended.set(p.id, sessionsAttended.get(p.id)! + 1);
    }

    // Compute current True Elo for all 10 players at this session
    const currentTrue = new Map<string, number>();
    for (const p of TEN_PLAYERS) {
      currentTrue.set(p.id, p.getTrueElo(sNum));
    }

    const courtCount = 2; // Always 2 courts for 8-10 players
    const session = await service.startSession({
      groupId,
      courtCount,
      playerIds: attendingIds,
    });

    let sessionBrierSum = 0;
    let sessionMatchesCount = 0;

    for (let rNum = 1; rNum <= ROUNDS_PER_SESSION; rNum++) {
      const roundSeed = sNum * 1000 + rNum * 10;
      const proposal = await service.proposeRound(session.id, roundSeed);
      const round = await service.startRound(session.id, proposal);

      const startedRounds = await repository.listStartedRounds(session.id);
      const curRoundRecord = startedRounds.find((r) => r.round.id === round.id)!;

      for (const match of curRoundRecord.matches) {
        const matchPlayers = curRoundRecord.matchPlayers.filter((mp) => mp.matchId === match.id);
        const t1Ids = matchPlayers.filter((mp) => mp.team === 1).map((mp) => mp.playerId);
        const t2Ids = matchPlayers.filter((mp) => mp.team === 2).map((mp) => mp.playerId);

        if (t1Ids.length !== 2 || t2Ids.length !== 2) continue;

        const t1_p1_true = currentTrue.get(t1Ids[0])!;
        const t1_p2_true = currentTrue.get(t1Ids[1])!;
        const t2_p1_true = currentTrue.get(t2Ids[0])!;
        const t2_p2_true = currentTrue.get(t2Ids[1])!;

        const team1TrueAvg = (t1_p1_true + t1_p2_true) / 2;
        const team2TrueAvg = (t2_p1_true + t2_p2_true) / 2;

        // Simulate game to 11 win by 2 with weakest-link targeting
        const game = simulatePickleballGame(t1_p1_true, t1_p2_true, t2_p1_true, t2_p2_true, prng);

        // App ratings before match (to compute predictive Brier score)
        const allPlayers = await repository.listPlayers(groupId);
        const pMap = new Map(allPlayers.map((p) => [p.id, p.rating]));
        const t1AppBefore = (pMap.get(t1Ids[0])! + pMap.get(t1Ids[1])!) / 2;
        const t2AppBefore = (pMap.get(t2Ids[0])! + pMap.get(t2Ids[1])!) / 2;

        const pAppT1Wins = 1 / (1 + Math.pow(10, (t2AppBefore - t1AppBefore) / 400));
        const actualOutcome = game.winner === 1 ? 1 : 0;
        sessionBrierSum += Math.pow(pAppT1Wins - actualOutcome, 2);
        sessionMatchesCount++;

        // Record real scores to application
        await service.recordResult({
          matchId: match.id,
          team1Score: game.team1Score,
          team2Score: game.team2Score,
        });

        // Log match
        db.prepare(`
          INSERT INTO ten_player_matches_log (
            id, session_number, round_number, court_number,
            team1_p1, team1_p2, team2_p1, team2_p2,
            team1_true_elo, team2_true_elo, p_team1_wins,
            winner, team1_score, team2_score,
            team1_app_elo_before, team2_app_elo_before
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          match.id, sNum, rNum, match.courtNumber,
          t1Ids[0], t1Ids[1], t2Ids[0], t2Ids[1],
          team1TrueAvg, team2TrueAvg, pAppT1Wins,
          game.winner, game.team1Score, game.team2Score,
          t1AppBefore, t2AppBefore
        );
      }

      await service.completeRound(round.id);
    }

    await service.endSession(session.id);

    // Record session metrics
    const playersAfter = await repository.listPlayers(groupId);
    const appMap = new Map(playersAfter.map((p) => [p.id, p.rating]));
    const gamesMap = new Map(playersAfter.map((p) => [p.id, p.ratedGamesPlayed]));

    const trueVals = TEN_PLAYERS.map((p) => currentTrue.get(p.id)!);
    const appVals = TEN_PLAYERS.map((p) => appMap.get(p.id)!);

    const trueMean = trueVals.reduce((a, b) => a + b, 0) / 10;
    const appMean = appVals.reduce((a, b) => a + b, 0) / 10;

    const rawMae = trueVals.map((t, i) => Math.abs(appVals[i] - t)).reduce((a, b) => a + b, 0) / 10;
    const centeredMae = trueVals.map((t, i) => Math.abs((appVals[i] - appMean) - (t - trueMean))).reduce((a, b) => a + b, 0) / 10;
    const brier = sessionMatchesCount > 0 ? sessionBrierSum / sessionMatchesCount : 0.25;

    const sortedTrue = [...TEN_PLAYERS].sort((a, b) => currentTrue.get(b.id)! - currentTrue.get(a.id)!);
    const sortedApp = [...TEN_PLAYERS].sort((a, b) => appMap.get(b.id)! - appMap.get(a.id)! || a.name.localeCompare(b.name));
    const trueRankMap = new Map(sortedTrue.map((p, idx) => [p.id, idx + 1]));
    const appRankMap = new Map(sortedApp.map((p, idx) => [p.id, idx + 1]));

    const spearman = calculateSpearman(
      TEN_PLAYERS.map((p) => trueRankMap.get(p.id)!),
      TEN_PLAYERS.map((p) => appRankMap.get(p.id)!),
    );

    db.prepare(`
      INSERT INTO ten_player_sessions (
        session_number, session_id, attendees_count, attendee_names, court_count, round_count,
        raw_mae, centered_mae, rank_correlation, brier_score, app_mean, true_mean,
        strongest_true_player, strongest_app_player, weakest_true_player, weakest_app_player
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sNum, session.id, attendingPlayers.length, attendingPlayers.map((p) => p.name).join(", "),
      courtCount, ROUNDS_PER_SESSION,
      rawMae, centeredMae, spearman, brier, appMean, trueMean,
      sortedTrue[0].name, sortedApp[0].name, sortedTrue[9].name, sortedApp[9].name
    );

    for (const p of TEN_PLAYERS) {
      const t = currentTrue.get(p.id)!;
      const a = appMap.get(p.id)!;
      db.prepare(`
        INSERT INTO ten_player_player_metrics (
          session_number, player_id, player_name, persona, preset, attended_this_session,
          sessions_attended_total, games_played_total, true_elo, app_elo, raw_error, centered_error, true_rank, app_rank
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        sNum, p.id, p.name, p.persona, p.preset, attendingSet.has(p.id) ? 1 : 0,
        sessionsAttended.get(p.id)!, gamesMap.get(p.id)!,
        t, a, Math.abs(a - t), Math.abs((a - appMean) - (t - trueMean)),
        trueRankMap.get(p.id)!, appRankMap.get(p.id)!
      );
    }

    if (sNum % 5 === 0 || sNum === 1 || sNum === TOTAL_SESSIONS) {
      console.log(
        `Session ${sNum.toString().padStart(2)}: Centered MAE = ${centeredMae.toFixed(2)} | Raw MAE = ${rawMae.toFixed(2)} | Rank Corr = ${spearman.toFixed(3)} | App Mean = ${appMean.toFixed(1)} vs True = ${trueMean.toFixed(1)}`
      );
    }
  }

  console.log(`\nSimulation finished! All 20 sessions recorded in: ${dbPath}`);
}

runSimulation().catch((err) => {
  console.error("Simulation failed:", err);
  process.exit(1);
});
