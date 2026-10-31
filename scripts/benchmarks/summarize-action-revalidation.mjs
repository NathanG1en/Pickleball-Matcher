// node scripts/benchmarks/summarize-action-revalidation.mjs BASELINE_TRACE BASELINE_LOG OPTIMIZED_TRACE OPTIMIZED_LOG [OUTPUT]
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const [baselineTrace, baselineLog, optimizedTrace, optimizedLog, output = "docs/benchmarks/data/action-revalidation.json"] = process.argv.slice(2);
if (!baselineTrace || !baselineLog || !optimizedTrace || !optimizedLog) throw new Error("Supply both trace files and Playwright stdout logs");
function summarize(trace, log, variant) {
  const events = readFileSync(trace, "utf8").trim().split("\n").map(line => JSON.parse(line));
  assert.ok(events.some(event => event.type === "query-hook"), "Database query hook must have loaded");
  assert.equal(events.filter(event => event.type === "unattributed-query").length, 0, "Cannot compare incompletely attributed queries");
  const browserRuns = readFileSync(log, "utf8").split("\n").filter(line => line.startsWith("ACTION_REVALIDATION ")).map(line => JSON.parse(line.slice("ACTION_REVALIDATION ".length)));
  const groups = new Map();
  for (const event of events) {
    if (event.type !== "request" || !event.step || !/\/sessions\/session_[^/]+$/.test(event.path) || event.prefetch) continue;
    const records = groups.get(event.path) ?? [];
    records.push(event);
    groups.set(event.path, records);
  }
  const runs = [...groups.values()].sort((a, b) => Math.min(...a.map(r => r.startedAt)) - Math.min(...b.map(r => r.startedAt)));
  assert.equal(runs.length, browserRuns.length);
  assert.ok(runs.length > 0);
  return runs.map((records, index) => {
    const browser = browserRuns[index];
    const normalSteps = browser.samples.filter(sample => sample.step !== "bfcache-restore");
    assert.equal(normalSteps.length, 13, "Need the entire successful workflow");
    const steps = normalSteps.map(sample => {
      const requests = records.filter(record => record.step === sample.step);
      const posts = requests.filter(record => record.method === "POST");
      const gets = requests.filter(record => record.method === "GET");
      assert.equal(posts.length, 1);
      assert.ok(posts[0].action && posts[0].queries > 0);
      assert.equal(gets.length, variant === "baseline" && sample.step !== "save-score-control" ? 1 : 0);
      assert.equal(sample.posts, posts.length);
      assert.equal(sample.gets, gets.length);
      assert.ok(requests.every(record => record.status === 200));
      assert.ok(gets.every(record => record.rsc && record.queries > 0));
      return { step: sample.step, posts: posts.length, gets: gets.length,
        postQueries: posts[0].queries, getQueries: gets.reduce((sum, request) => sum + request.queries, 0),
        postMs: posts[0].ms, getMs: gets.map(request => request.ms), browserMs: sample.ms };
    });
    const recovery = records.filter(record => record.step === "bfcache-restore");
    if (variant === "optimized") {
      assert.equal(recovery.length, 1);
      assert.ok(recovery[0].method === "GET" && recovery[0].rsc && recovery[0].queries > 0);
    }
    return { variant, project: browser.project, steps,
      totals: { posts: steps.reduce((sum, step) => sum + step.posts, 0), gets: steps.reduce((sum, step) => sum + step.gets, 0),
        queries: steps.reduce((sum, step) => sum + step.postQueries + step.getQueries, 0) },
      recovery: recovery.map(request => ({ step: request.step, method: request.method, queries: request.queries, ms: request.ms })) };
  });
}
const baseline = summarize(baselineTrace, baselineLog, "baseline");
const optimized = summarize(optimizedTrace, optimizedLog, "optimized");
for (const run of optimized) {
  assert.deepEqual(run.steps.map(step => [step.step, step.postQueries]), baseline[0].steps.map(step => [step.step, step.postQueries]), "Mutation POST work must match; savings should come from removed GETs");
}
const result = { baselineCommit: "75e4c27", scope: "One baseline desktop and optimized desktop/mobile workflow; local Next development server, Neon test branch",
  fixture: { accounts: 1, guests: 7, courts: 2 }, queryMetric: "Attempted Postgres Query executions, including BEGIN/COMMIT; not wire messages or returned rows",
  unattributedQueries: 0, timingNote: "One observation per step and device, includes dev overhead; browser timings include a network-idle settling wait. No production latency claim.",
  runs: [...baseline, ...optimized] };
const target = resolve(output);
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result.runs.map(run => ({ variant: run.variant, project: run.project, ...run.totals }))));
