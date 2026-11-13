# Session pages

For how ratings and pairings are calculated, see [elo-rating-system.md](../elo-rating-system.md).

## Start a session — `/g/[groupId]/sessions/new`

A short wizard for organizers. A badge in the top-right shows progress. The total number of steps depends on the format, so it isn't shown until a format is chosen.

1. **Choose Session Format.** Badge: “Step 1 · Format”. Two cards:
   - **Normal Session** (`select-normal-session-button`): algorithmic pairings, balanced court assignments with sit-out rotation, and synchronized rounds.
   - **Open Play** (`select-open-play-button`): flexible games that players can join, leave, and log at any time.
   - **Back to Group** returns to the dashboard.
2. **Normal: Start Matchmaking.** Badge: “Step 2 of 3”. Set the court count (with +/− controls) and choose who is attending; the player count is shown as “N players selected”. **Change Format** goes back to step 1, and **Continue to Pairings** moves on.
3. **Normal: Stay Together Pairings.** Badge: “Step 3 of 3”. Optionally keep pairs of friends together as partners, then **Start Session** (`start-session-button`). **Back to Players** returns to step 2.

Open Play has one more step after the format:

2. **Open Play Setup.** Badge: “Step 2 of 2”. An optional session name, then **Start Open Play**.

If starting fails, an error appears and the organizer stays on the current step.

## Live session — `/g/[groupId]/sessions/[sessionId]`

### What players see

Players (members who are not organizers) get a read-only view of the session.

- **Before a round starts:** "Waiting for Next Round".
- **Live updates:** while the tab is visible, the page checks every 5 seconds whether the session has changed. It also checks straight away when the tab comes back into view, the window regains focus, or the device reconnects. If something changed (a round started or finished, a score was saved or a match cancelled, the round number moved on, or the session ended), the page refreshes itself. No manual reload is needed.
- **"You" card:** once a round is running, a card above the courts shows the viewer's own assignment:
  - **Playing:** "You're on Court N", with their partner (or "Singles") and their opponents. When the game ends it shows the result from their side, for example "Final · You won 11–8". If the organizer cancels the game, it says so.
  - **Sitting out:** "You're sitting out", with a note that they'll have priority when the next round is made.
  - **Not in this round:** for example, a player who arrived late and isn't checked in. No card is shown.
- **Team highlight:** the viewer's team on its court card is highlighted lime and tagged **You**. Organizers who are playing also get this highlight; they don't get the "You" card, which keeps their scoring screen compact.

### Session scoring (organizers)

Each court is a card (`court-match-N`) with both teams and a score input for each team (“Court N Team M score”).

- **Card states:** open cards are cream. Once a result is saved the card turns pale green and shows a **Final** badge with start and finish times. Cancelled cards are greyed out and labelled Cancelled.
- **Save Result / Update Score:** the button is disabled while either score is blank, while a save is in progress, and when a saved score hasn't changed. Validation errors, such as a tied score, appear inside the card and keep the scores the organizer typed.
- **Cancel match:** organizers can cancel any match that isn't already cancelled. It is a dark red text button with a 44 px-high tap area, and it is readable on both the open and final card colours.
- **Bottom action bar** (organizers): save all, or start the next round. These actions are blocked while score changes are unsaved.
