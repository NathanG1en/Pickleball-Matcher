# Stay Together partners

Implemented on `codex/stay-together-partners`, based on development commit `03f7228`.

## Using it

In normal-session setup, select attendees and available courts, then proceed to the **Stay Together** page to optionally configure two-person pairings. Registered players and guests are supported. Each player can have one partner.

Organizers can add/remove pairs from an active session via the **Session Settings modal** (under the **Stay Together** tab); these changes save immediately and affect future rounds. Members can view pairs in the Session Settings modal. Settings survive refreshes, regeneration and reshuffling, but are not automatically copied into a new session.

Both active friends are always teammates. With multiple bench places they sit as a whole pair. **When the total bench count is exactly one**, the individual bench place rotates through paired and unpaired players. If one friend sits, their partner can have a temporary teammate; the saved pairing remains intact. A proposed round explains that exception.

An absent friend temporarily disables their pairing. Returning friends retain their past participation allowance. Intentionally repeated partners do not receive the normal partner-repeat penalty; opponent rotation, skill balancing and the variety control still operate around the fixed teams.

Configurations that cannot fit fixed pairs, such as two fixed pairs on two singles courts, return a useful error. The organizer can change the courts or remove a pair. Custom lineups must respect the same constraints and are checked against current persisted settings before a round starts.

## Player partner requests

In an active normal session, players can open the **Session Settings modal** and navigate to the **Stay Together** tab. An attending member can choose an attending, unpaired friend in **Partner requests** and press **Request Stay Together**. The request stays pending until a group organizer approves or declines it. Either the host or a secondary organizer can decide; the friend does not need to confirm. Organizers can still create pairs directly through the existing pair editor.

Each player has at most one outgoing pending request. They can cancel it before requesting someone else. Members see requests involving themselves; organizers see the whole session queue. Refresh requests with the button or by returning focus to the tab. There is no interval polling or notification service. Refresh also retrieves current roster names and attendance, including changes made in another browser.

Approval rechecks that the session is active and both friends are attending, active group members, and unpaired. It adds the pair for future rounds and declines competing pending requests involving either friend. A round already in progress remains intact. Ended sessions show request history with no decision controls. Organizers can later remove an approved pair through the pair editor; its approved request remains a record of the original decision.

## Implementation and tradeoffs

- `sessions.stay_together_pairs` stores canonical roster-player ID pairs in JSONB, defaulting to an empty array for existing sessions.
- A separate paired generator uses memoized pair/single block allocation to choose feasible sitting and active teams, then runs bounded court optimization. It avoids depending on random roster permutations to discover the fixed teams.
- Sitting prioritizes avoiding consecutive sits, then participation load and seeded tie-breaking. Court balance is optimized after selecting the bench roster; it does not search every equally fair bench roster for a globally optimal balance. Friend constraints can make games less balanced than ordinary rotation.
- The existing no-pair generator remains unchanged. No dependencies or interval polling were added. Settings updates trigger preview regeneration only when a round is not in progress.
- Saves use optimistic session versions. Stale manual drafts include the pair settings in their context, and server validation protects starts even if a client submits an old/custom lineup.
- Related session actions now authorize the target session's actual group and check round ownership, closing forged-group mutations found during review.
- Historical match/sit participation supplements eligibility for paired sessions after leave/rejoin. The existing no-pair eligibility behavior is retained.

- `session_partner_requests` stores request status and optimistic versions. Per-session transaction locks serialize requests, decisions, attendance edits and manual pair edits; session versions also protect approval against other concurrent session changes. Database constraints prevent duplicate outgoing and reversed pending pairs. The pair update and request decision commit or roll back together.
- Requests use trusted account or signed guest identity. Client-supplied requester IDs are rejected. Reading and deciding requests verifies the actual session group, with organizer checks on every decision.

## Database rollout

Migrations:

- `migrations/202610260001_stay_together_pairs.sql`
- `migrations/202610260002_partner_requests.sql`

The new column and request table were verified on the Neon **test** branch first. The isolated repository integration test uses a temporary sessions table; the concurrency test creates and removes only its own fixtures. Apply both migrations before deploying the updated application; its session queries select the new column. Both migrations are additive and idempotent.

On 2026-10-26, following user approval, both migrations were applied to the Neon **production** branch (`br-young-band-b4b5pmgv`) and recorded in `_migrations`; the existing test schema was also recorded in its migration ledger. Production verification confirmed the empty-array pair default, zero paired sessions, an empty request table and all four request indexes (including its primary key). No accounts, match results or ratings were modified.

## Validation

- Lint and TypeScript checks pass.
- **554** unit/component tests pass across 76 files, covering request transitions, permissions, rollback, large pending queues and fresh attendance without a session version change.
- **9** simulation tests pass across four files, including nine persisted rounds in which all nine attendees receive one bench turn while active friends remain teammates.
- **2** targeted Postgres integration tests pass: isolated migration/default/JSONB/stale-version coverage and owned-fixture concurrent approvals, cancel-versus-approve and manual-pair-versus-approval races.
- **4** targeted Playwright cases pass across desktop and mobile: pair creation/save/refresh/start/score and single-bench behavior; member requests, cross-tab attendance refresh, organizer approval, persisted pairs, and preserving draft scores during request refresh and approval in an active round.
- Fresh code review found two material inherited gaps affecting this feature (cross-group mutation authorization and rejoin fairness); both received failing regression tests before fixes and passed afterward. A second fresh review found stale request eligibility after cross-tab attendance changes; an action regression failed before the fix, and desktop/mobile tests now exercise it. The large-queue truncation concern also received a failing regression and fix. No product review findings remain deferred. Full application E2E and production-scale performance were not run.

Design and implementation plan are in `docs/superpowers/specs/2026-10-26-stay-together-partners-design.md` , `docs/superpowers/plans/2026-10-26-stay-together-partners.md` and `docs/superpowers/plans/2026-10-26-partner-requests.md`.

## Keeping or retiring the feature

The feature is being evaluated and is kept in one application commit on its feature branch so it can be reverted together. It adds no runtime dependencies or interval polling.

If the club decides not to keep it, revert the feature’s application commit and deploy that version. Leave the added column and request table in place initially: older application code ignores them, existing sessions default to no pairs, and keeping the schema preserves request history while deployments roll back. Do not drop these objects while any deployed version still queries them. A later, separately reviewed cleanup migration can remove the unused objects after deciding whether their history should be retained. Reverting the feature does not undo matches already played or their rating changes.
