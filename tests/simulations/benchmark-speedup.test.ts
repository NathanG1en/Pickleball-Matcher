import { describe, it } from "vitest";
import { performance } from "node:perf_hooks";
import { generateRound } from "@/lib/matchmaking/generate-round";
import { DEFAULT_MATCHMAKING_CONFIG } from "@/lib/matchmaking/config";
import { SessionService } from "@/lib/domain/session-service";
import { InMemoryRepositories } from "@/test-support/in-memory-repositories";

describe("Performance Speedup Benchmark", () => {
  it("compares before vs now performance", async () => {
    const playerCount = 16;
    const courtCount = 4;
    const players = Array.from({ length: playerCount }, (_, i) => ({
      id: `p_${i + 1}`,
      groupId: "grp_1",
      name: `Player ${i + 1}`,
      initialRating: 1000 + (i % 5) * 50,
      rating: 1000 + (i % 5) * 50,
      ratedGamesPlayed: 5,
      active: true,
    }));

    const matchmakingPlayers = players.map((p) => ({
      id: p.id,
      rating: p.rating,
      sits: 0,
      consecutiveSits: 0,
      played: 2,
    }));

    // 1. Benchmark: Proposing a Round (5,000 vs 1,200 iterations)
    const repoA = new InMemoryRepositories({ players });
    const svcA = new SessionService(repoA, {
      now: () => new Date(),
      nextId: (k) => `${k}_${Math.random()}`,
      nextSeed: () => 10,
    });
    const sessionA = await svcA.startSession({
      groupId: "grp_1",
      courtCount,
      playerIds: players.map((p) => p.id),
    });

    const oldConfig = { ...DEFAULT_MATCHMAKING_CONFIG, iterations: 5_000 };
    const newConfig = { ...DEFAULT_MATCHMAKING_CONFIG, iterations: 1_200 };

    const startOldGen = performance.now();
    for (let i = 0; i < 5; i++) {
      generateRound({
        players: matchmakingPlayers.map(p => ({ ...p, active: true })),
        courts: courtCount,
        pairHistory: [],
        config: oldConfig,
        seed: 42 + i,
      });
    }
    const oldGenTime = performance.now() - startOldGen;

    const startNewGen = performance.now();
    for (let i = 0; i < 5; i++) {
      generateRound({
        players: matchmakingPlayers.map(p => ({ ...p, active: true })),
        courts: courtCount,
        pairHistory: [],
        config: newConfig,
        seed: 42 + i,
      });
    }
    const newGenTime = performance.now() - startNewGen;

    // 2. Benchmark: Round Start (Re-generating vs Direct Proposal)
    const repo1 = new InMemoryRepositories({ players });
    const svc1 = new SessionService(repo1, {
      now: () => new Date(),
      nextId: (k) => `${k}_${Math.random()}`,
      nextSeed: () => 10,
    });
    const session1 = await svc1.startSession({
      groupId: "grp_1",
      courtCount,
      playerIds: players.map((p) => p.id),
    });
    const proposal = await svc1.proposeRound(session1.id);

    // Old way: Start round re-runs proposeRound
    const startOldStart = performance.now();
    const regenerated = await svc1.proposeRound(session1.id, proposal.seed);
    await svc1.startRound(session1.id, regenerated);
    const oldStartTime = performance.now() - startOldStart;

    // New way: Start round directly uses the already-held proposal
    const repo2 = new InMemoryRepositories({ players });
    const svc2 = new SessionService(repo2, {
      now: () => new Date(),
      nextId: (k) => `${k}_${Math.random()}`,
      nextSeed: () => 10,
    });
    const session2 = await svc2.startSession({
      groupId: "grp_1",
      courtCount,
      playerIds: players.map((p) => p.id),
    });
    const startNewStart = performance.now();
    await svc2.startRound(session2.id, proposal);
    const newStartTime = performance.now() - startNewStart;

    // 3. Benchmark: Score Saving (4 Individual Saves vs 1 Batch Save)
    const matchesToScore = repo2.state.matches.filter((m) => m.roundId === repo2.state.rounds[0].id);

    // Old way: 4 sequential recordResult calls
    const startOldSave = performance.now();
    for (const m of matchesToScore) {
      await svc1.recordResult({ matchId: m.id, team1Score: 11, team2Score: 8 });
    }
    const oldSaveTime = performance.now() - startOldSave;

    // New way: 1 batch recordMultipleResults call
    const startNewSave = performance.now();
    await svc2.recordMultipleResults(
      matchesToScore.map((m) => ({ matchId: m.id, team1Score: 11, team2Score: 8 }))
    );
    const newSaveTime = performance.now() - startNewSave;

    console.log("\n================ SPEEDUP BENCHMARK RESULTS ================");
    console.log(`1. Round Proposal (5 rounds, 16 players):`);
    console.log(`   Before (5,000 iters): ${(oldGenTime / 5).toFixed(2)} ms / round`);
    console.log(`   Now    (1,200 iters): ${(newGenTime / 5).toFixed(2)} ms / round`);
    console.log(`   Speedup: ${(oldGenTime / newGenTime).toFixed(2)}x faster (${((1 - newGenTime / oldGenTime) * 100).toFixed(1)}% reduction)`);
    console.log(`\n2. Starting a Round:`);
    console.log(`   Before (Re-ran simulation): ${oldStartTime.toFixed(2)} ms`);
    console.log(`   Now    (Direct proposal):   ${newStartTime.toFixed(2)} ms`);
    console.log(`   Speedup: ${(oldStartTime / newStartTime).toFixed(2)}x faster (${((1 - newStartTime / oldStartTime) * 100).toFixed(1)}% reduction)`);
    console.log(`\n3. Saving 4 Court Scores:`);
    console.log(`   Before (4 sequential saves): ${oldSaveTime.toFixed(2)} ms`);
    console.log(`   Now    (1 batch save):       ${newSaveTime.toFixed(2)} ms`);
    console.log(`   Speedup: ${(oldSaveTime / newSaveTime).toFixed(2)}x faster (${((1 - newSaveTime / oldSaveTime) * 100).toFixed(1)}% reduction)`);
    console.log("===========================================================\n");
  });
});
