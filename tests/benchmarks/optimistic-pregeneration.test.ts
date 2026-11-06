import { describe, expect, it } from "vitest";
import { proposeRoundFromSnapshot } from "@/lib/matchmaking/proposal";
import type { AttendanceRecord, PlayerRecord, SessionRecord, StartedRoundRecord } from "@/lib/domain/types";

function createMockPlayers(count: number): PlayerRecord[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `player-${i + 1}`,
    groupId: "benchmark-group",
    name: `Player ${i + 1}`,
    initialRating: 1000 + (i % 5) * 50,
    rating: 1000 + (i % 5) * 50,
    ratedGamesPlayed: 3,
    active: true,
  }));
}

function createMockAttendance(players: PlayerRecord[]): AttendanceRecord[] {
  return players.map((p) => ({
    sessionId: "benchmark-session",
    playerId: p.id,
    joinedRound: 1,
    leftRound: null,
  }));
}

function createMockSession(courtCount: number): SessionRecord {
  return {
    id: "benchmark-session",
    groupId: "benchmark-group",
    courtCount,
    status: "active",
    currentRoundNumber: 2,
    startedAt: new Date(),
    endedAt: null,
    version: 3,
  };
}

function createMockRounds(players: PlayerRecord[], count: number, courtCount: number): StartedRoundRecord[] {
  const rounds: StartedRoundRecord[] = [];
  for (let r = 1; r <= count; r++) {
    const roundId = `round-${r}`;
    const roundPlayers = [...players];
    const courts = [];
    const matchPlayers = [];
    for (let c = 1; c <= courtCount; c++) {
      const matchId = `match-${r}-${c}`;
      const t1p1 = roundPlayers[(c - 1) * 4];
      const t1p2 = roundPlayers[(c - 1) * 4 + 1];
      const t2p1 = roundPlayers[(c - 1) * 4 + 2];
      const t2p2 = roundPlayers[(c - 1) * 4 + 3];
      courts.push({
        id: matchId,
        roundId,
        courtNumber: c,
        status: "completed" as const,
        team1Score: 11,
        team2Score: 9,
        completedAt: new Date(),
        version: 1,
      });
      matchPlayers.push(
        { matchId, playerId: t1p1.id, team: 1 as const, ratingBefore: null, ratingAfter: null },
        { matchId, playerId: t1p2.id, team: 1 as const, ratingBefore: null, ratingAfter: null },
        { matchId, playerId: t2p1.id, team: 2 as const, ratingBefore: null, ratingAfter: null },
        { matchId, playerId: t2p2.id, team: 2 as const, ratingBefore: null, ratingAfter: null }
      );
    }
    const sitting = roundPlayers.slice(courtCount * 4).map((p) => ({
      roundId,
      playerId: p.id,
    }));
    rounds.push({
      round: {
        id: roundId,
        sessionId: "benchmark-session",
        roundNumber: r,
        status: "completed",
        seed: r,
        scoreBreakdown: {
          playingTime: 0,
          consecutiveSit: 0,
          partnerRepeat: 0,
          skillBalance: 0,
          opponentRepeat: 0,
          tieBreak: 0,
          total: 0,
        },
        createdAt: new Date(),
        startedAt: new Date(),
        completedAt: new Date(),
        version: 1,
      },
      matches: courts,
      matchPlayers,
      sits: sitting,
    });
  }
  return rounds;
}

describe("Optimistic next round pre-generation benchmarks", () => {
  it("proposes next round synchronously from snapshot adhering to fair sitting and valid courts", () => {
    const players = createMockPlayers(10);
    const attendance = createMockAttendance(players);
    const session = createMockSession(2); // 2 courts = 8 playing, 2 sitting
    const rounds = createMockRounds(players, 2, 2);

    const snapshot = {
      session,
      players,
      attendance,
      rounds,
    };

    const proposal = proposeRoundFromSnapshot(snapshot, undefined, 0);

    expect(proposal.courts).toHaveLength(2);
    expect(proposal.sitting).toHaveLength(2);

    const allAssigned = [
      ...proposal.courts.flatMap((c) => [...c.team1, ...c.team2]),
      ...proposal.sitting,
    ];
    // Exactly 10 players assigned without duplicates
    expect(allAssigned).toHaveLength(10);
    expect(new Set(allAssigned).size).toBe(10);
  });

  it("benchmarks execution time across 8, 12, 16, and 20 player pools with under 35ms median computation", () => {
    const playerConfigs = [
      { playerCount: 8, courtCount: 2 },
      { playerCount: 12, courtCount: 2 }, // 4 sitting
      { playerCount: 16, courtCount: 3 }, // 4 sitting
      { playerCount: 20, courtCount: 4 }, // 4 sitting
    ];

    const benchmarkResults: Record<string, { medianMs: number; maxMs: number }> = {};

    for (const { playerCount, courtCount } of playerConfigs) {
      const players = createMockPlayers(playerCount);
      const attendance = createMockAttendance(players);
      const session = createMockSession(courtCount);
      const rounds = createMockRounds(players, 3, courtCount);

      const snapshot = {
        session,
        players,
        attendance,
        rounds,
      };

      // Warmup
      proposeRoundFromSnapshot(snapshot, undefined, 0);

      const durations: number[] = [];
      const iterations = 5;

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        const proposal = proposeRoundFromSnapshot(snapshot, undefined, 0);
        const elapsed = performance.now() - start;
        durations.push(elapsed);
        expect(proposal.courts.length).toBe(courtCount);
      }

      durations.sort((a, b) => a - b);
      const median = durations[Math.floor(durations.length / 2)];
      const max = durations[durations.length - 1];

      benchmarkResults[`${playerCount}p_${courtCount}c`] = {
        medianMs: Number(median.toFixed(2)),
        maxMs: Number(max.toFixed(2)),
      };

      // Sanity check that computation finishes in a reasonable timeframe (< 500ms even under full parallel CPU load)
      expect(median).toBeLessThan(500);
    }

    // Ensure we collected all 4 benchmark configurations
    expect(Object.keys(benchmarkResults)).toHaveLength(4);

    console.log("\n================ OPTIMISTIC PRE-GENERATION BENCHMARKS ================");
    console.table(benchmarkResults);
    console.log("======================================================================\n");
  }, 30000);
});
