# Bun test-runner experiment

Bun is installed as a pinned, project-local development dependency (1.4.4).
Keep Vitest as the default: the current native Bun runner cannot run the complete
suite correctly. No production code, database configuration, CI commands or app
runtime changed.

## Commands

- `npm test`: existing Vitest suite, still the required quality gate.
- `npm run test:bun`: experimental native Bun runner. Currently expected to fail.
- `npm run test:compare-runners`: five alternating runs of each runner; exits
  nonzero if either runner fails. Run without other intensive work for comparison.

Both runners use `scripts/testing/unit-test-scope.json`. The Bun wrapper discovers
explicit files, excludes integration, maintenance database, simulation, browser and
rate-limit suites, uses isolated parallel workers and a 10-second timeout, and
disables automatic `.env` loading. Already exported shell variables still apply.
Its preload replaces `server-only` with the same empty module behavior as Vitest.
No test expectations were weakened or compatibility failures skipped.

## Observations, November 9, 2026

Mac desktop, Node 25.2.1, Vitest 4.1.11, Bun 1.4.4. Both selected 97 files
(784 Vitest tests, including one added scope regression test). Five alternating
runs after an initial run of each; times below include npm and wrapper startup.
Lint/typecheck overlapped the first pair, so these are exploratory diagnostics,
not controlled performance claims.

| Runner | Median elapsed (range) | Result on every run |
| --- | ---: | --- |
| Vitest | 5,230 ms (4,710–6,476) | 784 passed, exit 0 |
| Bun | 1,250 ms (1,057–1,335) | 514 passed, 37 failed, 26 errors, exit 1 |

**These runtimes are not equivalent coverage.** Bun reports only 551 tests
executed because some modules fail during loading; it does less work.

Observed blockers include missing `vi.stubEnv`, `vi.unstubAllEnvs`,
`vi.stubGlobal`, `vi.unstubAllGlobals`, and partial-mock factories receiving no
`importOriginal` callback. See, for example, player-account authentication,
lineup-draft storage and group-organizer component tests. This is runner
compatibility, not evidence those application features are broken.

## Verification and next decision

Vitest: all 784 tests pass. ESLint and TypeScript pass. A temporary deliberately
incorrect Bun assertion returned exit 1; the full-suite wrapper also propagates
Bun's nonzero exit status. Temporary probe files were removed.

Do not switch CI or `npm test` to Bun yet. Revisit when a pinned Bun release
supports these APIs, or scope a separate test migration with equivalent assertions,
mock restoration, per-file isolation and complete test-count parity. Only then
benchmark successful full suites under idle conditions to judge the real saving.
The optional Bun dependency, wrapper, shared scope and this report can be removed
without changing production behavior.
