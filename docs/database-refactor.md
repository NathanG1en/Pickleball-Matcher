# Database Refactor: Separation of Player Accounts and Group Players

**Branch:** `database-refactor`  
**Date:** October 13, 2026  
**Status:** Implemented & Verified  

---

## 1. Executive Summary

This refactor eliminates the single-table anti-pattern where user accounts (`player_accounts`) and group roster memberships (`players`) were previously consolidated into a single overloaded `players` table.

By decoupling user authentication and identity from group roster participation, we have restored a clean relational schema, simplified database queries, eliminated complex `CHECK` constraints and self-joins, and preserved 100% functional parity across all application workflows and tests.

---

## 2. Background & The Anti-Pattern

In an earlier iteration, the system attempted to represent both global user accounts and local group roster participants within a single `players` table using nullable columns:

- A **User Account** was represented by a `players` row where `group_id IS NULL` and `username IS NOT NULL`.
- A **Group Member** was represented by a `players` row where `group_id IS NOT NULL` and `account_id` pointed to another row in the same `players` table (a self-referential foreign key).
- A **Guest Player** was represented by a `players` row where `group_id IS NOT NULL` and `account_id IS NULL`.

### Problems with the Old Model:
1. **Confused Entity Semantics**: User authentication credentials (`password_hash`, `username`) and account profile data were mixed with group-specific roster state (`group_id`, `joined_at`).
2. **Fragile Constraints**: Required cumbersome `CHECK` constraints:
   ```sql
   CHECK (
     (group_id IS NULL AND username IS NOT NULL) OR
     (group_id IS NOT NULL AND (account_id IS NOT NULL OR username IS NULL))
   )
   ```
3. **Self-Referential Joins**: Simple roster listings required awkward self-joins:
   ```sql
   -- Old query
   SELECT p.*, a.username, a.rating
   FROM players p
   LEFT JOIN players a ON a.id = p.account_id
   WHERE p.group_id = $1
   ```
4. **Data Integrity Risks**: Deleting or updating a user account required careful differentiation between row types to avoid accidentally deleting or orphaning roster memberships or foreign keys in other tables (`groups`, `group_organizers`, `player_synergy`).

---

## 3. The New Architecture

The new architecture cleanly separates global user identity from group-specific participation:

```
+------------------------------------+          +------------------------------------+
|          player_accounts           |          |               groups               |
+------------------------------------+          +------------------------------------+
| id (PK)                            |<----+    | id (PK)                            |
| name                               |     |    | owner_account_id (FK) -------------+
| username (UNIQUE)                  |     |    | name, sport, etc.                  |
| password_hash                      |     |    +------------------------------------+
| skill_level                        |     |                      |
| gender, is_public                  |     |                      |
| rating, rd, vol                    |     |                      |
| matches_played, wins, losses       |     |                      |
| created_at, updated_at             |     |                      |
+------------------------------------+     |                      |
                 ^        ^                |                      |
                 |        |                |                      |
                 |        |                |                      |
                 |        |                |                      |
+----------------+        +-----------+    |                      |
|                                     |    |                      |
| (FK)                                | (FK)                      | (FK)
|                                     |    |                      |
+------------------------------------+|    |    +-----------------|------------------+
|          group_organizers          ||    |    |              players               |
+------------------------------------+|    |    +------------------------------------+
| group_id (FK) ----------------------+    |    | id (PK)                            |
| account_id (FK)                          |    | group_id (FK, NOT NULL) <----------+
| created_at                               |    | account_id (FK, NULLABLE) ---------+
+------------------------------------------+    | name                               |
                                                | rating, rd, vol                    |
+------------------------------------+          | matches_played, wins, losses       |
|           player_synergy           |          | joined_at, updated_at              |
+------------------------------------+          +------------------------------------+
| account_id_1 (FK) -----------------+
| account_id_2 (FK) -----------------+
| ...                                |
+------------------------------------+
```

### Table Roles:
- **`player_accounts`**: Owns authentication, login credentials, global player profile, and global competitive rating.
- **`players`**: Represents an active roster member or guest in a specific group. `group_id` is strictly `NOT NULL`. If linked to a registered user, `account_id` references `player_accounts(id)`. If an unregistered guest, `account_id` is `NULL`.

---

## 4. Migration Walkthrough

Migration file: [`migrations/202610130001_separate_player_accounts.sql`](file:///Users/nathanglen/Documents/ChatGPT/Pickleball%20Matcher/migrations/202610130001_separate_player_accounts.sql)

The migration performs the following steps safely inside a single transaction:
1. **Creates `player_accounts`** with primary key, audit timestamps, and rating columns.
2. **Backfills `player_accounts`** from any `players` record where `username IS NOT NULL`.
3. **Migrates Foreign Keys**:
   - Drops foreign keys referencing `players(id)` on `groups.owner_account_id`, `group_organizers.account_id`, `player_synergy.account_id_1`, `player_synergy.account_id_2`, and `players.account_id`.
   - Re-creates all foreign key constraints targeting `player_accounts(id) ON DELETE CASCADE`.
4. **Cleans `players`**:
   - Deletes all standalone user account rows from `players` (`WHERE group_id IS NULL`).
   - Adds `NOT NULL` constraint to `players.group_id`.
   - Drops `username`, `password_hash`, `skill_level`, and `is_public` columns from `players`.
   - Drops the legacy conditional check constraints.
5. **Applied to Environments**:
   - Dev/runtime database via `npm run db:migrate`.
   - Integration test database via `npm run db:migrate:test`.

---

## 5. Codebase Refactoring

### A. Postgres Repositories ([`src/lib/db/postgres-repositories.ts`](file:///Users/nathanglen/Documents/ChatGPT/Pickleball%20Matcher/src/lib/db/postgres-repositories.ts))

- **Account Management**:
  - `getPlayerAccount`, `getPlayerAccountByUsername`, `createPlayerAccount`, `updatePlayerAccountName`, `updatePlayerAccountUsername`, `updatePlayerAccountGender`, `updatePlayerPrivacy`, and `searchPlayerAccounts` now query `player_accounts` directly.
  - Eliminated all artificial filters such as `WHERE group_id IS NULL` and `username IS NOT NULL`.
- **Roster Listing (`listPlayers`)**:
  - Direct join between `players p` and `player_accounts a` (`LEFT JOIN player_accounts a ON a.id = p.account_id`).
  - Readily exposes global ratings and account details without self-referential ambiguity.
- **Rating Synchronization (`replaceRatingState`)**:
  - Updates group roster statistics in `players`.
  - Updates global account statistics in `player_accounts`.
  - Cascades rating updates across all group memberships tied to that `account_id`.

### B. SQLite Test Simulation Repository ([`tests/simulations/sqlite-repositories.ts`](file:///Users/nathanglen/Documents/ChatGPT/Pickleball%20Matcher/tests/simulations/sqlite-repositories.ts))

- Updated the in-memory SQLite schema initialization to define discrete `player_accounts` and `players` tables.
- Updated all simulated CRUD and transaction methods to match production behavior.

---

## 6. Verification & Quality Gates

The refactoring was validated against the entire project test suite:

| Test Suite | Result | Details |
| :--- | :--- | :--- |
| **Lint** (`npm run lint`) | **PASS** | 0 warnings, 0 errors. React 19 and Next.js rules satisfied. |
| **Typecheck** (`npm run typecheck`) | **PASS** | TypeScript strict checks passed across all modules. |
| **Unit & Component Tests** (`npm test`) | **PASS** | 44 test suites, 316 unit tests passed. |
| **Postgres Integration Tests** (`npm run test:integration`) | **PASS** | 4 suites, 20 tests passed against live migrated PostgreSQL database. |
| **Simulations** (`npm run test:simulation`) | **PASS** | 3 simulation suites, 6 tests passed for Elo & matchmaking fairness. |
| **Playwright End-to-End** (`npm run test:e2e`) | **PASS** | All specs passed across Mobile and Desktop browser configurations: |
| - `acceptance.spec.ts` | PASS | Group creation, roster setup, court generation, scoring, rounds. |
| - `corrections.spec.ts` | PASS | Score edits, cancellations, round undo, attendance adjustments. |
| - `permissions.spec.ts` | PASS | Organizer PIN, private group access control, rate limits. |
| - `resilience.spec.ts` | PASS | Multi-tab sync, validation recovery, Axe accessibility audits. |
| - `open-play.spec.ts` | PASS | Open play sessions, guest and account integration. |

---

## 7. Summary of Changes by File

- **[`migrations/202610130001_separate_player_accounts.sql`](file:///Users/nathanglen/Documents/ChatGPT/Pickleball%20Matcher/migrations/202610130001_separate_player_accounts.sql)**: DDL migration creating `player_accounts`, repointing foreign keys, and pruning `players`.
- **[`src/lib/db/postgres-repositories.ts`](file:///Users/nathanglen/Documents/ChatGPT/Pickleball%20Matcher/src/lib/db/postgres-repositories.ts)**: Cleaned repository methods to interact with `player_accounts` and `players` as discrete entities.
- **[`tests/simulations/sqlite-repositories.ts`](file:///Users/nathanglen/Documents/ChatGPT/Pickleball%20Matcher/tests/simulations/sqlite-repositories.ts)**: Aligned simulation repository schema and queries with the updated two-table model.
- **[`docs/database-refactor.md`](file:///Users/nathanglen/Documents/ChatGPT/Pickleball%20Matcher/docs/database-refactor.md)**: This documentation.
