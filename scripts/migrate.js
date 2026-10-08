import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required. Add it to .env or export it before running migrations.");
}

const sql = postgres(connectionString, { prepare: false });

async function run() {
  const isReset = process.argv.includes("--reset");

  if (isReset) {
    console.log("Resetting database schema...");
    await sql.unsafe("drop schema if exists public cascade; create schema public;");
  }

  await sql.unsafe(`
    do $$
    begin
      if not exists (select from pg_roles where rolname = 'anon') then
        create role anon;
      end if;
    end
    $$;
    create table if not exists _migrations (name text primary key, applied_at timestamptz default now());
  `);

  const migrationsDir = path.resolve(process.cwd(), "migrations");
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const applied = await sql`select name from _migrations`;
  const appliedSet = new Set(applied.map((r) => r.name));

  // If tables already exist without _migrations record, only mark the initial
  // schema as applied. Later migrations must still run against that schema.
  if (!isReset && !appliedSet.has("202610060001_initial_schema.sql")) {
    const tableCheck = await sql`
      select to_regclass('public.groups') as exists;
    `;
    if (tableCheck[0]?.exists) {
      console.log("Existing schema detected; marking initial migrations as applied.");
      const initialSchema = "202610060001_initial_schema.sql";
      await sql`insert into _migrations (name) values (${initialSchema}) on conflict do nothing`;
      appliedSet.add(initialSchema);
    }
  }

  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`Skipping already applied migration: ${file}`);
      continue;
    }
    console.log(`Running migration: ${file}`);
    const content = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
    await sql.unsafe(content);
    await sql`insert into _migrations (name) values (${file})`;
  }

  console.log("Migrations complete.");
  await sql.end();
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
