# Session pages

For how ratings and pairings are calculated, see [elo-rating-system.md](../elo-rating-system.md).

## Start a session — `/g/[groupId]/sessions/new`

A short wizard for organizers with calm, readable typography. Headings and cards use natural casing and balanced density so titles do not compete with controls or content. A badge in the top-right shows progress. The total number of steps depends on the format, so it isn't shown until a format is chosen.

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

- **Who can open it:** members of the group.
  - A signed-out visitor opening a session link goes to sign in. The sign-in page names the group and offers **Not in this group yet? Join as a guest**.
  - A signed-in non-member goes to the group's join page. After joining, they continue straight to the session.
- **Heading home early:** below the courts, players checked in to a live session see "Heading home early?" with **I'm leaving after this round**.
  - Tapping it keeps them in their current game but leaves them out of every later round. The card then reads "You're out from Round N".
  - **I'm staying** undoes it.
  - Guests can use it from the device they joined on.

- **Before a round starts:** "Waiting for Next Round".
- **Live updates:** while the tab is visible, the page checks every 5 seconds whether the session has changed. It also checks straight away when the tab comes back into view, the window regains focus, or the device reconnects. If something changed (a round started or finished, a score was saved or a match cancelled, the round number moved on, or the session ended), the page refreshes itself. No manual reload is needed.
- **"You" card:** once a round is running, a card above the courts shows the viewer's own assignment:
  - **Playing:** "You're on Court N", with their partner (or "Singles") and their opponents. When the game ends it shows the result from their side, for example "Final · You won 11–8". If the organizer cancels the game, it says so.
  - **Sitting out:** "You're sitting out", with a note that they'll have priority when the next round is made.
  - **Not in this round:** for example, a player who arrived late and isn't checked in. No card is shown.
- **Team highlight:** the viewer's team on its court card is highlighted lime and tagged **You**. Organizers who are playing also get this highlight; they don't get the "You" card, which keeps their scoring screen compact.

### Games played · rounds sat out

While a session is running, a collapsed **Games played · rounds sat out** panel sits below the courts, for organizers and players alike.
- Opening it lists everyone checked in, plus anyone who has already played or sat. Each person shows the games they played (cancelled games don't count) and the rounds they sat out.
- The people most owed a game are listed first. The viewer's own row is highlighted.

### Proposed lineup (organizers)

Before each round, organizers review a proposed lineup and then tap **Start Round**.

- **Stable:** the default lineup for a round is the same on every load. Reloading, the phone locking, a second tab, or a co-organizer's phone all show the same courts and sitters. It changes only when its inputs change: attendance, Stay Together pairs, court settings, or results.
- **Fairness & Nonstandard Matches:** players assigned to a singles or 2-vs-1 match receive a sit credit rather than a full played-game credit for matchmaking fairness accounting, giving them the same next-round priority to play in doubles as a player who physically sat out. Their match appearances remain tracked for match history, stats, and format-repeat prevention, and remain unrated for Elo calculations.
- **Reshuffle and variety:** **Reshuffle** explores a small set of near-best candidate lineups within a tight score tolerance to produce a visibly different valid lineup when a reasonable alternative exists. If no meaningfully different valid alternative exists, the current lineup is preserved and the organizer is informed that no alternative was found. The chosen lineup is remembered on this device until the round starts or the session changes, so a reload keeps the lineup that was read out. Other devices keep showing the default lineup.
- **Manual edits:** moving players by hand is saved on the device, as before.
- **Out-of-date lineups:** starting a round checks the lineup against who is present right now. If someone left (for example, a player tapped "I'm leaving" on their phone) or a present player is missing, the start is refused. The error names who changed, for example "The lineup is out of date: Jordan left". The page then refreshes itself, and the start buttons stay disabled until the updated lineup arrives.

### Session scoring (organizers)

Each court is a card (`court-match-N`) with both teams and a score input for each team (“Court N Team M score”). The court grid adapts intentionally to court count and viewport width:
- **1 court:** centered with a focused, readable width rather than leaving an empty right column.
- **2 courts:** balanced 2-column grid with comfortable proportions on wide desktop displays.
- **3+ courts:** responsive 2-to-3 column grid that takes advantage of desktop width without stretching cards excessively.
- **Mobile view:** single-column layout with accessible touch targets and full usability.

- **Card states:** open cards are cream. Once a result is saved the card turns pale green and shows a **Final** badge with start and finish times. Cancelled cards are greyed out and labelled Cancelled.
- **Save Result / Update Score:** the button is disabled while either score is blank, while a save is in progress, and when a saved score hasn't changed. Validation errors, such as a tied score, appear inside the card and keep the scores the organizer typed.
- **Cancel match:** organizers can cancel any match that isn't already cancelled. It first asks "Cancel the Court N game?" and spells out what is lost: for a finished game, its score and the rating changes from it; for an unfinished game, that nobody on the court gets a result this round. **Keep match** backs out; **Cancel match** confirms. It is a dark red text button with a 44 px-high tap area, and it is readable on both the open and final card colours.
- **Winner selection:** each team has a **Select Winner** button with a crown icon positioned in the score input row, keeping team names unobstructed on all screen sizes. Tapping it marks that team as the winner and autopopulates their score with 11 (matching Open Play). If the opposing team's score was 11 or higher, it is cleared to prevent an invalid score or tie. When a team has reached a winning score (11 or higher and leading), the button turns black with lime text and displays **Winner**.
- **Score drafts:** scores typed but not saved are kept for this browser tab. If the phone locks and the page reloads, they come back, but only for games still waiting for a result.
- **Score inputs:** use numeric inputs (`type="number"` and `inputMode="numeric"`) with a minimum 16 px font size to prevent mobile browser auto-zooming on iPhone and bring up the number keypad directly on mobile devices. Organizers can still type or edit scores directly in the number inputs.
- **Why Save & Start is disabled:** when it can't be used, a line above the bar names what's missing, for example "Court 2 needs a score. Enter it, or cancel that game, to start the next round."
- **Up Next preview** (organizers, while a round is in play): a collapsible preview of the next round's courts and sitters. It notes that **Save & Start** uses this exact lineup and that it only changes when scores, attendance, or settings change. A reload shows the same preview.
- **Bottom action bar** (organizers): save all, or start the next round. These actions are blocked while score changes are unsaved.

### Session settings: attendance (organizers)

**Session Settings → Attendance** lists everyone on the roster, split into **Present** and **Not here / Left**. The counts in each heading are live.
- **Toggles:** each row has Present and Left buttons. For someone who never arrived this session, the second button reads **Not here**.
- **Stable rows:** marking someone in or out doesn't move their row while the dialog is open, so the list doesn't shift under the organizer's thumb. The sections regroup the next time Settings opens.
- **Search:** a box filters the list by name.
- **Guests:** organizers can add a guest mid-session from this tab.

### Ending a session

- **From the session page:** the header **End** button is accessible to organizers even when games or score edits are in progress. Tapping it prompts for confirmation; if games are still in progress, an in-progress warning modal lists them first before discarding in-progress match drafts and finalizing the session. It reads "Ending…" only while the session is actually ending, not during other actions. Upon confirmation, the session state immediately transitions to completed, disallowing duplicate submissions while navigating.
- **After ending:** the organizer remains on the session page, which transitions directly to the completed session summary with the sign-off animation playing in place. A header back button returns to the group dashboard whenever desired.
- **The summary:** the completed session shows totals, highlights and every round. Each player gets a "Your Session" panel with their wins and losses and their rating change, for example "Rating 3.5 → 3.56 (+0.06)". If they played no rated doubles games, it says their rating didn't change.

