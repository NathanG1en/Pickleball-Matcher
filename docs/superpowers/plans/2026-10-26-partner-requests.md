# Organizer-approved partner requests implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans inline; checkbox steps track implementation.

**Goal:** Attending players request a Stay Together partner for the current normal session, with organizer approval and requester cancellation.
**Architecture:** Session-scoped request records with pending/approved/declined/cancelled states; transactional per-session serialization, request versions, and the existing session version protect decisions. Reuse Stay Together pair validation and future-round behavior. Request panels fetch on demand/focus without polling.
**Tech Stack:** Existing TypeScript, Next.js, Postgres, React, Vitest and Playwright; no dependencies.
**Spec:** User approved the in-chat outline and organizer-only approval on 2026-10-26. This extends docs/superpowers/specs/2026-10-26-stay-together-partners-design.md.

## Global constraints

- Normal sessions only. Organizer approval is sufficient; no friend acceptance step.
- Requester identity comes from authenticated account or existing signed guest identity, never from client input.
- Both players must currently attend, be active group members, and have no existing partner. One outgoing pending request per player; reject reverse duplicates.
- Organizer approval rechecks current attendance, session status and current pair settings, without replacing another pair. Approved changes affect future rounds only.
- Cancelling, declining and approving serialize per session; decided requests cannot be decided again. Successful approval declines competing pending requests involving either newly paired player.
- Only organizers see all requests; other players see requests involving themselves. Only the requester can cancel.
- Initial implementation stayed in the existing feature worktree with test-only migrations and no push. The user subsequently authorized production migration, commit and push on 2026-10-26; retain the feature branch for evaluation.

## Review focus

- Forged requester/session/group IDs and non-organizer decisions must fail without writes.
- Cancel vs approve, duplicate requests and overlapping approvals must not produce conflicting state.
- Partner leaves or gets paired after submission: approval rechecks and fails safely.
- A scored/in-progress round must stay intact when a request is approved.
- Queue refresh must not clear score drafts or introduce polling.

### Task 1 — Domain and storage
Files: domain/types.ts, repositories.ts, new partner-request-service.ts; Postgres/in-memory/SQLite repositories; migration 202610260002_partner_requests.sql.
Interfaces: PartnerRequestRecord; lockPartnerRequests(sessionId), list/get/insert/updatePartnerRequest. PartnerRequestService.submit(sessionId,requesterId,partnerId), cancel(sessionId,requestId,requesterId), decide(sessionId,requestId,decision), returning current session/request state where needed.
- [x] Write and run failing domain tests for submit/cancel/decision, duplicates, stale request, conflict/attendance/session checks and rollback.
- [x] Implement persistence and canonical pending-pair uniqueness; existing in-memory fixtures default empty.
- [x] Implement transactionally serialized transitions and append approved pair using session optimistic version, without nested transactions.
- [x] Run domain tests green; add isolated Postgres transition/round-trip coverage.

### Task 2 — Authorized actions and page visibility
Files: new actions/partner-requests.ts and validation/partner-requests.ts; session page/client.
- [x] Write action regressions for impersonation, outsiders, group mismatch, secondary organizer approval and visibility.
- [x] Resolve actor from trusted account/guest session, validate actual target group/session, and require organizer for decisions.
- [x] Expose only visible requests to members. Guard session-page group/session association before reading request data.
- [x] Run action tests green and types.

### Task 3 — Member request form and organizer queue
Files: new components/sessions/partner-requests.tsx, session-manager-client.tsx; component and targeted browser tests.
- [x] Update necessary browser/component tests before implementation.
- [x] Member form selects an eligible friend; shows own request status and cancel. Organizer queue has named approve/decline actions and pending count.
- [x] Refresh on explicit click/tab focus, never interval polling; reuse current session update callback for approved pairs/preview refresh while preserving current rounds and scores.
- [x] Run focused tests and desktop/mobile member→organizer approval flow.

### Task 4 — Verify and document
- [x] Apply additive migration only to verified test endpoint; isolated DB tests never truncate shared data.
- [x] Run lint, types, all unit tests, simulations when adapters change, isolated PG and focused E2E.
- [x] Fresh read-only review, fix material findings with failing regressions.
- [x] Document behavior and actual verification; leave uncommitted/unpushed.

## Verification results

2026-10-26: lint and types passed; 554 unit/component tests across 76 files; 9 simulations; 2 targeted Postgres tests; 4 desktop/mobile E2E cases across stay-together and partner-requests. The request E2E was then extended to exercise approval during a round with draft scores and passed on desktop and mobile (2 cases, 43.7s). Local port 3000 returns HTTP 200. Only the verified test branch was migrated. No commit or push.

Fresh read-only review identified stale attendance in request refresh: regression failed before returning current participants with the request view, then passed; browser tests also cover absent→present eligibility without reloading the member page. The reviewer’s large-queue concern was fixed by removing the repository truncation, with a failing→passing competing-request regression. Approval, request refresh and tab focus preserve score drafts; pending operations use one in-flight guard and approval disables conflicting parent controls.

## Authorized rollout

On 2026-10-26 the user approved applying the schema to Neon and committing/pushing the feature, while noting they may later retire it. Refetched origin: feature base equals latest development (`03f7228`). Fresh verification: unit554/554, lint and typecheck passed. Both additive migrations were applied atomically to the verified production branch and recorded in `_migrations`; the already-tested schema was also recorded in the test migration ledger. Production checked: default `[]`, zero paired sessions, zero requests, four request indexes. Retirement instructions are in docs/stay-together-partners.md. Commit the implementation together for easy application rollback and keep its PR in draft for evaluation.
