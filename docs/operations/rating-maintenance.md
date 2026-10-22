# Correcting a mistaken starting rating

This is a terminal-only maintenance tool. It reuses the application's Elo calculation and completion-time/match-ID ordering. It corrects an account's starting rating and replays rated doubles history globally, including registered accounts in multiple groups. Scores, winners, timestamps, lineups, attendance, and session history are preserved. Singles and unrated games do not affect Elo. Accounts without any group membership are supported.

## Access and initial setup

The implementation is **unconfigured by default**. The migration adds no personal logins or environment registrations. Only the two people registered by the database owner can use maintenance credentials. The script verifies the actual authenticated database login (`SESSION_USER`), not an actor flag, app username, organizer PIN, or OS username. It rejects owner/elevated database credentials. A third login cannot read/write rating data through the maintenance role's RLS policies, even if accidentally granted that group role.

The database owner remains able to bypass these restrictions or change the registry. Keep owner credentials private. The two maintenance logins are trusted operators: their granted rating-column privileges also permit direct SQL rating updates. The command adds a controlled workflow; it cannot force trusted credential holders to run only this file.

1. Review and apply `migrations/202610220001_rating_maintenance.sql` through the normal migration process, first on an isolated test branch. Use the **direct** owner connection for migrations. Do not substitute production into test setup commands.
2. As the owner, register the environment, exact direct hostname, port, database, and two new role names. For example, after replacing all target values:

   ```sh
   psql "$ADMIN_DATABASE_URL" \
     -v environment=test \
     -v database_host=YOUR_DIRECT_TEST_HOST \
     -v database_port=5432 \
     -v maintainer_one=rating_maint_nathan \
     -v maintainer_two=rating_maint_cocontributor \
     -f scripts/maintenance/provision.sql
   ```

   The hostname must be lowercase and match the credential URL exactly. The database name is bound to the database receiving this setup. Existing registrations or role names fail instead of silently replacing access. The two-slot registry cannot hold a third operator.
3. In an owner `psql` session, set separate passwords using hidden prompts and then activate the personal logins:

   ```text
   \password rating_maint_nathan
   \password rating_maint_cocontributor
   ALTER ROLE rating_maint_nathan LOGIN;
   ALTER ROLE rating_maint_cocontributor LOGIN;
   ```

   Each person receives only their own credential. Create these roles with SQL, not the Neon Console/API: [Neon's role documentation](https://neon.com/docs/manage/roles) explains that Console/API-created roles inherit elevated `neon_superuser` membership, whereas SQL-created roles can receive limited grants.
4. Each person copies `.env.maintenance.example` to `.env.maintenance.local`, sets file permissions to `600`, and adds their own direct connection URLs. This local file is gitignored. URL-encode password characters. Never put credentials in command arguments, Git, screenshots, or chat. Exported maintenance variables can also be used.

   ```sh
   cp .env.maintenance.example .env.maintenance.local
   chmod 600 .env.maintenance.local
   ```

   The only connection variables accepted are `MAINTENANCE_TEST_DATABASE_URL` and `MAINTENANCE_PRODUCTION_DATABASE_URL`. The command never loads application `.env.local` and never falls back to `DATABASE_URL` or `TEST_DATABASE_URL`. Host, port (5432 if omitted), and database are pinned to the validated URL. Pooler endpoints and URL parameters other than `sslmode` are rejected. If copying a Neon connection string, remove `channel_binding`: this installed postgres.js client does not support that option.

Repeat setup separately for production, using that database's own environment/host binding and personal credentials. A copied Neon branch retains its parent's registrations, so it must be explicitly rebound by the owner before the tool will run there.

## Preview: default, read-only

```sh
npm run maintenance:correct-rating -- \
  --environment test \
  --username n8themid \
  --starting-rating 4.0 \
  --reason "Incorrect starting rating entered at signup"
```

Ratings use the displayed 2.0–8.0 scale, not raw Elo. The report includes the verified database and actor, old/new starting Elo and displayed ratings, processed match count, and every changed player's current before/after rating with their group IDs. A preview uses a read-only database transaction and writes no baseline, rating snapshots, or audit rows. Both exact numeric Elo and formatted ratings are included because a small change may round to the same displayed value.

## Apply

After reviewing the preview, repeat the command with `--apply` and the exact old starting rating from the report:

```sh
npm run maintenance:correct-rating -- \
  --environment test \
  --username n8themid \
  --starting-rating 4.0 \
  --expected-starting-rating 3.5 \
  --reason "Incorrect starting rating entered at signup" \
  --apply
```

For a legacy baseline outside the displayed range, supply `--expected-starting-elo` with the exact `oldStartingElo` instead. These expectation flags are mutually exclusive. An unchanged starting rating or stale expectation is rejected.

Production additionally requires `--environment production` and `--confirm-production production:n8themid`. Nothing selects production implicitly.

Apply takes fixed, non-waiting ACCESS EXCLUSIVE table locks on the global rating inputs. If another transaction is reading or writing those tables, it aborts with a busy message. This also protects against older deployed guest-link code that reads a baseline without a row lock. Guest linking in the updated app additionally locks its account before reading the baseline. Once maintenance holds the locks, reads and writes may briefly wait for the correction to finish. Run when scoring and account linking are idle. See [PostgreSQL's lock semantics](https://www.postgresql.org/docs/current/sql-lock.html).

The baseline update (account plus all memberships), global rating replay, all before/after snapshots, and audit insert commit together. A persistence or audit failure rolls back all of them. Apply recalculates from the latest locked history; a preview is a point-in-time report, not a reservation of that history. No score or result is rewritten. A successful run returns its correction ID. Reload open profile/group/session pages to fetch the new ratings; the CLI adds no web endpoint or background polling.

## Audit and revocation

From your personal maintenance database session:

```sql
select id, performed_at, actor, environment, username,
       old_starting_elo, new_starting_elo, reason, report
from rating_correction_audit
order by performed_at desc;
```

Audit entries use the database login as their actor. Personal logins can append and read authorized audit records, but cannot update/delete them, modify registrations, or read password hashes. The owner can inspect and administer everything.

To revoke a maintainer, the owner removes their registry row, revokes `pickleball_rating_maintenance` from their login, and disables that login. Terminate existing sessions if immediate credential revocation is required. To replace them, create a new basic personal role, grant the maintenance group, and fill the vacant registry slot. Never share a surviving person's credentials.

To reverse a mistaken correction, preview another correction to the former starting rating and apply it with a reason. This replays the **current** history and creates a new audit entry; it is not an exact database restore if match history has since changed.

## Verification

```sh
npm run lint
npm run typecheck
npm test
npm run test:simulation
MAINTENANCE_TEST_ADMIN_URL=postgresql://LOCAL_TEST_OWNER@127.0.0.1:LOCAL_PORT/postgres npm run test:maintenance
npm run test:e2e
```

The maintenance integration runner requires an explicitly supplied loopback Postgres server. It creates a uniquely named empty database, applies all migrations, runs tests with two distinct basic logins and a third rejected login, then drops only the database it created. It never loads app credentials or resets a shared Neon branch. CI runs it against its disposable Postgres service.
