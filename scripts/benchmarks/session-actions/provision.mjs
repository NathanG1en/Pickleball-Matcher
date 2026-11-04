// Measurement infrastructure only. Never imports application code or modifies source databases.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { spawnSync } from 'node:child_process';
import postgres from 'postgres';

const [privateDirectory, ...names] = process.argv.slice(2);
assert.ok(privateDirectory && names.length, 'Usage: provision.mjs PRIVATE_DIRECTORY goal_NAME [...]');
for (const name of names) assert.match(name, /^goal_[a-z0-9_]+$/);
const directory = resolve(privateDirectory);
const sourceUrl = parseEnv(readFileSync(`${directory}/.env.source`, 'utf8')).DATABASE_URL;
assert.equal(new URL(sourceUrl).hostname, 'ep-summer-boat-b49oecxy.c-6.us-east-2.aws.neon.tech');
assert.equal(new URL(sourceUrl).pathname, '/neondb');
const source = postgres(sourceUrl, { max: 1, prepare: false });
const snapshotPath = `${directory}/fixture.private.json`;
let snapshot;
try {
  try { snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8')); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    snapshot = await source.begin('isolation level repeatable read read only', async sql => {
      const tables = await sql`select tablename from pg_tables where schemaname='public' order by tablename`;
      const edges = await sql`select distinct c.relname as child, p.relname as parent from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_class p on p.oid=k.confrelid join pg_namespace n on n.oid=c.relnamespace where k.contype='f' and n.nspname='public' and c.oid<>p.oid`;
      const rows = {};
      for (const { tablename } of tables) {
        rows[tablename] = (await sql`select row_to_json(t) as row from ${sql(tablename)} t`).map(item => item.row);
        rows[tablename].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
      }
      return { edges, rows };
    });
    writeFileSync(snapshotPath, JSON.stringify(snapshot), { mode: 0o600 });
  }
  // A benchmark database must never inherit production-bound maintenance logins/configuration.
  // Audit rows use CHECK(actor = session_user), so restoring another actor's audit is invalid.
  // These three tables are deliberately empty in every variant; operational history is unchanged.
  for (const table of ['rating_maintenance_target', 'rating_maintenance_operators', 'rating_correction_audit']) snapshot.rows[table] = [];
  const hash = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
  const pending = new Set(Object.keys(snapshot.rows).filter(name => name !== '_migrations'));
  const order = [];
  while (pending.size) {
    const ready = [...pending].filter(table => !snapshot.edges.some(edge => edge.child === table && pending.has(edge.parent)));
    assert.ok(ready.length, 'Foreign-key cycle needs explicit handling');
    for (const table of ready) { order.push(table); pending.delete(table); }
  }
  for (const name of names) {
    // No IF EXISTS/overwrite/reset: each run owns a newly created, separately named database.
    await source.unsafe(`CREATE DATABASE ${name}`);
    const direct = new URL(sourceUrl); direct.pathname = `/${name}`;
    const result = spawnSync(process.execPath, ['scripts/migrate.js'], { cwd: process.cwd(), env: { ...process.env, DATABASE_URL: String(direct) }, encoding: 'utf8' });
    assert.equal(result.status, 0, 'Migration failed; inspect privately without exposing credentials');
    const target = postgres(String(direct), { max: 1, prepare: false });
    try {
      await target.begin(async sql => {
        for (const table of order) if (snapshot.rows[table].length) {
          await sql`insert into ${sql(table)} select * from json_populate_recordset(null::${sql(table)}, ${sql.json(snapshot.rows[table])}::json)`;
        }
      });
      for (const table of order) {
        const actual = (await target`select row_to_json(t) as row from ${target(table)} t`).map(item => item.row);
        actual.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
        assert.deepEqual(actual, snapshot.rows[table], `Fixture differs: ${table}`);
      }
    } finally { await target.end(); }
    const pooled = new URL(direct); pooled.hostname = pooled.hostname.replace('ep-summer-boat-b49oecxy.', 'ep-summer-boat-b49oecxy-pooler.');
    writeFileSync(`${directory}/.env.${name}`, `DATABASE_URL=${pooled}\nSESSION_COOKIE_SECURE=false\nORGANIZER_SESSION_SECRET=goal-organizer-secret-at-least-thirty-two-bytes\nPLAYER_SESSION_SECRET=goal-player-secret-at-least-thirty-two-bytes\nORGANIZER_FINGERPRINT_SECRET=goal-fingerprint-secret-at-least-thirty-two-bytes\n`, { mode: 0o600 });
    mkdirSync(`${directory}/metadata`, { recursive: true });
    writeFileSync(`${directory}/metadata/${name}.json`, JSON.stringify({ name, source: 'isolated profiling branch', fixtureSha256: hash, tables: Object.fromEntries(order.map(table => [table, snapshot.rows[table].length])), equality: 'Every copied public row exactly equal; migration bookkeeping separately applied' }, null, 2) + '\n');
    console.log(`Created and verified ${name}: fixture ${hash}`);
  }
} finally { await source.end(); }
