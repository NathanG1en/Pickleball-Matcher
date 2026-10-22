import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { readdir, readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import postgres from "postgres";
import { PostgresRepositories } from "@/lib/db/postgres-repositories";
import { replayRatings } from "@/lib/domain/rating-replay";
import { parseCorrectionArgs, maintenanceTarget } from "../../scripts/maintenance/options";
import { runRatingMaintenance } from "../../scripts/maintenance/service";

const databaseUrl = process.env.MAINTENANCE_INTEGRATION_DATABASE_URL;
if (!databaseUrl) throw new Error("Use a fresh disposable local MAINTENANCE_INTEGRATION_DATABASE_URL.");
const location = new URL(databaseUrl);
if (!["localhost", "127.0.0.1"].includes(location.hostname) || !/^\/rating_maintenance_test(?:_\w+)?$/.test(location.pathname)) {
  throw new Error("Maintenance integration tests require a dedicated local rating_maintenance_test database.");
}
const admin = postgres(databaseUrl, { max: 2, onnotice: () => {} });
const login = (name: string) => {
  const url = new URL(databaseUrl);
  url.username = name;
  url.password = "fixture-password";
  return url.toString();
};
const person1 = postgres(login("rating_test_person1"), { max: 1 });
const person2 = postgres(login("rating_test_person2"), { max: 1 });
const third = postgres(login("rating_test_third"), { max: 1 });
const target = maintenanceTarget("test", { MAINTENANCE_TEST_DATABASE_URL: login("rating_test_person1") });
const argumentsFor = (apply = false, username = "alice") => ["--environment", "test", "--username", username, "--starting-rating", "4", "--reason", "Correct signup error", ...(apply ? ["--apply", "--expected-starting-rating", "3.5"] : [])];
const request = (apply = false, username = "alice") => parseCorrectionArgs(argumentsFor(apply, username));

async function state() {
  return {
    accounts: [...await admin`select id, initial_rating, rating, rated_games_played from player_accounts order by id`],
    players: [...await admin`select id, initial_rating, rating, rated_games_played from players order by id`],
    snapshots: [...await admin`select * from match_players order by match_id, player_id`],
    games: [...await admin`select * from matches order by id`],
  };
}

beforeAll(async () => {
  const existing = await admin`select tablename from pg_tables where schemaname = 'public'`;
  if (existing.length) throw new Error("Refusing to reset a nonempty database; create a fresh disposable test database.");
  // This dedicated database is created by the test runner/CI, never a shared Neon branch.
  await admin.unsafe("do $$ begin if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if; end $$;");
  for (const file of (await readdir("migrations")).filter(name => name.endsWith(".sql")).sort()) {
    await admin.unsafe(await readFile(`migrations/${file}`, "utf8"));
  }
  for (const role of ["rating_test_person1", "rating_test_person2", "rating_test_third"]) {
    const existingRole = await admin`select oid from pg_roles where rolname = ${role}`;
    if (!existingRole.length) await admin.unsafe(`create role ${role} login`);
    await admin.unsafe(`grant pickleball_rating_maintenance to ${role}`);
  }
  await admin`insert into rating_maintenance_target (environment, database_host, database_port, database_name) values ('test', ${target.hostname}, ${target.port}, ${target.database})`;
  await admin`insert into rating_maintenance_operators values (1, 'rating_test_person1', 'First maintainer'), (2, 'rating_test_person2', 'Second maintainer')`;
});

beforeEach(async () => {
  await admin.unsafe("truncate groups, player_accounts, rating_correction_audit cascade; grant insert on rating_correction_audit to pickleball_rating_maintenance;");
  await admin`update rating_maintenance_target set environment = 'test', database_host = ${target.hostname}`;
  await admin`insert into player_accounts (id, username, name, password_hash, skill_level, initial_rating, rating) values
    ('alice-account', 'alice', 'Alice', 'not-a-real-password', 'intermediate', 1000, 1000),
    ('bob-account', 'bobby', 'Bob', 'not-a-real-password', 'intermediate', 1000, 1000),
    ('dormant-account', 'dormant', 'Dormant', 'not-a-real-password', 'intermediate', 1000, 1000)`;
  await admin`insert into groups (id, name, organizer_pin_hash) values ('g1', 'One', 'unused'), ('g2', 'Two', 'unused')`;
  const players = [
    ["a1", "g1", "Alice", "alice-account"], ["a2", "g2", "Alice", "alice-account"],
    ["b1", "g1", "Bob", "bob-account"], ["b2", "g2", "Bob", "bob-account"],
    ["c1", "g1", "Cara", null], ["d1", "g1", "Dan", null],
    ["e2", "g2", "Eve", null], ["f2", "g2", "Finn", null], ["h2", "g2", "Gale", null],
  ];
  for (const [id, group, name, account] of players) {
    await admin`insert into players (id, group_id, name, account_id, initial_rating, rating) values (${id}, ${group}, ${name}, ${account}, 1000, 1000)`;
  }
  for (const [index, group] of ["g1", "g2"].entries()) {
    const when = new Date(Date.UTC(2026, 9, 1, 12, index));
    await admin`insert into sessions (id, group_id, court_count, status, started_at, ended_at) values (${`s${index}`}, ${group}, 1, 'completed', ${when}, ${when})`;
    await admin`insert into rounds (id, session_id, round_number, status, seed, score_breakdown, started_at) values (${`r${index}`}, ${`s${index}`}, 1, 'completed', 1, '{}', ${when})`;
    await admin`insert into matches (id, round_id, court_number, status, team1_score, team2_score, completed_at) values (${`m${index}`}, ${`r${index}`}, 1, 'completed', 11, 5, ${when})`;
    const ids = index === 0 ? ["a1", "b1", "c1", "d1"] : ["b2", "e2", "f2", "h2"];
    for (const [slot, id] of ids.entries()) {
      await admin`insert into match_players (match_id, player_id, team) values (${`m${index}`}, ${id}, ${slot < 2 ? 1 : 2})`;
    }
  }
  await replayRatings("", new PostgresRepositories(admin));
});

afterAll(async () => { await Promise.all([person1.end(), person2.end(), third.end(), admin.end()]); });

describe("real maintenance database boundary", () => {
  it("allows both registered personal logins to preview without changing any state", async () => {
    const before = await state();
    const preview = await runRatingMaintenance(person1, request(), target);
    expect(preview.applied).toBe(false);
    expect(preview.actor).toBe("rating_test_person1");
    expect(preview.changes.some(change => change.accountId === "bob-account")).toBe(true);
    expect(preview.changes.some(change => change.playerIds.includes("h2"))).toBe(true);
    expect((await runRatingMaintenance(person2, request(), target)).actor).toBe("rating_test_person2");
    expect(await state()).toEqual(before);
    expect(await admin`select * from rating_correction_audit`).toHaveLength(0);
  });
  it("rejects a third login even with the maintenance group grant, and prevents a third registration", async () => {
    await expect(runRatingMaintenance(third, request(true), target)).rejects.toThrow(/authorized/i);
    expect(await third`select id from player_accounts`).toHaveLength(0);
    expect(await third`update player_accounts set initial_rating = 1200 returning id`).toHaveLength(0);
    await expect(admin`insert into rating_maintenance_operators values (3, 'rating_test_third', 'Third')`).rejects.toMatchObject({ code: "23514" });
    expect((await admin`select initial_rating from player_accounts where username = 'alice'`)[0].initial_rating).toBe(1000);
  });
  it("rejects owner/application credentials, unregistered environments and copied host bindings", async () => {
    await expect(runRatingMaintenance(admin, request(), target)).rejects.toThrow(/authorized/i);
    await admin`update rating_maintenance_target set environment = 'production'`;
    await expect(runRatingMaintenance(person1, request(true), target)).rejects.toThrow(/target/i);
    await admin`update rating_maintenance_target set environment = 'test', database_host = 'different-host'`;
    await expect(runRatingMaintenance(person1, request(true), target)).rejects.toThrow(/target/i);
  });
  it("applies once, propagates across groups, preserves results, and records the real actor and changes", async () => {
    const before = await state();
    const preview = await runRatingMaintenance(person1, request(), target);
    const applied = await runRatingMaintenance(person1, request(true), target);
    expect(applied.applied).toBe(true);
    expect(applied.changes).toEqual(preview.changes);
    const after = await state();
    expect(after.games).toEqual(before.games);
    expect(after.players.filter(p => p.id === "a1" || p.id === "a2").map(p => p.initial_rating)).toEqual([1200, 1200]);
    expect(after.accounts.find(p => p.id === "alice-account")?.initial_rating).toBe(1200);
    expect(after.players.find(p => p.id === "h2")?.rating).not.toBe(before.players.find(p => p.id === "h2")?.rating);
    const audit = await admin`select * from rating_correction_audit`;
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ actor: "rating_test_person1", old_starting_elo: 1000, new_starting_elo: 1200, reason: "Correct signup error" });
    expect(audit[0].report.changes).toEqual(applied.changes);
    await expect(runRatingMaintenance(person1, request(true), target)).rejects.toThrow(/changed|already/i);
  });
  it("corrects an account with no roster membership or games", async () => {
    await runRatingMaintenance(person2, request(true, "dormant"), target);
    expect((await admin`select initial_rating, rating, rated_games_played from player_accounts where username = 'dormant'`)[0]).toMatchObject({ initial_rating: 1200, rating: 1200, rated_games_played: 0 });
  });
  it("can correct a legacy raw baseline without relying on a clamped display value", async () => {
    await admin`update player_accounts set initial_rating = 100, rating = 100 where username = 'dormant'`;
    const args = [...argumentsFor(false, "dormant"), "--apply", "--expected-starting-elo", "100"];
    await runRatingMaintenance(person1, parseCorrectionArgs(args), target);
    expect((await admin`select initial_rating from player_accounts where username = 'dormant'`)[0].initial_rating).toBe(1200);
  });
  it("rolls back baseline and all rating snapshots when the audit cannot be written", async () => {
    const before = await state();
    await admin.unsafe("revoke insert on rating_correction_audit from pickleball_rating_maintenance");
    await expect(runRatingMaintenance(person1, request(true), target)).rejects.toThrow();
    expect(await state()).toEqual(before);
    expect(await admin`select * from rating_correction_audit`).toHaveLength(0);
  });
  it("protects registration, passwords and append-only audit records from maintenance logins", async () => {
    await expect(person1`update rating_maintenance_operators set database_role = 'rating_test_third' where slot = 1`).rejects.toMatchObject({ code: "42501" });
    await expect(person1`select password_hash from player_accounts`).rejects.toMatchObject({ code: "42501" });
    await runRatingMaintenance(person1, request(true), target);
    await expect(person1`delete from rating_correction_audit`).rejects.toMatchObject({ code: "42501" });
    await expect(person1`update rating_correction_audit set actor = 'rating_test_person2'`).rejects.toMatchObject({ code: "42501" });
    await expect(person1.unsafe("set role rating_test_person2")).rejects.toMatchObject({ code: "42501" });
    await expect(person1`insert into rating_correction_audit (id, actor, environment, account_id, username, old_starting_elo, new_starting_elo, reason, report)
      values ('spoof', 'rating_test_person2', 'test', 'alice-account', 'alice', 1000, 1200, 'Forged actor', '{}')`).rejects.toThrow();
  });
  it("refuses an apply while match results are being written instead of racing a replay", async () => {
    let release!: () => void;
    let acquired!: () => void;
    const ready = new Promise<void>(resolve => { acquired = resolve; });
    const hold = new Promise<void>(resolve => { release = resolve; });
    const writer = admin.begin(async tx => {
      await tx.unsafe("update matches set version = version + 1 where id = 'm0'");
      acquired();
      await hold;
    });
    await ready;
    try { await expect(runRatingMaintenance(person1, request(true), target)).rejects.toThrow(/busy|write/i); }
    finally { release(); await writer; }
    expect((await admin`select initial_rating from player_accounts where username = 'alice'`)[0].initial_rating).toBe(1000);
  });
  it("runs the actual terminal command with dedicated credentials and no application URL fallback", async () => {
    const execute = promisify(execFile);
    const env = { ...process.env, MAINTENANCE_TEST_DATABASE_URL: login("rating_test_person1") };
    const result = await execute(process.execPath, ["--import", "tsx", "scripts/maintenance/correct-rating.ts", ...argumentsFor()], { env });
    expect(JSON.parse(result.stdout).applied).toBe(false);
    expect(result.stdout + result.stderr).not.toContain("fixture-password");
    await execute(process.execPath, ["--import", "tsx", "scripts/maintenance/correct-rating.ts", ...argumentsFor(true)], { env });
    expect(await admin`select * from rating_correction_audit`).toHaveLength(1);
  });
  it("coordinates guest linking before its baseline read with maintenance", async () => {
    let release!: () => void;
    let readAccount!: () => void;
    const ready = new Promise<void>(resolve => { readAccount = resolve; });
    const hold = new Promise<void>(resolve => { release = resolve; });
    // Pause the actual linking transaction after its account SELECT completes.
    // This reproduces a maintenance apply between reading and using the baseline.
    const linkingDatabase = new Proxy(admin, {
      get(database, key, receiver) {
        if (key !== "begin") return Reflect.get(database, key, receiver);
        return (operation: (tx: postgres.TransactionSql) => Promise<unknown>) => database.begin(tx => operation(new Proxy(tx, {
          apply(query, receiver, args) {
            // postgres.js's TransactionSql mapped type omits its callable signature.
            const pending = Reflect.apply(query as unknown as postgres.Sql, receiver, args) as Promise<unknown>;
            if (Array.isArray(args[0]) && args[0].join("").includes("from player_accounts")) {
              return pending.then(async (rows: unknown) => { readAccount(); await hold; return rows; });
            }
            return pending;
          },
        })));
      },
    });
    const linking = new PostgresRepositories(linkingDatabase).linkGuestPlayer("g1", "c1", "dormant-account");
    await ready;
    try {
      await expect(runRatingMaintenance(person1, request(true, "dormant"), target)).rejects.toThrow(/busy|write/i);
    } finally { release(); await linking; }
    await runRatingMaintenance(person1, request(true, "dormant"), target);
    const corrected = await state();
    expect(corrected.players.find(player => player.id === "c1")?.initial_rating).toBe(1200);
    const beforeReplay = await state();
    await replayRatings("", new PostgresRepositories(admin));
    expect(await state()).toEqual(beforeReplay);
  });
  it("refuses apply while older deployed code holds a baseline read without a row lock", async () => {
    let release!: () => void;
    let acquired!: () => void;
    const ready = new Promise<void>(resolve => { acquired = resolve; });
    const hold = new Promise<void>(resolve => { release = resolve; });
    const reader = admin.begin(async tx => {
      await tx.unsafe("select initial_rating from player_accounts where username = 'alice'");
      acquired();
      await hold;
    });
    await ready;
    try { await expect(runRatingMaintenance(person1, request(true), target)).rejects.toThrow(/busy|write/i); }
    finally { release(); await reader; }
    expect((await admin`select initial_rating from player_accounts where username = 'alice'`)[0].initial_rating).toBe(1000);
  });
});
