// npx tsx scripts/benchmarks/shared-global-replay.mjs [rounds=3] [samples=7] [output]
// Mutates connection-local TEMP tables only; never public fixture/history rows.
import nextEnv from "@next/env";
import postgres from "postgres";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { PostgresRepositories } from "../../src/lib/db/postgres-repositories.ts";
import { replayRatings } from "../../src/lib/domain/rating-replay.ts";
import { replayRatingsAndSynergies, replaySynergies } from "../../src/lib/domain/synergy-replay.ts";
import { createReplayTables, persistedReplayState, seedReplayHistory } from "../../tests/fixtures/postgres-replay.ts";

nextEnv.loadEnvConfig(process.cwd());
const url = process.env.TEST_DATABASE_URL;
// Session-local TEMP tables require the direct endpoint, not transaction pooling.
if (!url || !/^ep-cold-band-b491lrgj\./.test(new URL(url).hostname)) throw new Error("Expected allowlisted direct Neon test endpoint");
const roundCount = Number(process.argv[2] ?? "3");
const sampleCount = Number(process.argv[3] ?? "7");
if (!Number.isInteger(roundCount) || roundCount < 1 || roundCount > 2500 || !Number.isInteger(sampleCount) || sampleCount < 3 || sampleCount > 100) throw new Error("Use 1–2500 rounds and 3–100 samples");
const output = resolve(process.argv[4] ?? "docs/benchmarks/data/shared-global-replay.json");
let capture = false;
let queries = 0;
const sql = postgres(url, { max: 1, max_lifetime: 0, idle_timeout: 0, prepare: false, onnotice: () => {}, debug: () => { if (capture) queries++; } });
const repository = new PostgresRepositories(sql);
const samples = [];
const measuredMethods = ["listPlayers", "listReplayMatches", "replaceRatingState", "replaceSynergyState", "lockSynergyState"];
const run = (shared, phases = {}) => repository.transaction(async transaction => {
  const measured = new Proxy(transaction, { get(target, name) {
    const value = Reflect.get(target, name);
    if (typeof value !== "function") return value;
    if (!measuredMethods.includes(name)) return value.bind(target);
    return async (...args) => {
      const phase = phases[name] ??= { calls: 0, ms: 0 };
      phase.calls++;
      const start = performance.now();
      try { return await value.apply(target, args); }
      finally { phase.ms += performance.now() - start; }
    };
  } });
  await measured.lockSynergyState();
  if (shared) await replayRatingsAndSynergies("batch-group", measured);
  else { await replayRatings("batch-group", measured); await replaySynergies(measured); }
});
try {
  await createReplayTables(sql);
  await seedReplayHistory(repository, roundCount);
  await run(false);
  const expected = await persistedReplayState(sql);
  await run(true);
  assert.deepEqual(await persistedReplayState(sql), expected);
  for (let iteration = 0; iteration < sampleCount; iteration++) {
    for (const variant of iteration % 2 ? ["shared", "legacy"] : ["legacy", "shared"]) {
      queries = 0; capture = true;
      const phasesMs = {};
      const start = performance.now();
      await run(variant === "shared", phasesMs);
      const ms = performance.now() - start;
      capture = false;
      assert.deepEqual(await persistedReplayState(sql), expected);
      assert.equal(phasesMs.listPlayers.calls, variant === "shared" ? 1 : 2);
      assert.equal(phasesMs.listReplayMatches.calls, variant === "shared" ? 1 : 2);
      assert.equal(phasesMs.replaceRatingState.calls, 1);
      assert.equal(phasesMs.replaceSynergyState.calls, 1);
      assert.equal(phasesMs.lockSynergyState.calls, 2);
      const sample = { iteration, variant, ms, queries, phasesMs };
      samples.push(sample);
      console.log(JSON.stringify(sample));
    }
  }
  const summary = Object.fromEntries(["legacy", "shared"].map(variant => {
    const observations = samples.filter(sample => sample.variant === variant);
    const times = observations.map(sample => sample.ms).sort((a, b) => a - b);
    assert.equal(new Set(observations.map(sample => sample.queries)).size, 1);
    return [variant, { n: times.length, queries: observations[0].queries, medianMs: times[Math.floor(times.length / 2)], minMs: times[0], maxMs: times.at(-1) }];
  }));
  assert.equal(summary.shared.queries, summary.legacy.queries - 2);
  const result = { scope: "Warm replay transaction only, identical writes; not full browser/action latency", database: "Allowlisted Neon test branch, connection-local temporary tables", poolSize: 1,
    players: 16, rounds: roundCount, sourceMatches: roundCount * 4, replayMatches: (await repository.listReplayMatches()).length,
    warmupSamplesPerVariant: 1, phaseNote: "Method elapsed times include network and mapping; lock-call time includes round trips, not isolated lock waiting. Total also includes calculation, transaction control and other overhead.", samples, summary };
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(summary));
} finally { await sql.end(); }
