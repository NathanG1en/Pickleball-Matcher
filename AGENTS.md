<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project Instructions & Agent Guidelines

## 1. End-to-End (E2E) Test Maintenance Requirement

Whenever you make changes to:
- **Authentication & Authorization** (e.g. player signup, login, session cookies, organizer PIN).
- **Group Creation & Onboarding** (e.g. `/setup`, group forms, visibility, redirect targets).
- **Group Dashboard & Navigation** (e.g. `/g/[groupId]`, header actions, roster links, back buttons).
- **Session & Matchmaking Workflows** (e.g. `/sessions/new`, court counts, attendance, round generation, scoring, attendance adjustments, round undo).
- **Accessibility & ARIA Attributes** (e.g. labels, roles, Axe audits).

**YOU MUST UPDATE AND RUN THE E2E TESTS TO REFLECT THOSE CHANGES.**

Do not leave broken, stale, or out-of-sync E2E tests. Any changes that affect user flows must have matching updates in:
- `tests/e2e/acceptance.spec.ts` (Full PRD acceptance: group creation, roster setup, court generation, match scoring, round progression)
- `tests/e2e/corrections.spec.ts` (Match score edits, cancellations, round undos, mid-session attendance)
- `tests/e2e/permissions.spec.ts` (Organizer PIN verification, private group access control, rate limiting)
- `tests/e2e/resilience.spec.ts` (Draft score preservation on validation errors, multi-tab sync, accessibility audits)
- `tests/e2e/test-helpers.ts` (Shared helpers such as `createAndSignInPlayer` and `createTestGroup`)

### Running and Verifying E2E Tests
Run the test suites locally to ensure zero failures and zero retries:
```bash
npm run test:e2e
```
Or test an individual spec:
```bash
npx playwright test tests/e2e/acceptance.spec.ts
```

## 2. Key Architecture & Flow Reminders
- **Player Accounts**: Group creation requires an authenticated player account. The creator is automatically added to the group roster as the host player. Account for the host player in expected player counts (e.g., host + 13 added players = 14 players on roster).
- **Client Hydration**: Client components use `useSyncExternalStore` for SSR-safe hydration markers (`data-hydrated="true"`) to prevent premature browser form submissions before React attaches event listeners.
- **Continuous Quality Checks**: Always ensure the quality gates pass:
  - `npm run lint` (ESLint with Next.js & React 19 rules)
  - `npm run typecheck` (TypeScript)
  - `npm test` (Vitest unit and component tests)
  - `npm run test:simulation` (Matchmaking fairness and Elo simulations)
  - `npm run test:e2e` (Playwright acceptance and accessibility tests)

