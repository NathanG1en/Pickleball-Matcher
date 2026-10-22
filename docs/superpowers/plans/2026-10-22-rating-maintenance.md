# Rating Maintenance Implementation Plan

**Goal:** Implement the approved terminal-only correction workflow for two individually authorized maintainers, with read-only preview, explicit environment selection, atomic global replay, and an audit trail.

**Architecture:** Extract a pure rating calculation from the existing replay service. A CLI authenticates using dedicated Postgres credentials and database-owned environment/operator registrations. Apply locks rating source tables without waiting, calculates from the locked history, and saves the baseline, replay, and audit in one transaction. No web endpoint is added.

**Tech stack:** Existing TypeScript, postgres.js, Zod, Vitest, Playwright; tsx is development-only CLI tooling.

## Constraints and interfaces

- Existing Elo math, ordering, cancelled/unrated-match behavior, and cross-group account identity must be preserved.
- `calculateRatingReplay(players, matches)` returns replayed players, all snapshots, and processed match IDs without writing or mutating inputs; `replayRatings` remains the existing persistence wrapper.
- `parseCorrectionArgs(argv)` requires environment, username, rating in the displayed 2.0–8.0 scale, and reason; preview is default. Apply requires an explicit expected old starting rating; production apply also requires a typed target confirmation.
- `runRatingMaintenance(sql, request, target)` validates the actual database login, an owner-managed two-slot operator registry, direct host/database binding, and environment before reading private rating data or writing anything.
- Credentials are read only from `MAINTENANCE_TEST_DATABASE_URL` / `MAINTENANCE_PRODUCTION_DATABASE_URL`, optionally in gitignored `.env.maintenance.local`. No application DATABASE_URL fallback.
- Registration and credentials are provisioned explicitly by the owner. Implementation/testing will not change production or either real maintainer's credentials.
- Apply refuses concurrent history writes using NOWAIT table locks. Lock acquisition is a fixed, restricted SECURITY DEFINER function; maintenance roles get only required column updates and append-only audit access.
- Remove starting-rating updates from the ordinary organizer action/schema.

## Review focus

Missing or mismatched target registration; spoofed actor/role and third maintainer; cross-group propagation and accounts without roster memberships; concurrent scoring and stale expectations; rollback if audit or persistence fails.

## Tasks

### 1. Pure replay calculation
- [x] Write a failing test for write-free replay, unchanged inputs, and existing replay equivalence.
- [x] Extract calculation and keep the existing wrapper interface; run replay, domain, and simulation tests.

### 2. Maintenance command and database boundary
- [x] Write failing parser/preview tests and real Postgres tests for both authorized logins, rejected third login, environment/host mismatch, read-only previews, cross-group corrections, no-membership accounts, stale baseline, concurrency refusal, and rollback/audit integrity.
- [x] Add a migration for operator/config/audit tables and a restricted lock function; no initial operator or environment registrations.
- [x] Implement CLI parsing, safe error reporting, dedicated credential loading, dry-run calculation, global persistence and audit, and production confirmation.
- [x] Reject initialRating through ordinary organizer updates and test authorization/unchanged rating state.
- [x] Verify actual CLI execution against an isolated, disposable local Postgres cluster; no shared database reset.

### 3. Operational instructions and verification
- [x] Document SQL provisioning of two non-owner logins, protected credentials, target binding, preview/apply, audit inspection, revocation, rollback semantics, and app cache behavior.
- [x] Update and run relevant permission E2E coverage; run lint, typecheck, unit/component, simulation, and E2E gates.
- [x] Obtain one independent review of the full change, fix important findings with regression tests, and report provisioning still required before real use.

## Independent review and regression verification

The independent review found three important issues. Each was addressed with regression coverage: guest linking now locks its account before reading a baseline and maintenance takes exclusive NOWAIT table locks; the connection explicitly pins validated host/port/database instead of inheriting PGPORT; unsupported channel_binding URLs are rejected clearly. The guest-link race test failed before the fix and passed afterward.

Owner provisioning was smoke-tested on a fresh disposable local database: two basic NOLOGIN roles and the correct target binding were created; repeating setup failed atomically without leaving new roles. No real maintainer credentials or shared database registrations were configured.

Final verification: lint and TypeScript passed; 411 unit/component tests, 7 simulations, and 11 real maintenance Postgres tests passed. The full E2E run passed 81 of 82 cases; its sole failure was the newly added test expecting `2.0` instead of the UI's formatted `2`. After correcting that assertion, both mobile/desktop linking tests passed without retries, and Playwright's final `--last-failed` run passed its single remaining case. The organizer payload-injection regression passed on both devices. No observed failures remain. The owned disposable Postgres server was stopped after testing; the user's localhost:3000 server was preserved.

Deployment compatibility verification: production can still run older guest-link code without the new row lock. Maintenance now uses ACCESS EXCLUSIVE NOWAIT locks so existing plain readers also prevent an apply. The added regression failed under EXCLUSIVE and passed under ACCESS EXCLUSIVE; all 12 maintenance database tests, lint, and TypeScript passed. The stronger lock and actual CLI were also rehearsed on an isolated Neon production copy before production activation. Reads and writes can briefly wait while apply holds the lock; the operations guide documents this.
