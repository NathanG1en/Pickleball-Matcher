# Bulk score saving

Implement benchmark recommendation 1 on `optimizations/organizer-session-actions`, based on current development. UI and schema stay the same.

1. Add real domain/action regressions and an isolated PostgreSQL query-budget test before implementation. Cover whole-batch rollback for missing, duplicate, stale, or out-of-scope matches; input order, original completion timestamps, unrated games, and rating/chemistry corrections must remain correct.
2. Add `getMatchResultContexts(ids)` (one joined read) and `updateMatches(matches)` (one version-checked bulk write) to all three repository adapters. Batch service validation runs before writes under the existing chemistry transaction lock. Pass the action's authorized group/session and supplied match versions into this path. Reject duplicate IDs and mixed-session batches; retain empty-batch behavior.
3. Keep rating replay once per batch and chemistry replay when historical results require it. Preserve output order and timestamps. Do not optimize replay, round loading, refreshes, or the single-score path here.
4. Run unit/type/lint checks, targeted PostgreSQL tests on connection-local temporary tables, SQLite adapter checks, and a browser Save All Scores persistence/stale-tab regression. Compare SQL count and latency against the previous implementation with the same isolated fixture. No production data, migrations, automatic commit, or push.

Review focus: a partial version conflict must roll back every score and derived rating; authorized group/session must match every submitted row; optional client versions must reach validation; rated/unrated and historical chemistry behavior must agree with individual saves.
