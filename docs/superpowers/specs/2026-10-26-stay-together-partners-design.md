# Stay Together partners for normal sessions

Status: approved by the user on 2026-10-26; implementation authorized.

## Intent and agreed behavior

School-club players often arrive with friends and want to remain teammates throughout a session. The organizer can optionally select Stay Together pairs. Those friends normally play together and sit together. The user explicitly allows an individual to sit when only one bench place is available, so an unpaired player does not get stuck sitting repeatedly.

This is a session setting, not a permanent account preference. It includes guests. Each player can have at most one partner in a session. Existing sessions without pairs retain their current behavior.

## Approaches considered

1. **Soft partner preference:** add a matchmaking bonus for preferred partners. This preserves flexibility but can separate friends when other scoring terms win. Rejected because this club wants predictable teammates throughout the session.
2. **Stay Together pairs:** treat an available pair as a two-player team, with a narrow bench exception. The user selected this approach, accepting reduced flexibility for skill balance and joint sitting.

## Round rules

### Playing

- Whenever both friends are playing, they must occupy the same two-player team. They cannot be opponents, play on separate courts, or be assigned to singles simultaneously.
- A pair can fill the two-player side of an existing 2v1 court; the feature does not change which formats count toward Elo.
- Normal skill balancing and opponent rotation operate around the fixed teams. Intentionally staying with a friend must not incur the usual repeated-partner penalty. Ordinary partnerships still use existing repeat rules.
- If one friend is absent, their pairing is temporarily inactive. The present friend plays normally; the absent friend does not occupy a court or bench place. Rejoining restores the pairing from the next round without resetting participation history.

### Sitting and the exception

- Prefer whole pairs sitting together when two bench places are available. Participation fairness is tracked for individuals, including rounds before the pairing existed or before a player joined.
- With exactly one bench place, rotate that place among all eligible players using participation history and the existing preference against consecutive sitting. Paired players receive no exemption. The remaining friend may play with someone else for that round; their saved pair is unchanged.
- The individual-sit exception applies only when the total bench count is exactly one. With larger bench counts, allocate whole pairs and unpaired individuals without partially benching a pair. If those constraints cannot fill the configured slots, explain the incompatibility; do not silently extend the exception.
- Pair membership must not give additional playing priority. Avoid preventable consecutive sits among feasible assignments; do not promise identical game counts for every arbitrary arrival/departure and court configuration.
- Example: A+B and C+D are pairs; E is unpaired; one doubles court is available. E can sit initially, but later A can sit while B plays with E against C+D. On another round C can sit while D plays with E against A+B. Both active pairs remain teammates, and E is not permanently benched. Exact order follows participation and seeded tie-breaking, not a fixed alphabetical cycle.
- Show a short explanation on a proposed round whenever the bench exception is used: e.g. “Alex is sitting this round to rotate playing time. Alex and Sam are still paired for the session.”

### Incompatible court configurations

A hard requirement cannot always fit the available team slots. For example, four players consisting of two pairs cannot all play on two singles courts while staying together.

Return a clear, actionable message when no valid allocation exists: change court sizes or remove a pair. Do not silently unpair active friends, add bench places beyond the configured capacity, or reduce the number of configured courts. This applies to generation, reshuffling, court changes, attendance changes that need a new proposal, and manual lineup submission. The bench exception is not permission to split two active friends onto different teams.

## Organizer flow

- Normal-session setup has an optional “Stay Together” section after player selection. Select two attendees, add the pair, and remove pairs as needed. Show names clearly and explain the single-bench exception. Prevent selecting the same person twice or assigning someone to multiple pairs.
- Deselection of an attendee removes that person's setup pair visibly, rather than submitting a stale hidden pair.
- During an active session, organizers can edit pairs for future rounds. Members can see the configured pairs but cannot change them. Support registered accounts and guests through existing roster player IDs.
- Mid-round edits do not rewrite the match in progress or historical matches. Changes affect the next proposed round. A proposal or manual draft made under older pair settings cannot be started unchanged without fresh validation.
- Manual lineups follow the same pair and bench rules. To intentionally split two active friends, the organizer removes or changes their session pair first; there is no hidden one-round bypass in the first version.
- Ending or duplicating a session does not carry these pairs into a new session automatically. Organizers explicitly choose pairs for each session.

## Persistence and authorization

Implementation proposal, not a user-selected technical detail:

- Add a backward-compatible JSONB `stay_together_pairs` column on `sessions`, default `[]`, holding canonical pairs of group roster player IDs. No separate account relation or permanent friend graph is needed.
- Include the field in session reads, inserts, updates, domain types, validation, and repository adapters. Existing rows and fixtures default to no pairs.
- Validate pairs on the server: two distinct IDs, no overlapping pairs, roster membership in the session's group, selected attendees at creation, and eligible session attendees when adding/editing an active pair. Previously saved pairs can remain inactive when a friend leaves.
- Only normal sessions support this setting. Organizer authorization is checked against the session's actual group. Reject cross-group IDs, ended-session edits, and non-organizer mutations.
- Pair updates are transactional and use the existing session version for conflict detection. Changes increment that version. Stale pair editors receive a refresh-and-retry error rather than silently replacing another edit.
- Include canonical pair settings in the manual-draft/proposal context. Regenerate a preview when pairs change; revalidate the latest persisted pair settings when starting any round, including a restored draft and a custom lineup.
- A migration is required. Apply it to an isolated test database for verification; production migration/deployment and pushing the feature require a later user request.

## Matchmaking design

Keep the current TypeScript generator and seeded randomness. No dependency, browser worker, or remote service is required.

Pairing is a constraint, not a large scoring weight. Carry pairs through every generation entry point: initial preview, regeneration, reshuffle, court configuration changes, and round-start validation.

For sessions with pairs, build feasible seating/team allocations from pair blocks and individual players, then optimize court assignments using the existing balance/opponent scoring. When the total bench count is exactly one, consider the permitted single-player exception. Rank feasible seating choices by consecutive-sit avoidance and participation fairness before ordinary court quality. With any other bench count, keep each present pair wholly active or wholly sitting. Whole-pair feasibility and the permitted bench exception constrain that fairness comparison; they are not allowed to break two active friends apart.

Do not rely on random full-roster permutations eventually landing on all pairs. Use constructive allocation with a bounded search and explicit infeasibility reporting. Preserve the current no-pair path and iteration budget; avoid exponential enumeration of all rosters. The builder should select the bounded allocation strategy and test it across the supported maximum of 24 players and six courts.

## Verification and acceptance criteria

Update necessary tests before running them. Cover:

- Pair validation, permission checks, persistence, stale versions, and existing sessions without the new field.
- Both active friends always on one team; multiple pairs; guests; repeated-partner exemption; missing/rejoining friend; changes apply to future rounds.
- Five-player and nine-player multi-round scenarios: one bench place rotates through paired and unpaired players, no preventable repeat sit, no lost or duplicate player, and both-active pairs always together.
- Whole-pair bench rotation, larger odd bench counts, unequal participation histories, late arrivals, and paired/unpaired mixtures.
- Mixed court capacities, incompatible all-singles settings, regeneration, reshuffle, and deterministic seeded behavior. No-pair behavior remains unchanged.
- Refreshed saved pairs, expired manual drafts, and server validation preventing a custom lineup from bypassing pairing constraints.
- Database migration/defaults and repository round-trip; adapt the SQLite simulation repository so existing fairness simulations continue working.
- Targeted browser flow: create a paired session, generate/refresh, adjust pairs, verify the odd-bench explanation and organizer-only editing. Update relevant acceptance, corrections, permissions, and resilience specs/helpers where their contracts change.

Run lint, type checking, unit/component tests, and matchmaking simulations. Run focused E2E checks for the new flow when useful; a full E2E run is not required by the current project instructions. Record actual test outcomes and any limitations.

## Scope and open approval

First version excludes player self-service requests/acceptance, permanent friendships, groups of three or more, tournament teams, and Open Play team selection. Elo and chemistry formulas do not change. Already-started rounds and existing score history are preserved.

The builder may decide exact component structure, accessible field labels, allocation internals, and error wording within these rules. The temporary partner behavior during a solo sit and the manual-lineup policy are stated explicitly for the user's review. Extending the solo-sit exception beyond exactly one bench place is outside this first version.

After design approval, write an implementation plan, then implement and verify. This document alone does not authorize production database changes or a push.
