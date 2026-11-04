// Sanitize separate CDP render diagnostics; never substitute them for primary DOM timings.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { resolve } from 'node:path';
const [privateDirectory, outputDirectory] = process.argv.slice(2);
assert.ok(privateDirectory && outputDirectory);
const output = resolve(outputDirectory); mkdirSync(output, { recursive: true });
const observations = [];
for (const viewport of ['desktop', 'narrow']) {
  const tag = `render-${viewport}`;
  const text = readFileSync(`${privateDirectory}/${tag}.browser.log`, 'utf8');
  const start = text.indexOf('### Result\n'); assert.ok(start >= 0);
  const serialized = text.slice(start + '### Result\n'.length).split('\n### Ran Playwright code')[0].trim();
  const result = JSON.parse(serialized);
  assert.equal(result.results.length, 3);
  const events = result.traceEvents;
  const marks = new Map(events.filter(event => event.name?.startsWith('goal-')).map(event => [event.name, event.ts]));
  for (const row of result.results) {
    const begin = marks.get(`goal-${row.action}-click`);
    const dom = marks.get(`goal-${row.action}-dom`);
    const nextFrame = marks.get(`goal-${row.action}-frame-after-paint-opportunity`);
    assert.ok(Number.isFinite(begin) && Number.isFinite(dom) && Number.isFinite(nextFrame));
    const paints = events.filter(event => event.name === 'Paint' && event.ts >= dom && event.ts <= nextFrame);
    assert.ok(paints.length, 'Cannot claim a paint without a traced Paint event');
    observations.push({ viewport, action: row.action, diagnosticRound: row.round,
      clickToDomMs: (dom - begin) / 1000, firstPaintAfterDomMs: (paints[0].ts - dom) / 1000,
      followingFrameAfterDomMs: (nextFrame - dom) / 1000,
      paintEvents: paints.map(event => ({ offsetAfterDomMs: (event.ts - dom) / 1000, durationMs: (event.dur ?? 0) / 1000 })),
      layoutMs: row.metrics.LayoutDuration * 1000, styleMs: row.metrics.RecalcStyleDuration * 1000,
      scriptMs: row.metrics.ScriptDuration * 1000, taskMs: row.metrics.TaskDuration * 1000,
      layoutCount: row.metrics.LayoutCount, styleCount: row.metrics.RecalcStyleCount,
    });
  }
  writeFileSync(`${output}/${tag}.trace.json.gz`, gzipSync(JSON.stringify({ traceEvents: events })));
  const profile = JSON.parse(readFileSync(`${privateDirectory}/${tag}.cpuprofile`, 'utf8'));
  const nodes = new Map(profile.nodes.map(node => [node.id, node]));
  const parents = new Map(profile.nodes.flatMap(node => (node.children ?? []).map(id => [id, node.id])));
  const includesProposal = id => {
    while (id !== undefined) {
      if (nodes.get(id).callFrame.functionName === 'proposeRoundFromSnapshot') return true;
      id = parents.get(id);
    }
    return false;
  };
  const inclusiveProposalSampleMs = profile.samples.reduce((total, id, index) => total + (includesProposal(id) ? profile.timeDeltas[index] / 1000 : 0), 0);
  writeFileSync(`${output}/${tag}.cpu-summary.json`, JSON.stringify({
    scope: 'Separate sampled server CPU trace covering the three diagnostic actions; not per-request wall time',
    samplingIntervalMicros: 1000, inclusiveProposalSampleMs,
    caveat: 'Inclusive sampled method time is approximate; it must not be added to parent/child CPU totals or primary network/query spans.',
  }, null, 2) + '\n');
  writeFileSync(`${output}/${tag}.cpuprofile.gz`, gzipSync(JSON.stringify(profile)));
}
writeFileSync(`${output}/render.json`, JSON.stringify({ scope: 'One separate diagnostic round per viewport; these six observations are not among the primary60 and have no target/stopping role', observations }, null, 2) + '\n');
console.log(JSON.stringify(observations));
