import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createMaintenanceDatabase } from "./connection";
import { MaintenanceError, maintenanceTarget, parseCorrectionArgs } from "./options";
import { runRatingMaintenance } from "./service";

const help = `Correct a mistaken starting rating and replay rated match history.

Preview (default, read-only):
  npm run maintenance:correct-rating -- --environment test --username USERNAME --starting-rating 4.0 --reason "Wrong signup rating"

Apply after reviewing the preview:
  Add --apply --expected-starting-rating OLD_RATING
  For a legacy baseline outside the displayed scale, use --expected-starting-elo OLD_ELO instead.
  Production additionally requires --confirm-production production:USERNAME

Use displayed ratings from 2.0 to 8.0. Environment and reason are required.
Credentials: MAINTENANCE_TEST_DATABASE_URL or MAINTENANCE_PRODUCTION_DATABASE_URL.
Optional local secret file: .env.maintenance.local (never application DATABASE_URL).
The owner must provision two personal logins and bind the database target first.
See docs/operations/rating-maintenance.md.
`;

async function main() {
  if (process.argv.slice(2).includes("--help")) { process.stdout.write(help); return; }
  const request = parseCorrectionArgs(process.argv.slice(2));
  const local = resolve(".env.maintenance.local");
  if (existsSync(local)) process.loadEnvFile(local);
  const target = maintenanceTarget(request.environment, process.env);
  const database = createMaintenanceDatabase(target);
  try {
    const report = await runRatingMaintenance(database, request, target);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } finally {
    await database.end({ timeout: 5 });
  }
}

main().catch(error => {
  // Postgres/network errors can contain credential-bearing URLs or SQL data.
  const message = error instanceof MaintenanceError ? error.message : "Maintenance failed. Check database setup and the audit log before retrying; connection details were not printed.";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
