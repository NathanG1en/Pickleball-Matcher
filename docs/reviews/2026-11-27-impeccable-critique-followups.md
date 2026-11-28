# Impeccable critique follow-ups (2026-11-27)

This log covers the second pass on the whole-app Impeccable critique. The first pass fixed the top three issues: live session ergonomics (`4e69b41`), colour roles (`683d9f0`) and legibility (`99505e1`). This pass covers the rest of the list: consistency and layout, score entry, training page length, and minor polish.

Measurements were taken on the local test server with seeded test data, at a 390×844 phone viewport unless noted.

## What changed

### Consistency and layout (`0f01b78`)
- **Roster page** (`/g/[groupId]/players`):
  - The page scrolled sideways on phones (431px content in a 390px viewport). The cause was `main` inside a flex parent without `min-w-0`. The page is now 390px wide.
  - Removed the redundant "Roster" pill.
  - The back link is now "← Back to Group" with a 44px target.
  - Long group names wrap.
- **Group dashboard:**
  - Shows "Lineup being set" instead of "Round 0".
  - The home-screen tip sits in the sidebar on desktop and at the end of the page on phones, instead of pushing content down.
- **Home-screen tip:** dropped the eyebrow label; now a plain heading with an icon and a 44px dismiss button.
- **New session flow:**
  - Removed the eyebrow pill rows.
  - The Open Play select button now matches the normal-session button (black selection, not lime).
- **Training:**
  - "Browse All Drills" in the group header appears only when a plan exists.
  - Drill library filters are hidden when the library is empty.

### Minor polish (`97726c9`)
- **Home:**
  - The tagline is now "Fair sit-outs, varied partners, balanced games."
  - The recovery-email banner shows on the profile only, not on home.
- **Rating chart:** after one session it shows a short first-session message instead of a lone dot. The hover and tooltip checks moved to the two-session test in `rating-history.spec.ts`.
- **Mobile action bar:** static at 1024px and wider, so it no longer floats over the courts on desktop.
- **Public group list:** signed-in empty states no longer repeat a "Create a group" button.

### Training page length (`11c0de5`)
- **Drill cards are now compact rows:**
  - The description sits behind an "About this drill" toggle.
  - The personal best fits on one line with a History link.
  - "+ Record Attempt" opens the logger inline.
- **Category filters** list only categories that have drills.
- **Page height:** phone 13,783 → 8,628px (−37%); desktop 7,471 → 4,950px (−34%).

### Score entry (`a673505`)
- **Ties:**
  - A tie is flagged inside the court card as soon as both scores match.
  - That court's Save and Save & Start Next Round stay disabled until the tie is fixed. Previously the organizer only learned about the tie after a server round trip.
  - The server-side check stays in place as the backstop.
- **Save All:** appears only when two or more courts have unsaved edits. With a single change, the court's own Save button is the only save, so there are no longer two competing buttons.

## Decisions and intentional exceptions
- **Login page has no nav** (`/player-login`). This was intentional in `98d25df` and is covered by a unit test, so it was kept.
- **Quick-score chips skipped.** Select Winner already fills 11, and the remaining score is a single number entry. Chips would add a row of controls to every court card for little gain.
- **Save All kept, not removed.** `bulk-score-saving.spec.ts` shows Save All is a deliberate feature (it saves every court and protects against a stale tab). The change hides it until it's useful instead of removing it.
- **Reasons for disabled buttons:** the key flows already say why a button is disabled (Save & Start names the courts still missing scores). No blanket change was made elsewhere.
- **Manual Edit swap** keeps lime: it is the primary action in that mode.
- **Grey-on-yellow advisory** from `impeccable detect` could not be reproduced on rendered pages. The measured combination is 5.9:1, which passes AA, so it is left as an advisory.

## Second round: the items left open

### Resilience test race (`4121e01`)
`tests/e2e/resilience.spec.ts:6` was not flaky timing in live sync. It waited for `text=Final`, which also matched the End session note ("Ending finalizes ratings"), so it moved on before Court 1 had saved. The second tab then loaded an unscored round, and its Save & Start was disabled.
- **Fix:** the test now waits for Court 1's own Final badge.
- **Result:** it passes on Desktop and Mobile Chrome, and the stale-tab "session changed" check and the a11y audits run again.
- **Note:** live session sync runs only for viewers, not organizers, so a second organizer tab still goes stale by design. That is what this test checks.

### Acceptance spec (`40433d4`)
- `acceptance.spec.ts:6` still looked for the old `in-progress-warning-modal` after End moved to the shared ConfirmDialog (`4e69b41`).
- It now checks `end-session-dialog` and passes on both projects.

### Nested cards and dashboard balance (`496f67c`)
- **Flatter cards:**
  - Court cards: team panels are flat white surfaces with no border or shadow. Only the viewer's team gets a black ring.
  - Dashboard matchup rows are flat. The viewer's court keeps its outline and "You're here" tag.
  - The roster list no longer draws a bordered, shadowed card inside the yellow roster panel.
  - The home-screen tip shows its install steps as plain text, not a bordered box.
  - The empty tournaments state is one line instead of a dashed box with a second "Create First Tournament" button. The section header already has + Create Tournament.
- **Balance:** on desktop the dashboard roster list scrolls inside its panel after about seven players, with half a row showing as a cue. Phones show the whole list.
  - Measured at 1280×800 with 8 players: the sidebar went from 1,197 to 1,117px, and the left column from 642 to 514px below the session card.
  - Before this change, a big roster made the sidebar grow without limit. In a populated group, the session, training, tournaments and past sessions now fill the left column against a sidebar of bounded height.
  - A brand-new group with little history will still have a taller sidebar than left column, which is expected for an empty group.

### Playwright browser
Ran `npx playwright install chromium`, which installed headless shell build 1243 to match Playwright 1.63. Targeted specs now run with the default `playwright.config.ts`, without the temporary executable-path config.

## Still open
Nothing from this critique.
- **Dashboard roster row buttons:** the pin and ··· buttons are 32px, under the 44px target used elsewhere. They were not in the critique list, so I left them for a later pass.

## Verification
- `npm run typecheck`, `npm run lint`, and `npm test` pass (1,142 tests).
- Targeted e2e on Desktop and Mobile Chrome:
  - `corrections.spec.ts` and `bulk-score-saving.spec.ts`: 22 of 22 pass.
  - `resilience.spec.ts:6`: passes.
  - `player-live-session.spec.ts` and `permissions.spec.ts`: 30 of 30 pass.
  - `acceptance.spec.ts`: 18 of 18 pass after the fix above.
