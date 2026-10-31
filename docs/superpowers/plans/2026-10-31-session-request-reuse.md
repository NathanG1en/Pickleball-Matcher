# Reuse session data within a request

Implement organizer benchmark recommendation 3 on `optimizations/organizer-session-actions`, retaining optimizations 1 and 2.

1. Add page/action regressions before implementation. A ready-to-propose organizer page must load session, roster, attendance, and rounds once, retain inactive-player filtering, and reflect an arrival on the next request. Reshuffles should reuse their authorized session; round starts should load it once for preflight and again inside the transaction. Changes between those steps must still reject stale/ended sessions.
2. Add a typed `RoundProposalSnapshot` and a synchronous `SessionService.proposeRoundFromSnapshot` calculation. Keep `proposeRound(id)` as the fresh-loading API; delegate through `proposeRoundForSession(record)` for callers that already fetched/authorized that session. Use the snapshot directly in the session page and use the authorized session in read-only proposal preparation in actions. Remove the redundant extra start-action preflight lookup.
3. Keep all authorization checks, transaction reads, mutation version checks, replay, and refresh behavior. No generic cache, cross-request state, schema changes, or client-submitted snapshots.
4. Verify unit/type/lint, targeted PostgreSQL and desktop/mobile session flows. Compare the duplicated page-load/proposal-preparation sequence against the reused sequence with identical seed and full proposal equality. Record query counts and backend timing separately from full browser render time. No production data or automatic commit/push.

Review focus: the page's roster includes inactive players, so snapshot generation must retain the existing active-player filter; raw attendance must feed matchmaking as before. Mutation preflight data must never replace reads inside the mutation transaction.
