// Launch only the frozen/candidate production export and isolated goal database.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, openSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { spawn } from 'node:child_process';

const [directoryArg, variant, database, tag] = process.argv.slice(2);
assert.match(variant ?? '', /^[a-z0-9-]+$/);
assert.match(database ?? '', /^goal_[a-z0-9_]+$/);
assert.match(tag ?? '', /^[a-z0-9-]+$/);
const directory = resolve(directoryArg);
const env = parseEnv(readFileSync(`${directory}/.env.${database}`, 'utf8'));
assert.equal(new URL(env.DATABASE_URL).hostname, 'ep-summer-boat-b49oecxy-pooler.c-6.us-east-2.aws.neon.tech');
assert.equal(new URL(env.DATABASE_URL).pathname, `/${database}`);
const app = `${directory}/${variant}`;
const log = openSync(`${directory}/${tag}.server.log`, 'a');
const preload = resolve('scripts/benchmarks/session-actions/preload.cjs');
const inspector = process.env.GOAL_INSPECT_PORT;
if (inspector) assert.equal(inspector, '9235');
const child = spawn(process.execPath, [...(inspector ? ['--inspect=127.0.0.1:9235'] : []), '--require', preload, `${app}/node_modules/next/dist/bin/next`, 'start', '--hostname', '127.0.0.1', '--port', '3125'], {
  cwd: app, env: { ...process.env, ...env, CLUB_PROFILE_TRACE: `${directory}/${tag}.requests.jsonl`, NODE_ENV: 'production' }, detached: true, stdio: ['ignore', log, log],
});
child.unref();
writeFileSync(`${directory}/${tag}.pid`, String(child.pid));
console.log(`Goal profiling server ${child.pid}: ${variant}, ${database}, port 3125`);
