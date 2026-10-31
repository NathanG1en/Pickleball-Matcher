# Check action revalidation plus explicit refresh

Implement recommendation 4 on `optimizations/organizer-session-actions`.

1. Verify installed Next.js action/revalidation behavior, and trace the normal-session handlers. Limit removal to successful mutations that already revalidate this session: start, advance, reshuffle an active round, cancel a match, undo, court configuration, attendance, and historical correction/cancellation. Preserve error handling, local drafts, proposal regeneration, server invalidation, and other freshness paths (pageshow, navigation, and the partner-session callback also reached through read-only request refresh).
2. Add a browser regression before implementation that drives these actions and asserts fresh UI without a follow-up session GET. Add a test-only Node preload/server harness for sanitized per-request SQL counts; restrict it to the allowlisted Neon test database. Capture matched baseline/optimized workflows, distinguish action POSTs, real GETs, prefetches, and unattributed query events. Do not infer database work from browser request counts alone.
3. Remove only proven redundant refresh calls, retaining the existing action revalidations. Keep the Next Round transition through the server action and its rendered payload. No schema, domain algorithm, or replay changes. No production instrumentation or data access.
4. Verify browser flow, historical corrections, durable manual lineups, stale tabs and partner-request freshness; run unit/type/lint checks. Document measured request/query counts, test results, and timing limits. Leave changes uncommitted until requested.

Using the existing action-rendered payload avoids the extra read with no new state synchronization API. Replacing action revalidation with client-only refresh would lose server invalidation; returning complete custom client snapshots would duplicate the page's serialization and state model. Neither is needed for this scoped optimization.
