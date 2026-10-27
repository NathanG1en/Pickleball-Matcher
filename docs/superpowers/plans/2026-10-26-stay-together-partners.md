# Stay Together Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Session-long friend teams, with fair individual sitting when exactly one bench spot exists.
**Architecture:** Persist canonical pairs on the session; construct feasible pair-block allocations before scoring courts. Validate current settings again when starting custom/generated lineups. Use shared accessible pair controls in setup and session management.
**Tech Stack:** TypeScript, Next.js/React, Zod, Postgres, existing Vitest/Playwright.
**Spec:** ../specs/2026-10-26-stay-together-partners-design.md

## Global Constraints

- Normal sessions only; one partner per player, guests included.
- Both active partners always teammates. Joint sitting except when the total bench count is exactly one.
- Existing sessions default to no pairs; no-pair matchmaking behavior unchanged.
- Maximum 24 players, six courts; deterministic bounded generation; no dependencies.
- Changes affect future rounds; do not alter Elo/chemistry formulas.
- No production migration or push. User authorized implementation; execute inline without another approval round.

## Review Focus

- Nine attendees with one bench: unpaired player must not sit indefinitely.
- Absent partner: present friend participates and pairing resumes on return.
- All-singles configuration with pairs: actionable infeasibility instead of silently splitting.
- Restored custom draft after settings change: start validates current persisted constraints.
- Cross-group/stale mutation: organizer checks actual group and session version.

### Task 1: Constraint model and generator
Files: new `src/lib/matchmaking/stay-together.ts`, `src/lib/matchmaking/generate-paired-round.ts`; modify matchmaking types/generate-round/score-round; new `tests/matchmaking/stay-together.test.ts`.
Interfaces: `StayTogetherPair = readonly [PlayerId, PlayerId]`; `GenerateRoundInput.stayTogetherPairs?`; `validateStayTogetherPairs(pairs, playerIds)` and `validateStayTogetherLineup(candidate, pairs, presentIds)` return error or null; `generatePairedRound(input): GenerationResult`.
- [x] Write tests for pair validation, fixed active teams, 5/9-player rotation, joint sitting, absent partner, mixed courts/infeasible singles, seeded determinism and 24-player bound.
- [x] Run focused test RED before implementation.
- [x] Construct pair/single blocks; use bounded feasibility DP for sitting and team capacities, prioritizing fairness; score feasible randomized assignments with existing scorer and exempt fixed repeated partners.
- [x] Run focused tests GREEN and existing matchmaking tests.

### Task 2: Persistence and session domain
Files: session types, service, Postgres and in-memory/SQLite adapters, migration `202610260001_stay_together_pairs.sql`; new `tests/domain/stay-together.test.ts`.
Interfaces: `SessionRecord.stayTogetherPairs?`, `StartSessionInput.stayTogetherPairs?`, `SessionService.updateStayTogetherPairs({sessionId,sessionVersion,pairs}): Promise<SessionRecord>`.
- [x] Write failing tests for creation validation, round generation/revalidation, settings edits/stale version, inactive friend, no copy on duplication.
- [x] Add JSONB default []; map all session queries/inserts/updates; update SQLite schema/serialization.
- [x] Propagate pairs to every generator entry point and validate lineup on start using actual attendance/capacity.
- [x] Run domain tests and adapter typecheck GREEN.

### Task 3: Authorized server actions and stale contexts
Files: validation/session.ts, actions/sessions.ts, session page/client, lineup draft context; new action tests.
Interface: `updateStayTogetherPairsAction({groupId,sessionId,sessionVersion,pairs})` returns updated session.
- [x] Write failing action tests: organizer allowed, member denied, cross-group IDs rejected, stale version denied, custom start cannot bypass pairs.
- [x] Implement schemas/actions and pass settings at creation; guard start against mismatched group/version.
- [x] Include pairs in draft context and update/invalidate previews after preference save; in-progress round preserved.
- [x] Run action tests GREEN.

### Task 4: Accessible organizer UI
Files: new `src/components/attendance/stay-together-editor.tsx`, attendance-manager.tsx, new-session-client.tsx, session-manager-client.tsx.
- [x] Add/update component contracts and targeted E2E before changes: setup add/remove pairs, persistence, role-gated editing, solo-sit message and manual bypass rejection.
- [x] Render optional two-player pair selectors, unique eligible choices and named remove buttons; show session pairs and saving/errors.
- [x] Explain solo-sit exception from actual proposed seating, not an animation; disable stale start while saving/regenerating.
- [x] Run component/type checks and focused E2E on isolated test data where available.

### Task 5: Verify, review, document
- [x] Add isolated Postgres migration/round-trip coverage and multi-round pair simulations.
- [x] Run lint, types, unit suite with maxWorkers=2, simulations; focused E2E only.
- [x] Request one fresh read-only whole-branch reviewer, fix material issues with regressions.
- [x] Document migration, fairness semantics and actual test outcomes. Leave feature branch ready for review without pushing.

## Execution record

Ruling: User's “Yes go ahead” authorizes inline execution of the approved design. No second execution-method approval is needed; no production writes or push are authorized.
Ruling: Use a managed worktree to preserve the user's running development checkout and unrelated untracked audit files. Reuse installed dependencies via a local symlink; do not change package versions.

## Final results

All five tasks implemented. Unit/component538, simulations9, isolated Postgres1 and targeted desktop/mobile Playwright2 pass; lint and types pass. Fresh review material findings fixed with RED→GREEN regressions. See `docs/stay-together-partners.md` for rollout and tradeoffs. No production migration, commit or push performed.
