# UX critique: player and organizer experience

Run on November 13, 2026 with the Impeccable `critique` playbook. Two design reviewers worked independently, one on the player side and one on the organizer side. A third pass ran the detector and took browser measurements. All three drove the local dev server on port 3100 (test database) at 390 × 844, with desktop spot checks. I re-checked every P0 and P1 claim below against the source before including it.

Colour contrast is deliberately excluded and deferred to a later pass.

Screenshots: `output/playwright/ux-critique-2026-11-13/{player,organizer,detector}/`.

## Scores (Nielsen, 0–4)

| # | Heuristic | Player | Organizer |
|---|---|---|---|
| 1 | Visibility of system status | 1: live view never updates | 2: the screen freezes for 2 s after every round advance and End reads "ENDING…" |
| 2 | Match with the real world | 2: "Round 0", ratings shown to 3 decimals | 3: "LEFT" button shown for people who never arrived |
| 3 | User control and freedom | 2: the only exit is Leave Group | 1: Cancel match and ending a session can't be undone |
| 4 | Consistency and standards | 2: login and signup land on different pages | 2: three different End confirmations |
| 5 | Error prevention | 1: guest join duplicates a roster player | 1: one-tap End, one-tap Cancel, wrong-gender brackets |
| 6 | Recognition rather than recall | 1: you have to find your own name | 2: no sit/play tally during a session |
| 7 | Flexibility and efficiency | 1: about 4 taps to reach your court | 2: core loop is fast, setup is not |
| 8 | Aesthetic and minimalist design | 2 | 3 |
| 9 | Error recovery | 2: deep links dead-end | 2: a stale tab gets no refresh button |
| 10 | Help and documentation | 2 | 3 |
| | **Total** | **16/40 (Poor)** | **21/40 (Acceptable)** |

**Design specificity:** the look is distinctive and clearly this product. The interaction model is not. The player view is the organizer console with its controls removed, and it never answers the courtside question "where do I go and who's my partner?". On the organizer side, the round lifecycle can't yet be trusted: lineups change when the page reloads, and destructive taps can't be undone.

## Player side

### P0: The live session never updates for players
A player watching a normal session sees nothing change when the organizer starts a round, starts the next round, or ends the session. Only a manual reload updates it.
- Root cause: `session-manager-client.tsx:533` refreshes only on `pageshow` (back/forward cache). Open play already polls every 5 s and listens for `visibilitychange` (`open-play-manager-client.tsx:478-501`); normal sessions have neither.
- Evidence: `player/08-player-session-round-started-noreload.png`, `player/12-player-stale-after-round2-started.png`, `player/15-player-stale-after-session-ended.png`.
- Fix: port the open-play sync (version poll while the tab is visible, plus refresh on `visibilitychange` and `focus`). Announce the new round: "Round 2 is up · you're on Court 1".

### P1: The live round never tells the player where they are
There is no "You" marker, no "your court" summary, and no "you're sitting out" state. Every team shows "In Play" and there is no "vs" between teams.
- Root cause: `page.tsx` computes `currentViewerPlayerId` but `ResultsEntryView` never receives it, because the component has no viewer prop.
- Evidence: `player/33-jordan-live-session-no-you-highlight.png`, `player/32-jordan-dashboard-live-dup-alice.png`.
- Fix: pin a "You" card above the courts ("Court 2 · with Gus · vs Cara & Org", or "Sitting out · you're in next round"). Highlight the player's team, and do the same on the dashboard matchup card.

### P1: Guest self-join duplicates existing roster guests
The organizer pre-adds "Alice Ace". The real Alice opens the share link and joins as a guest. Now two "Alice Ace" rows exist, both get auto-selected, and she plays on two courts in the same round.
- Root cause: `player-account.ts:263-293` (`joinAsGuestAction`) always calls `createPlayer` and never checks for a matching name.
- Evidence: `player/21-guest-joined-duplicate-name.png`, `player/33-…png` (Alice on Courts 1 and 3).
- Fix: the join page offers "Are you one of these?" with a list of unclaimed guests, and claiming one links to that record. Block or warn on an exact name match.

### P1: No "my group / live now" entry point
- The signed-in home is a 5-button menu with no group shortcut. "Recent groups" exists only in this device's localStorage.
- Guests land on the marketing home with no way back to their group.
- Login lands on Profile.
- Evidence: `player/18-home-signed-in.png`, `player/25-guest-home.png`, `player/03-after-login-landing.png`.
- Fix: render the player's groups from the server (accounts) and from the guest cookie (guests). Add a "LIVE NOW · Round 3 · Open my court" card. Send players to the live session after login.

### P2: Leaving is all-or-nothing, with no warning mid-match
- Players have no "leaving after this game" or "sit me out" control.
- The only exit is ⋯ → Leave group, and it doesn't mention that they're playing on Court 3 right now.
- Evidence: `player/30-leave-group-confirm-mid-session.png`, `player/31-after-leave.png`.

### P2: The payoff is hidden: rating change and chemistry
- "Your session" shows wins and losses but no rating change.
- The profile chart reads "3.501 → 3.501".
- Chemistry stays "No partner yet" after games with guest partners, because synergy only counts partners who have accounts.
- Ratings show 3 decimals.
- Evidence: `player/16b-player-results-top.png`, `player/17-profile-after-session.png`.

### P2: Shared and deep links dead-end
- Signed-out session link: a bare sign-in screen with no group context.
- Signed-in non-member: silently redirected to `/players` (`sessions/[sessionId]/page.tsx:52-57`).
- Fix: send non-members to `/g/[id]/join?next=<session>`.
- Evidence: `player/23-…png`, `player/24-…png`.

### P3: Truncation on phones
- Find-a-group names cut off at about 15 characters (`player/02-after-signup.png`).
- The dashboard "Current Matchups" box scrolls inside a 136 px frame, hiding Court 3 (`page.tsx`, `max-h-[136px]`).

## Organizer side

### P0: Dashboard "End" ends a live session in one tap, with no undo
The END button sits right next to RESUME SESSION on the dashboard's live card. It calls `endSessionAction` immediately: no confirmation, no check for games in progress. Sessions can't be reopened.
- Root cause: `end-session-now-button.tsx`, where `onClick={handleEndSession}` runs with no confirm step.
- Evidence: `organizer/43-dashboard-active-session-end-next-to-resume.png` → `organizer/44-dashboard-after-one-tap-end.png`.
- Fix: remove End from the dashboard card, or route it through the session page's in-progress modal. Add a "Reopen session" option for a short window afterwards.

### P1: The proposed lineup reshuffles on every page load
Organizers read a lineup aloud. Then the phone locks, the page reloads, and a different lineup appears. A co-organizer's phone shows a third version.
- Root cause: `sessions/[sessionId]/page.tsx:105` calls `proposeRoundFromSnapshot` with no seed. `proposal.ts:140` defaults to `Math.random()`.
- Evidence: `organizer/36-proposal-after-reload.png`, `organizer/37-tab-b-after-tab-a-started.png`.
- Fix: save the proposal (seed and courts) on the server, and regenerate only on Reshuffle, a variety change, or an attendance change.

### P1: The "Up Next" preview promises sitters that don't happen
The preview is recomputed with a fresh random seed after every score save, so the round that actually starts differs from what was shown.
- Root cause: `session-manager-client.tsx:559-574` (`useMemo`, seed `undefined`).
- Evidence: `organizer/15-up-next-preview-open.png` vs `organizer/20-round2-live.png`.
- Fix: use a stable seed per session and round, and make the preview exactly what Save & Start will use.

### P1: Cancel match is one irreversible tap, even on final results
The button fires optimistically and nothing can un-cancel a match. On a Final card, it sits where your thumb lands after Update Score.
- Evidence: `organizer/32-r3-court1-final-with-cancel-visible.png` → `organizer/33-final-match-cancelled-one-tap.png`.
- Fix: show a 5 s "Match cancelled · UNDO" snackbar, move Cancel into a ⋯ menu on Final cards, and add a server action to restore a cancelled match.

### P1: The tournament creator fills women's and mixed brackets with men
All 5 divisions are pre-selected, and when fewer than 2 players are eligible, a division falls back to the whole roster.
- Root cause: `lib/tournament/bracket.ts:69-73` (`… : players`), and the same pattern in the other division branches.
- Evidence: `organizer/53-tournament-womens-divisions-with-all-male-roster.png`, `organizer/56-tournament-womens-singles-all-male.png`.
- Fix: no divisions pre-selected. Show "0 eligible" and disable the checkbox; never fall back to the opposite gender.

### P2: Mid-session attendance is buried, and the list jumps
- A late arrival takes Settings → scroll a 14-row modal → Present → Close.
- Rows re-sort under your thumb.
- People who never arrived get a "LEFT" button.
- There is no "on break" state.
- Evidence: `organizer/25-session-settings-attendance.png`, `organizer/26-after-late-arrivals.png`.

### P2: Round advance freezes the screen, and End reads "ENDING…"
- Inputs stay disabled for about 2 s after Save & Start because of the shared `isPending` (`session-manager-client.tsx:1688`).
- A disabled Save & Start never says why.
- An unscored court can only be skipped by cancelling it.
- Typed score drafts are lost on refresh.
- Evidence: `organizer/31-round3-live.png`.

### P2: Fairness is invisible during play, and ending a session has no payoff
- There is no played/sat tally until the session is over.
- After End, the organizer lands on the dashboard instead of the session summary.
- Evidence: `organizer/40-after-end-session.png`.

## Detector and measurements

- **`impeccable detect src`:** 2 findings.
  - `border-l-4` in `organizers-tab.tsx:286`: real but minor; it repeats information the row already shows.
  - `animate-bounce` on the "Move to Sitting" button in `current-round.tsx:899`: real. It's a moving 28 px target with no reduced-motion guard.
- **Live overlay:** the hard shadows and cream palette match the deliberate brand, not defects. Functional controls use 10 px labels (Back, Settings, End, + Add Game).
- **No horizontal overflow; layout shift (CLS) 0 on every page.**
- **Tap targets under 44 px:**

  | Page | Controls under 44 px |
  |---|---|
  | Signup | 27 of 33 |
  | Group dashboard | 30 of 48 |
  | Live session | 11 of 14 |
  | Profile | 13 of 14 |

  - The worst is the info icons at 16 × 16.
  - The header END on the session page is 28 px tall and sits next to Settings.
  - Save Result, Save All and Save & Start are 36 px tall.
- **Score inputs:** `type="number"` without `inputMode="numeric"`, so iOS shows the punctuation keyboard instead of a keypad.

## Strengths worth keeping

- **Invite flow** handles all three cases: already a member, signed in, and signed out. The `?next=` parameter brings new signups back to the join card.
- **Save & Start** is a single tap. Late arrivals move into the rotation correctly.
- **Stale-tab protection** refuses to overwrite; the in-progress End modal lists the courts still playing; past scores can be edited inline.
- **The completed-session summary** (W/L, closest game, rounds with sit-outs) reads well on a phone.

## Test data left in the test database

- **Player review:** accounts `uxorg400790`, `uxplayer400790`, `uxlate400790`; group `grp_09318bec-9`.
- **Organizer review:** account `ux_org_329558`, `ux_co_936431`; group "UX Tuesday Ladder 9558", which has an active session and a tournament.
- **Detector pass:** accounts `uxdetmwfeplo4`, `uxdetmwfeseiy`, `uxsrmwfetq3u`, each with a group and a session.
