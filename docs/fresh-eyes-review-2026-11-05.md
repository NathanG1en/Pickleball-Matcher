# Fresh-Eyes Review — Pickleball Matcher

*2026-11-05 · outside-perspective architecture & UX notes · no code changed*

> TL;DR: You've already squeezed the SQL. Your own benchmark doc
> (`benchmarks/2026-11-03-session-action-latency.md`) proves the remaining time
> is **~11–15 dependent round trips × ~37 ms**, not CPU. You won't shave your way
> to "snappy" from here. The win is to **stop making the organizer wait for the
> server at all** and to **cut the number of taps per round**. Below is how.

---

## 0. Should you spend time on this? Yes — but on *perceived* latency

Picture the real scene: an organizer on court, 12 sweaty people staring at them,
one bar of LTE. Per round they currently go through **three server waits**:

| Tap | Measured median (final build, local Mac→Neon) |
| --- | ---: |
| Save All Scores | ~640 ms |
| Next Round | ~1,000 ms |
| Confirm & Start | ~640 ms |
| **Total spinner time per round** | **~2.3 s** (more on bad court Wi‑Fi) |

The benchmark doc also shows the floor: Start ≈ 11 sequential DB windows, Save ≈ 9,
Next ≈ 15. At ~37 ms each, you're at ~400/330/550 ms *before* any compute or
browser network. More SQL tuning gets you crumbs.

**Goal I'd set instead:** every tap responds in **< 100 ms visually**, and a round
transition needs **one tap**, not three. The server can take as long as it needs
in the background.

---

## 1. The big three (highest leverage, do these first)

### 1a. Optimistic outbox — you already built 80% of it

You already have **idempotency keys** on every action and **optimistic
versioning** (`sessionVersion`, `matchVersion`, `roundVersion`). That's exactly
what an optimistic outbox needs. You just aren't using it to skip the wait.

- On tap: apply the change to local state **immediately**, then push the action
  into a small client-side queue (an "outbox").
- The outbox sends actions in order, retries with the **same idempotency key**,
  and on a real conflict (stale version) it rolls back and shows a toast.
- UI shows a tiny sync indicator per court (`●` pending → `✓` committed) instead
  of disabling the whole screen.
- Bonus: **court Wi‑Fi dead zones stop mattering.** Persist the outbox to
  IndexedDB and the session survives a phone lock, a tunnel, or a parking lot.
  That alone may matter more to real users than the milliseconds.

> ⚠️ This pushes on a rule in your latency spec: *"ratings must commit before
> success is confirmed."* I'd challenge that rule. The organizer doesn't need
> committed ratings to see "11–6 ✓". Ratings aren't visible mid-round. Split the
> idea of "success" in two: **accepted** (instant, local) and **committed**
> (server). Only gate the things that truly need committed state, like ending
> the session or leaving the page with unsynced work.

### 1b. Compute the next round on the device, before anyone taps "Next"

The matchmaker is pure TypeScript (`generate-round.ts`, ~54 ms for 1,200
iterations), and rating replay is ~0.5 ms. **Nothing stops the browser from
running them.**

- As soon as the last score of a round is entered, kick off proposal generation
  in a **Web Worker**, using local state plus locally applied rating deltas.
  (`rateMatch` is shared code, so the client can apply the new scores itself.)
- When the organizer taps Next, the proposal is **already on screen**. 0 ms.
- The server still recomputes or validates when the round is actually started.
  You already send `manualCourts` + `seed` to `startRoundAction`, so the server
  can accept the client proposal as a "manual" lineup, or re-run with the same
  seed and compare. Determinism is already built in (seeded RNG +
  `stableInputSeed`), which is great: client and server should agree exactly.

Today the proposal is computed during the **page re-render**
(`page.tsx → proposeRoundFromSnapshot`) after `revalidatePath`. That's why Next
Round is your slowest action: it waits for completion, then a full page
re-render, then 1,200 iterations, all one after another.

### 1c. Collapse the round loop from 3 taps to 1

Once 1a and 1b exist, the round flow can become:

```
[enter scores per court]  →  auto-saves as each court finishes (no "Save All")
                          →  one big button: "START ROUND 5 ▶"
                              (shows the precomputed lineup; tap a court to edit)
```

- **Kill "Save All Scores."** Auto-save each court as soon as both scores are
  valid (debounced about 600 ms, or on blur). The outbox handles the rest.
- **Merge "Next Round" + "Confirm & Start".** "Next Round" really means "mark
  the round complete and show me the next lineup." If every court is resolved,
  the round is complete. Show the lineup inline and make the one tap **Start**.
  Keep **Reshuffle** and **Manual Edit** as secondary buttons on that card.
- Server-side this can still be two transactions (complete, then start), sent
  back to back from the outbox, or one combined `advanceRoundAction`. Either
  way the user taps once.

**That's ~2.3 s of spinners per round → ~0 s, and 3 taps → 1.** Over a 10‑round
morning, that's ~25 s of the crowd staring at a spinner that goes away.

---

## 2. Stop re-rendering the whole world after every tap

Every session action calls `revalidatePath(...)` for the session page, and most
also revalidate the group page. Each one triggers a full server re-render of
`page.tsx`:

- 5 parallel reads + auth + organizer check, then partner requests and pair
  synergies, then (between rounds) the 1,200-iteration proposal.

The client then has to reconcile that new tree with its own local state. You can
see the strain in `session-manager-client.tsx`: there are **four**
"derive state from props" blocks (`if (session !== prevSession) { setX... }`)
plus a hand-written merge of `localStartedRounds` with server rounds. That's
two sources of truth fighting each other.

**Suggestion:**
- In-session actions **return the changed data** (the updated match or round,
  the new session version, optionally new ratings), and the client applies it
  through **one reducer**.
- Drop `revalidatePath` for the session page on hot-path actions. Keep it, or
  use `revalidateTag`, for pages that really are stale (group dashboard,
  profiles).
- Use a single client store per session (a `useReducer` with typed events is
  enough; Zustand if you like). Remove the `prevX/currentX` pairs.

---

## 3. 🚨 The global lock is a slow-motion time bomb

`lockSynergyState()` takes
`pg_advisory_xact_lock(hashtextextended('pickleball:synergy-state', 0))`, a
**single lock shared by every group in the whole app**. It's held during:

- every score save, cancel, completeRound, undo, reshuffle and endSession,
- while it **replays rating and/or synergy history** (`replayRatingsAndSynergies`,
  `replaySynergies`). The synergy replay calls `listReplayMatches()` **with no
  group filter**, so it reads every rated match ever.

Today: 409 matches, a few clubs, so you don't notice. But:

- **The work grows forever.** Each save does O(all matches ever) work.
  10× history means 10× transfer and compute on every tap.
- **It doesn't scale across clubs.** Saturday 9 am, 30 clubs × 3 courts all
  saving at once means every save in the world waits in one line behind that
  lock.

**Fixes (in order of effort):**
1. **Incremental on the happy path.** A newly completed match is almost always
   the latest one for its players, so apply `rateMatch` to *that match only*:
   O(1). You already store `ratingBefore`/`ratingAfter` snapshots per match,
   and those work as **checkpoints**.
2. **Replay from a watermark only on corrections.** When a historical score is
   edited, cancelled or undone, replay from the earliest affected match forward,
   starting from the snapshot checkpoint, not from the beginning.
3. **Narrow the lock.** Lock per account (sorted `pg_advisory_xact_lock` per
   affected account id to avoid deadlocks) instead of one global key. Two clubs
   with no shared players should never block each other.
4. Add a **property test** (you already have `fast-check`!): "incremental apply
   + watermark replay ≡ full replay" over random histories. That makes the
   refactor safe.

This is the one item I'd call a real **architectural risk**, not just polish.

---

## 4. Infra: put the code next to the database

Your benchmarks ran **Mac → Neon**. Production looks like **Cloudflare Workers
via OpenNext** (`wrangler.jsonc`, `deploy-cloudflare.yml`). Note: there's also a
`netlify.toml`, so delete whichever one is dead to avoid confusion.

With 11–15 *sequential* DB round trips per action, **the distance between
compute and Postgres decides your latency.** A Worker runs at the edge location
nearest the user, which may be far from the Neon region. Things to check:

- **Hyperdrive** (Cloudflare's Postgres connection pooler and accelerator).
  It supports Neon and postgres.js, and removes the TCP + TLS + auth setup on
  each request. Strongly recommended for Workers + Postgres.
- **Smart Placement** (`"placement": { "mode": "smart" }` in wrangler config),
  so a Worker that makes many DB calls runs *near the DB* instead of near the
  user. Fifteen fast trips plus one long trip to the user beats fifteen long
  trips.
- **Verify the module-level pool** in `server-database.ts`
  (`database ??= createDatabase(...)`). Long-lived pools in a module global can
  misbehave on Workers, because I/O objects are tied to a single request. The
  Cloudflare guidance with Hyperdrive is to create the client per request.
  Worth a check, not a guaranteed bug.
- **Neon autosuspend.** If compute scales to zero, the first tap of the morning
  pays a cold start. Check the suspend timeout on the production branch.

Your own report estimated **~250–400 ms saved per action** just from cutting
per-query latency from 37 ms to 10 ms. This could be the **cheapest big win in
this doc**: config, not code.

---

## 5. Measure production, not the laptop

Your benchmark harness is impressively careful, but it measures a Mac. Add:

- **`Server-Timing` headers** on server actions (`db;dur=…, replay;dur=…,
  propose;dur=…`). These show up in DevTools for free.
- **Real-user INP** via `web-vitals` (`onINP`). INP is *exactly* the "does this
  button feel snappy" metric. Log it with the action name to Workers Analytics
  Engine or any endpoint.
- A simple p50/p95 per action from real courts on real phones. Decide the next
  move from that.

---

## 6. Score entry UX (outdoor, one-thumb, sweaty fingers)

Right now: two `<input type="number">` per court → keyboard pops up → type →
next field → … → Save All. On iOS, `type="number"` doesn't even give the big
number pad.

**Ideas, cheapest first:**
- `inputMode="numeric"` + `pattern="[0-9]*"` + `enterKeyHint="next"`, and
  auto-advance focus team1 → team2 → next court.
- **Tap-to-score:** tap the winning team, which defaults that team to 11 (or the
  session's "game to" 11/15/21). Then pick the loser's score from a chip row
  `0 1 2 … 9 10 +`. **2 taps per court, no keyboard.** Add win-by-2 validation
  for deuce games (12–10, etc.).
- **Players enter their own court's score.** Members can already view the
  session. Let anyone on a court submit their own score, and the organizer just
  sees ✓s appear. The organizer goes from data-entry clerk to referee. (Needs
  live sync, see §7.)
- Replace the native `confirm()` on Undo with **do it now + "Undo" toast for
  5 s**. Native dialogs are jarring and block the main thread.
- Small "feels fast" touches: instant `:active` press states, `navigator.vibrate(10)`
  on Android on save, and View Transitions to animate courts from "proposal" to
  "in play" (experimental in React/Next; nice-to-have).

---

## 7. Product ideas (wide-eyed section 🎾)

- **Live session sync.** Today a player watching the session only sees changes
  after a refresh (only `pageshow` triggers one). Two options:
  - *Cheap:* poll a tiny `GET /session/:id/version` every 5 s and refetch only
    when the version changed.
  - *Cool:* **one Durable Object per active session** with WebSockets.
    You're already on Cloudflare and have the `durable-objects` skill in
    `.agents/`. Each DO runs one request at a time, so within a session there
    are **no locks and no version conflicts**: the DO *is* the serializer. It
    holds live state in memory/SQLite, broadcasts to every phone, and writes
    through to Neon. Actions become ~1 short hop.
- **"You're up" notifications.** "Court 2 — you + Sam vs. Priya + Jo" pushed to
  each player's phone (Web Push works for installed PWAs on iOS 16.4+). People
  stop crowding the organizer.
- **Court-side TV / tablet mode.** A `/display` route: big type, current lineup,
  who's sitting next, round timer. Prop an old iPad on the fence.
- **Rolling courts (no synchronized rounds).** When Court 2 finishes, generate
  the next game for those 4 plus whoever is sitting, right away, without
  waiting for Courts 1 and 3. Lots of clubs play this way. Your fairness scorer
  can handle it with "eligible players = finished + sitting." (Open Play may
  already cover part of this; worth unifying.)
- **Round timer** with an optional "last point" alert, for clubs that play
  timed games.

---

## 8. Code architecture notes

- **Giant components.** `session-manager-client.tsx` is **2,470 lines /
  112 KB**, `current-round.tsx` 1,183, `open-play-manager-client.tsx` 68 KB,
  `temporary-group-client.tsx` 46 KB. Score drafts live at the top of the
  2.5k-line tree, so **every keystroke re-renders the whole session screen**.
  That's probably fine on an iPhone and probably visible as INP on a cheap
  Android.
  - Quick win: turn on the **React Compiler** (`reactCompiler: true` in
    `next.config.ts`; supported in Next 16 with React 19) for automatic
    memoization.
  - Real fix: per-court components own their draft state, and the session store
    (§2) only receives committed changes.
- **Three round UIs** (regular session, open play, temporary group) each carry
  their own copy of round, score and attendance logic. Pull out a shared
  **session state machine/reducer** and shared court/score components.
- **You're already most of the way to event sourcing.** Ratings and synergy are
  derived by replaying history, and actions carry idempotency keys and versions.
  Make it explicit with a `session_events` log (`RoundStarted`,
  `ScoreRecorded`, `PlayerLeft`, …), and the **same TS reducer runs on client
  and server**. Then optimistic UI is *exactly* correct by construction,
  offline comes for free, live sync is just "broadcast events," and undo is
  "append a compensating event."
- Off-the-shelf alternatives if you'd rather not build sync yourself:
  **Zero** (Rocicorp), **ElectricSQL**, **PowerSync**. All of them sync Postgres
  to a client-side store. They're powerful but bring new moving parts; I'd try
  the outbox (§1a) first.

---

## 9. "Should we rewrite it in ___?"

**No full rewrite.** Your bottleneck is round trips and architecture, not
language speed, and **TypeScript everywhere is your superpower here**: the same
matchmaker and rating code can run in the browser, the Worker and tests.
That's what makes §1b and §8's event idea possible.

Where another language *could* earn its keep:

- **Rust/Zig → WebAssembly for the matchmaker.** 1,200 iterations take ~54 ms
  (spikes to 164 ms). WASM could plausibly be 5–10× faster, which buys **more
  iterations, so better lineups**, in a Web Worker on the phone. That's a
  quality feature, not a latency fix. A fun weekend spike; keep the TS version
  as the reference oracle and fuzz them against each other.
- **SQL / PL/pgSQL.** Moving "save score + apply rating" into one Postgres
  function turns ~9 round trips into 1. It's real, but you'd lose your
  in-memory repository test story and split logic across two languages. Only
  worth it if you skip the outbox/DO route.

---

## 10. Suggested order of attack

| # | Item | Effort | Impact | Notes |
|---|---|---|---|---|
| 1 | Prod instrumentation (Server-Timing + INP) | S | — | Know before you build |
| 2 | Hyperdrive + Smart Placement + verify pool + Neon suspend | S | High | Config, not code |
| 3 | `inputMode`, auto-advance, Undo toast, React Compiler | S | Med | Afternoon of polish |
| 4 | Auto-save per court + merge Next/Start into one tap | M | **High** | Biggest felt difference |
| 5 | Client-side proposal in a Web Worker | M | **High** | Next Round → instant |
| 6 | Optimistic outbox (IndexedDB, idempotent retries) | M | **High** | + offline resilience |
| 7 | Incremental ratings + watermark replay + per-account locks | M–L | Scaling | Defuses the global lock |
| 8 | Action-returns-delta + single session reducer | M | Med | Cleans up state sync |
| 9 | Live sync (poll → DO/WebSocket), players enter own scores | L | Product | New experience |
| 10 | Event-sourced session log, shared client/server reducer | L | Foundation | Makes 6/8/9 trivial |
| 11 | WASM matchmaker | M | Quality | For fun and better lineups |

If you only do three things: **#2, #4, #5.** Infra config, one-tap rounds, and a
precomputed lineup. The court will feel like a different app.

---

*Caveats: this review is from reading the code and your benchmark docs, not from
running production. I didn't verify the deployed region, Hyperdrive status, or
real-device INP. Those are the first things §5 would tell you.*
