<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project Instructions & Agent Guidelines

## 1. Test Updates & End-to-End (E2E) Guidelines

### Page Documentation
- Maintain user-facing page and flow documentation in `docs/pages/`, organized by area (for example, `profile.md`, `groups.md`, and `sessions.md`). These docs describe the current UI and user-visible behavior, including important states, actions, navigation, and permissions.
- Before committing any change that affects a page, component, route, or user flow, update the documentation for every affected page in the same commit. If the relevant page documentation does not exist yet, create it as part of the change.
- Keep page docs aligned with the shipped behavior; do not use them as a change log. Link to existing feature or architecture docs when they provide deeper implementation context.

### Mandatory Test Updates Before Running Tests
**Every time a change is made, you MUST edit and update all necessary tests—including unit, integration, and E2E tests—BEFORE running them.**
- Never run tests against stale expectations or outdated assertions. Proactively update test files to reflect changes to behavior, UI elements, data models, or user flows before executing any test commands.
- **Fast Static Grep Protocol (DO NOT run the full E2E test suite):**
  - **Changed UI Text / Badges**: Whenever user-visible text changes (e.g. changing badge labels like "Public" → "Everyone", button text, status badges, or headers), you MUST run `grep_search` across `tests/e2e/` for the old string to find and update all assertions in specs (such as `permissions.spec.ts`, `acceptance.spec.ts`, and `resilience.spec.ts`). This is a fast, sub-second static inspection.
  - **Database Column Additions**: Whenever you add or query a new column on `player_accounts`, check `migrations/` to ensure the `pickleball_rating_maintenance` role is granted SELECT access if the column is read in shared repository queries like `listPlayers()`.
- For every page or user-flow change, review all affected specs under `tests/e2e/` and `tests/e2e/test-helpers.ts` using static search so test files remain synchronized in the same commit.

### E2E Test Guidelines
When making changes to:
- **Authentication & Authorization** (e.g. player signup, login, session cookies).
- **Group Creation & Onboarding** (e.g. `/setup`, group forms, visibility, redirect targets).
- **Group Dashboard & Navigation** (e.g. `/g/[groupId]`, header actions, roster links, back buttons).
- **Session & Matchmaking Workflows** (e.g. `/sessions/new`, court counts, attendance, round generation, scoring, attendance adjustments, round undo).
- **Accessibility & ARIA Attributes** (e.g. labels, roles, Axe audits).

**CRITICAL: Do NOT run the full 8-minute Playwright suite (`npm run test:e2e`).**
- Running the full suite takes 8+ minutes and is forbidden during standard iterative tasks.
- Verify changes using static inspection, `npm run typecheck`, `npm run lint`, and fast Vitest unit/component tests (`npm test`, ~4s).
- If you specifically need to verify an E2E test case, run ONLY that single targeted line (e.g. `npx playwright test tests/e2e/permissions.spec.ts:498`), never the whole suite.

Key E2E specs for reference:
- `tests/e2e/acceptance.spec.ts` (PRD acceptance: group creation, roster setup, court generation, match scoring, round progression)
- `tests/e2e/corrections.spec.ts` (Match score edits, cancellations, round undos, mid-session attendance)
- `tests/e2e/permissions.spec.ts` (Private group access control, member permissions, role transfers)
- `tests/e2e/resilience.spec.ts` (Draft score preservation on validation errors, multi-tab sync, accessibility audits)
- `tests/e2e/test-helpers.ts` (Shared helpers such as `createAndSignInPlayer` and `createTestGroup`)

## 2. Key Architecture & Flow Reminders
- **Player Accounts**: Group creation requires an authenticated player account. The creator is automatically added to the group roster as the host player. Account for the host player in expected player counts (e.g., host + 13 added players = 14 players on roster).
- **Client Hydration**: Client components use `useSyncExternalStore` for SSR-safe hydration markers (`data-hydrated="true"`) to prevent premature browser form submissions before React attaches event listeners.
- **Fast Quality Checks**: Ensure necessary tests are updated before running quality checks:
  - `npm run lint` (ESLint with Next.js & React 19 rules)
  - `npm run typecheck` (TypeScript)
  - `npm test` (Fast Vitest unit and component tests)
  - `npm run test:simulation` (When rating or matchmaking algorithms are modified)
  - `npm run test:e2e` (Optional / on-demand only; update relevant tests before running, and do not run automatically every time)

## 3. Git & Commit Guidelines
- **Commit Per User Request**: Make a separate Git commit each time the user asks to make a change.
- **Commit Page Documentation with Behavior**: Every commit that changes a user-facing page or flow must include the updated or newly created documentation for each affected page in `docs/pages/`, along with all affected E2E updates.
- **Commit Message Style**: Do not add prefixes like `bug(...)`, `fix(...)`, `feat(...)`, etc. Simply explain the change made in plain, descriptive language.
