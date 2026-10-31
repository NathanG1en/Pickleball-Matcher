# Bulk score saving improvement

Implemented organizer benchmark recommendation 1 on `optimizations/organizer-session-actions`, based on development commit `c6e4615`. No schema or UI changes are required.

## Result

The batch operation now uses one joined read for all selected matches and their parent context, followed by one version-checked bulk score update. It no longer fetches the match, round, and session separately and writes once for every court.

| Four doubles courts / 16 accounts | Previous | Optimized |
| --- | ---: | ---: |
| SQL statements per save, including transaction/lock/replay | 26 | 12 |
| Median backend time, five warm samples | 2.00 s | 0.86 s |
| Observed backend time range | 1.85–2.06 s | 0.85–0.87 s |

That is **54% fewer statements** and about **57% less backend waiting** in this controlled run. For six courts, the PostgreSQL regression also verifies **34 → 12 statements**. The reduced query count no longer grows with court count in these fixtures; rating replay still performs work proportional to history size.

These are backend measurements, not browser click-to-render times. Both versions used the same 16-account fixture with four pending matches, fixed scores, no earlier games, one warmup, and five timed samples. They ran sequentially on the same Mac against the Neon test branch. Fixtures lived in connection-local temporary tables, so the benchmark changed no persistent account, match, or chemistry rows. Small samples and network conditions limit how closely these times predict deployment performance.

Raw samples: [previous](data/bulk-score-saving-baseline.json), [optimized](data/bulk-score-saving-optimized.json).

## Validation and behavior

- The server action passes its authorized group/session and any supplied match versions into the service. The previous batch path discarded supplied versions and did not bind submitted matches to that group/session.
- Duplicate IDs, missing matches, mixed sessions, out-of-scope groups, and stale supplied versions reject the whole batch before score writes. Match versions remain optional for compatibility with existing callers.
- The bulk SQL update also checks stored versions. A partial conflict aborts the transaction and rolls back the rows that matched. Transactional callers must let that exception escape their callback; the batch service does so.
- Successful results remain in request order. Existing completion timestamps and rated/unrated flags are preserved.
- Rating replay runs once per batch. Historical corrections still rebuild chemistry; they do not increment the number of shared games.
- An injected failure after real rating writes verifies rollback of scores, account ratings, and match-player snapshots together.
- Empty internal batches remain a no-op. The single-court save path is unchanged.

The replay logic, global chemistry lock, round-loading queries, and refresh behavior were retained. Other recommendations from the organizer benchmark remain separate work.

## Verification

Coverage includes domain and server-action regressions, PostgreSQL tests using temporary tables, SQLite adapter parity, and a targeted Playwright flow on desktop and mobile. The browser flow saves both courts, reloads to verify persistence, attempts an overwrite from a stale tab, confirms its draft remains visible after rejection, and reloads to verify newer scores remain stored.

Commands:

```sh
npm test
npm run typecheck
npm run lint
npm run test:simulation
DATABASE_URL=postgresql://blocked:blocked@127.0.0.1:1/forbidden npm run test:integration -- tests/integration/batch-scores.test.ts
DATABASE_URL=postgresql://blocked:blocked@127.0.0.1:1/forbidden PLAYWRIGHT_PORT=3116 NEXT_DIST_DIR=.next-test/bulk-score-saving npx playwright test tests/e2e/bulk-score-saving.spec.ts
```

Do not substitute the full integration suite: older integration fixtures truncate shared tables. The new integration file shadows every table it mutates with temporary tables on one persistent connection.

To repeat the controlled performance comparison, retain a checkout of the old commit and run these one at a time:

```sh
npx tsx scripts/benchmarks/batch-score-saving.mjs /absolute/path/to/old-checkout docs/benchmarks/data/bulk-score-saving-baseline.json
npx tsx scripts/benchmarks/batch-score-saving.mjs . docs/benchmarks/data/bulk-score-saving-optimized.json
```

The harness requires `TEST_DATABASE_URL` on the allowlisted test endpoint and verifies temporary-table isolation before fixture writes. Closing its connection discards all benchmark rows. No production data or migration is involved.
