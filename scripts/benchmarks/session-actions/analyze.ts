// npx tsx scripts/benchmarks/session-actions/analyze.ts PRIVATE_DIRECTORY OUTPUT_DIRECTORY
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { intervalUnionMs, summarizeSamples } from "./timeline";

type Query = { kind: string; shape: string; tables: string[]; startMs: number; endMs: number; ms: number; failed?: boolean };
type Request = { type: string; step: string | null; action: boolean; epochMs: number; ms: number; firstWriteMs: number; status: number; queries: Query[]; inputBytes: number; outputBytes: number; cpuMicros: { user: number; system: number } };
type Sample = { tag: string; action: string; round: number; clickEpochMs: number; domReadyMs: number; feedbackMs: number; posts: number; gets: number; network: { method: string; timing: { startTime: number; requestStart: number; responseStart: number; responseEnd: number }; requestBytes: number }[]; secondary: { longTasks: { duration: number }[]; layoutShifts: { value: number; hadRecentInput: boolean }[]; paints: unknown[] } };
const [directoryArg, outputArg, variant = "control"] = process.argv.slice(2);
assert.ok(directoryArg && outputArg, "Supply private directory and sanitized output directory");
assert.match(variant, /^[a-z0-9-]+$/);
const directory = resolve(directoryArg);
const output = resolve(outputArg);
mkdirSync(output, { recursive: true });
const actions = ["start", "save-all", "next"];
type Observation = Sample & { viewport: string; request: Request; timeline: {
  requestOffsetMs: number; serverOffsetMs: number; firstServerWriteOffsetMs: number;
  firstResponseByteOffsetMs: number; serverFinishOffsetMs: number; domReadyOffsetMs: number;
  queryUnionBeforeDomMs: number; queryUnionBeforeFirstByteMs: number;
  serverWallWithoutOutstandingQueryBeforeDomMs: number; browserAfterFirstResponseByteMs: number;
  queryIntervalsFromClick: Query[];
} };
const all: Observation[] = [];

for (const viewport of ["desktop", "narrow"]) {
  const tag = `${variant}-${viewport}`;
  const samples = JSON.parse(readFileSync(`${directory}/${tag}.samples.json`, "utf8")) as Sample[];
  const traces = readFileSync(`${directory}/${tag}.requests.jsonl`, "utf8").trim().split("\n").map(line => JSON.parse(line)) as Request[];
  assert.ok(traces.every(trace => trace.type !== "unattributed-query"), "Unattributed SQL invalidates trace completeness");
  const selected = samples.filter(sample => actions.includes(sample.action));
  for (const action of actions) assert.equal(selected.filter(sample => sample.action === action).length, 10, `${tag}/${action} must have exactly ten observations`);
  for (const sample of selected) {
    assert.ok(Number.isFinite(sample.domReadyMs) && sample.domReadyMs > 0);
    assert.equal(sample.posts, 1);
    assert.equal(sample.gets, 0);
    const step = `${sample.tag}-${sample.action}-${sample.round}`;
    const matched = traces.filter(trace => trace.type === "request" && trace.action && trace.step === step);
    assert.equal(matched.length, 1, `Expected exactly one traced action ${step}`);
    const request = matched[0];
    assert.equal(request.status, 200);
    assert.ok(request.queries.every(query => !query.failed && Number.isFinite(query.endMs)));
    const post = sample.network.find(item => item.method === "POST");
    assert.ok(post);
    const serverOffsetMs = request.epochMs - sample.clickEpochMs;
    const requestOffsetMs = post.timing.startTime - sample.clickEpochMs;
    const serverUntilDomMs = Math.min(request.ms, sample.domReadyMs - serverOffsetMs);
    const queryUnionBeforeDomMs = intervalUnionMs(request.queries, 0, Math.max(0, serverUntilDomMs));
    const queryUnionBeforeFirstByteMs = intervalUnionMs(request.queries, 0, request.firstWriteMs);
    const row = {
      viewport, ...sample, request,
      timeline: {
        requestOffsetMs, serverOffsetMs,
        firstServerWriteOffsetMs: serverOffsetMs + request.firstWriteMs,
        firstResponseByteOffsetMs: requestOffsetMs + post.timing.responseStart,
        serverFinishOffsetMs: serverOffsetMs + request.ms,
        domReadyOffsetMs: sample.domReadyMs,
        queryUnionBeforeDomMs,
        queryUnionBeforeFirstByteMs,
        serverWallWithoutOutstandingQueryBeforeDomMs: serverUntilDomMs - queryUnionBeforeDomMs,
        browserAfterFirstResponseByteMs: sample.domReadyMs - requestOffsetMs - post.timing.responseStart,
        // These overlap the streaming/rendering interval and are NEVER added to network/server spans.
        queryIntervalsFromClick: request.queries.map(query => ({ ...query, startMs: serverOffsetMs + query.startMs, endMs: serverOffsetMs + query.endMs })),
      },
    };
    all.push(row);
  }
}

const summary = Object.fromEntries(["desktop", "narrow"].map(viewport => [viewport, Object.fromEntries(actions.map(action => {
  const selected = all.filter(sample => sample.viewport === viewport && sample.action === action);
  const timings = summarizeSamples(selected.map(sample => sample.domReadyMs));
  const representative = [...selected].sort((a, b) => Math.abs(a.domReadyMs - timings.medianMs) - Math.abs(b.domReadyMs - timings.medianMs))[0];
  return [action, {
    ...timings, observations: selected.map(sample => sample.domReadyMs),
    queries: [...new Set(selected.map(sample => sample.request.queries.length))],
    feedback: summarizeSamples(selected.map(sample => sample.feedbackMs)),
    queryUnionBeforeDom: summarizeSamples(selected.map(sample => sample.timeline.queryUnionBeforeDomMs)),
    serverDuration: summarizeSamples(selected.map(sample => sample.request.ms)),
    requestBytes: summarizeSamples(selected.map(sample => sample.request.inputBytes)),
    responseBytes: summarizeSamples(selected.map(sample => sample.request.outputBytes)),
    longTaskCount: selected.map(sample => sample.secondary.longTasks.length),
    longTaskMs: selected.map(sample => sample.secondary.longTasks.reduce((sum, task) => sum + task.duration, 0)),
    layoutShiftAll: selected.map(sample => sample.secondary.layoutShifts.reduce((sum, shift) => sum + shift.value, 0)),
    layoutShiftWithoutRecentInput: selected.map(sample => sample.secondary.layoutShifts.filter(shift => !shift.hadRecentInput).reduce((sum, shift) => sum + shift.value, 0)),
    representativeRound: representative.round, representativeTimeline: representative.timeline,
  }];
}))]));

const result = {
  status: variant === "control" ? "FRESH CONTROL ONLY — no optimization or stopping-condition claim" : "MEASURED CANDIDATE — correctness and stopping audit documented separately",
  variant, source: variant === "control" ? "50adab8" : JSON.parse(readFileSync(`${directory}/${variant}-source-manifest.json`, "utf8")), runtime: { node: process.version, next: "16.3.8", build: "production Webpack" },
  metric: "Original capturing click / Date.now / MutationObserver expected DOM state; 250ms pause outside clock",
  fixtureSha256: "16511ece78d5dde689cb320c1433cc62ab8cd8a5114dda3cc31e98cfd2562d52",
  clockCaveat: "Client/server epochs on same Mac; Date.now has millisecond precision. PostgreSQL query spans include driver/pool/transport/server execution, not executor CPU alone.",
  renderCaveat: "Long tasks and layout shifts are separate observations. Paint entries describe navigation paints only; this collector does not establish an action-specific paint-completion time. CPU counters are whole-process deltas and may include parallel prefetch work.",
  exclusions: variant === "control" ? [{ tag: "control-narrow", database: "goal_control_narrow_v3", reason: "Full viewport run excluded because timeline-helper RED and GREEN Vitest processes overlapped its timed intervals. All raw observations retained separately; repeated from identical fixture on v4." }] : [],
  summary, observations: all,
};
writeFileSync(`${output}/${variant}.json`, JSON.stringify(result, null, 2) + "\n");
for (const viewport of ["desktop", "narrow"]) for (const action of actions) console.log(viewport, action, JSON.stringify(summary[viewport][action].observations), summary[viewport][action].medianMs);
