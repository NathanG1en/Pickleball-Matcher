# Parallel session-history reads

Implement organizer benchmark recommendation 2 on `optimizations/organizer-session-actions`, retaining the existing uncommitted batch-score optimization.

1. Add a deterministic scheduling test before changing the repository. Hold each child query open and require all three independent reads to start before releasing them. Keep the empty-session one-query fast path and ensure transaction-bound reads use the transaction client.
2. Add a real PostgreSQL fixture with out-of-order round IDs, ordered courts, participant rating snapshots, cancelled/unrated/pending matches, sitters, an empty round, another session, and a session with no rounds. Assert the entire returned record and verify reads see uncommitted changes on the transaction connection.
3. Keep the round-ID lookup first. Load matches, match players, and sitters with `Promise.all` on `this.query`; join match players through matches using the known round IDs. Retain all mapping, sorting, scoping, and failure behavior. No cache, UI, schema, replay, or refresh changes.
4. Run unit/type/lint checks, targeted PostgreSQL and existing batch-score tests, and the existing desktop/mobile scoring flow that reloads saved history and advances a round. Benchmark old/new reads in alternating order on the same completed test session with warmed connections. Record full-result agreement and timings. No production data or automatic commit/push.

This deliberately uses two network stages rather than the audit prototype's one: it preserves cheap empty sessions and anchors child reads to the rounds actually returned. Nonempty rounds without matches may issue one extra empty participant query. Transaction clients queue the requests on their existing connection, so the latency benefit is for reads outside a transaction with a pool.
