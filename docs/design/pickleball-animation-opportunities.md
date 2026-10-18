# Lightweight pickleball animation opportunities

October 18, 2026. Source-based opportunity review with implementation notes below. Home-page, round-generation, session-setup court, and end-of-session motion are now implemented; remaining recipes are proposals.

## Current choices

- Implemented: home-page pickleball (including optional replay), pending round-generation ball, miniature court on session setup, and quiet end-of-session paddle/ball sign-off.
- **Deferred at the user's request:** tournament-winner paddle tap, and empty-session-history paddle-and-ball greeting. Keep both for later; they are not part of the next implementation.
- Additional ambiance candidates below remain ideas, not approved implementation work.

## Starting point

- Branch: `pickleball-animations`, from updated `development` / `origin/development` at `ba121c73c9923ede1d51108f55cb65532b4000ee`. This includes the preceding bug-finder fixes and subsequent development changes.
- Baseline: `npm test` passes 354 tests across 51 files.
- Intent: a few cute pickleball details, with small download and runtime costs. Keep the existing bold outlines and lime/yellow palette.
- Existing motion: home-page ping indicators, button press transitions, and pulsing manual-lineup affordances. The app already has a global reduced-motion rule in `src/app/globals.css:116`.
- No animation package is installed in package.json. Extend the existing CSS approach using small inline SVG paddle/ball illustrations.

## Original opportunity recipes

The timings below describe the initial prototypes. The slower-motion refinement at the end of this document records the current implementation.

| Priority | Location / today | Purpose | Frequency / function gate | Proposed motion |
| --- | --- | --- | --- | --- |
| 1 | `src/components/tournaments/tournament-bracket-manager.tsx:347`: champion banner has a static trophy | Delight | Rare winner-confirmation event; decoration stays separate from names and bracket controls | Two small paddle SVGs tilt from -8/+8 degrees to 0 while one ball rises 6px and settles. 280ms, one iteration, `cubic-bezier(0.23, 1, 0.32, 1)`. Animate transforms only. Trigger when a final winner is successfully recorded; opening an old bracket, refreshing, or changing divisions must not replay it. Reduced motion: static illustration; retain global accessibility behavior. |
| 2 | `src/app/page.tsx:68`: court divider contains a static green circle | Delight | First home-page visit per browser session; decorative divider does not move text or links | Turn the circle into a perforated pickleball SVG. One little dink: translateY(0 → -6px → 0) and rotate(-8deg → 0), 280ms, `cubic-bezier(0.23, 1, 0.32, 1)`. Stop at the final frame. No repeating background motion. A small client island may gate this by browser session without converting the whole home page to a client component. Reduced motion: static ball. |
| 3 | `src/components/groups/past-sessions-list.tsx:60`: “No sessions played yet” is text-only | Explanation / delight | First-run group state, not an ordinary populated list; illustration does not change reading order | A tiny paddle and ball next to the existing message. One paddle tilt of -6deg → 0 and ball translateY(-4px → 0), 240ms, `cubic-bezier(0.23, 1, 0.32, 1)`, once on entry. Reuse the same SVG shapes. No looping while the user fills in the roster. Reduced motion: static illustration. |
| 4 | `src/app/g/[groupId]/sessions/[sessionId]/session-manager-client.tsx:990`: Generate Round is disabled during its pending request | State indication | Occasional real waiting state; show activity without delaying the request or moving controls | A small ball near “Generating…” travels horizontally 8px and returns, 280ms per cycle, `cubic-bezier(0.77, 0, 0.175, 1)`, only while that specific generation request is pending. Delay visibility by 150ms so fast requests do not flash a loader. Reserve its space; do not wait for animation completion. Unmount as soon as the request settles, including errors. Reduced motion: static ball and pending text. Scope to generation; the shared isPending flag also covers other operations. |

The home-page dink, generation indicator, and miniature setup court have been selected and implemented. Champion paddles and the empty-session greeting remain deferred; other recipes are optional ideas.

## Deliberately rejected

- `src/components/results/results-entry.tsx`: bouncing scores or celebration after every save. Rejected by frequency and function: this is frequent data entry, and numbers must remain still and easy to verify.
- `src/components/rounds/current-round.tsx`: animated travel of every player during swaps or generation. Rejected by function: drag/drop and tap-to-swap are already interactive, and decorative movement would make lineup edits harder to follow.
- `src/components/groups/past-sessions-list.tsx`: stagger every row or animate every expansion. Rejected by frequency and function: users are looking up results; no pickleball decoration is needed on those interactions.
- `src/components/ui/modal.tsx`: add bouncing paddles to every modal. Rejected by frequency and purpose: confirmations, errors and permission prompts do not benefit from sports decoration.
- Home-page background and all navigation: continuous ball bouncing, cursor followers, or mandatory page-transition animations. Rejected by function and ongoing resource use: there is no state to communicate and no reason to keep work running while idle.

## Implementation and verification constraints

- Use a handful of inline SVG shapes and CSS keyframes. No new animation dependency, external animation assets, GIF/video, canvas, physics engine, per-frame React state, or animation fetch.
- Animate only transform/opacity on the decorative elements. Keep shadows, filters, SVG path shapes, dimensions and layout static. Do not set permanent will-change on every icon.
- Give illustrations fixed dimensions and `aria-hidden="true"`; retain actual labels and success/pending messages as accessible text. The SVG art does not intercept pointer events; replay controls use a named native button around it.
- Honor the existing global reduced-motion behavior. Essential information is readable with animation disabled and with JavaScript unavailable.
- Animations must never block a request, defer a result, disable otherwise available controls, or hold content invisible until JavaScript runs.
- Reserve a design budget of a few KB of SVG/CSS before compression; measure the actual patch rather than promise zero cost. Any home-page session gate should be a small client boundary. No additional network request should be needed for the art.
- Check mobile and desktop, CPU-throttled performance, and reduced-motion emulation. Inspect for layout shifts, repaint-heavy effects, and animation remaining active after completion.
- Update and run the relevant Playwright flows for changed screens, including champion readiness and reload behavior, plus the repo's lint, typecheck, unit and simulation gates.

## Verdict

The app needs only a small amount of themed motion. The chosen home-page, pending-generation, and session-setup details supply this character while working controls and data stay calm. The tournament and empty-history ideas remain deferred. A broader motion overhaul is unnecessary.

## References

- [Chrome: animation performance](https://github.com/GoogleChrome/web.dev/blob/main/src/site/content/en/blog/animations-and-performance/index.md): transform and opacity are the preferred starting point for efficient animation; actual performance still needs measurement.
- [W3C: respecting prefers-reduced-motion](https://www.w3.org/WAI/WCAG22/Techniques/css/C39.html): honor the user's motion preference.

## Home-page implementation

The home-page divider now uses `src/components/home/home-pickleball.tsx`: a 24px inline SVG and a one-shot 280ms transform animation. A small effect records the first eligible visit in sessionStorage (per tab session), so reloads and return visits do not replay it. Reduced motion and blocked storage leave the ball static. React Strict Mode effect reconnection does not cancel the animation. The rest of the home page remains a Server Component.

Verified with lint, typecheck, 354 unit/component tests, six simulations, and all ten resilience E2E checks across mobile and desktop Chromium, with no retries. The new browser checks cover one-shot playback, completion, reload persistence, usable navigation, reduced motion, blocked storage, and home-page accessibility. Desktop and mobile appearance was inspected using Playwright screenshots in `output/playwright/home-animation/`. No animation package or external visual asset was added. Build-transfer bytes and physical-device performance were not profiled.

The ball also replays on mouse entry, click/tap, and native button activation with Enter/Space. Its 44px button target remains still while the SVG moves. Mouse hover is gated to fine pointers with hover support; touch uses click. Repeated input during an active bounce is ignored until it finishes, and holding hover does not loop. Reduced-motion preferences suppress both automatic and requested replay. The parent divider no longer hides the interactive control from assistive technology; its lines and SVG remain decorative. Browser tests verify mouse, touch, keyboard, rapid activation, and reduced-motion replay behavior.

## Round-generation implementation

Generation and Next Round now show the same small ball beside “Generating…”. The ball starts moving after 150ms, loops only during the pending operation, and is unmounted on success or failure. A generation-specific React transition covers the server action and resulting route refresh; unrelated score saves retain their existing feedback. The home page and pending indicator share the inline SVG icon. Reduced-motion users see a static ball and the same status text. No animation library, external asset, timer, or per-frame React update was added.

Verification: lint, typecheck, 354 unit/component tests, six simulations, and 30 acceptance/corrections/resilience browser checks across mobile and desktop, all passing with zero retries. The new test holds real requests to check generation feedback, verifies its absence during score saves, aborts a request to check error cleanup/retry, and completes a request with reduced motion enabled. Open Play and permissions specs were not rerun for this change.

## Additional quiet ambiance candidates

These are small, isolated arrival/confirmation moments. Keep decorative motion outside readable text and controls, using the existing inline SVG/CSS approach. Each proposal respects reduced motion with a static illustration. No continuous background loop is proposed.

| Location / today | Purpose | Frequency / function gate | Proposed motion |
| --- | --- | --- | --- |
| `src/components/attendance/attendance-manager.tsx:123`: Available Courts heading has no illustration | Explanation / delight | Session setup, occasional; play on the first setup visit per tab, not when changing court counts or attendance | A miniature court beside the heading settles into place: opacity 0 → 1 and translateY(2px → 0), 200ms, `cubic-bezier(0.23, 1, 0.32, 1)`, once. A small ball settles by the baseline in the same beat. Keep court-count controls still and immediately interactive. |
| `src/app/g/[groupId]/sessions/[sessionId]/open-play-manager-client.tsx:699`: successful check-in produces a static “You're Checked In” badge | Feedback | Once per player per session; conveys successful arrival without moving roster entries | A small ball beside the checkmark makes one 3px hop, 200ms, `cubic-bezier(0.23, 1, 0.32, 1)`. Trigger only after that player's successful Join action; do not replay on polls, reloads, other players joining, or rendering an already checked-in account. |
| `src/app/g/[groupId]/sessions/[sessionId]/session-manager-client.tsx:610`: Completed Session badge is static | Feedback / delight | Rare session-end transition; decorative area remains separate from the final scores and statistics | A tiny ball rolls 6px and settles next to a resting paddle, using translateX(0 → 6px) and rotate(-12deg → 0), 240ms, `cubic-bezier(0.23, 1, 0.32, 1)`, once after successful End Session. Do not automatically replay while browsing historical sessions. This is a quiet sign-off, separate from the deferred tournament celebration. |
| `src/components/groups/share-group-modal.tsx:123`: Copy Link switches to a static checkmark and “Copied!” | Feedback | Occasional or tens/day; keep movement especially small and fast | On successful clipboard write, an icon gives a 2px settle with scale(0.97 → 1), 140ms, `cubic-bezier(0.23, 1, 0.32, 1)`. Keep the existing “Copied!” text; animate only the icon. Use a CSS transition so repeated copying retargets smoothly. Keep the QR code completely still and unobscured. |

### Additional rejections

- Scoreboards and player ratings: no count-up numbers or celebratory wiggles. The function gate rejects moving information people are trying to verify.
- Idle court/dashboard backgrounds: no floating balls, wandering paddles, or periodic nudges. Continuous motion fails the frequency/function gate and spends resources without conveying a change.
- Roster sorting, search results, and attendance switches: no sports-themed stagger or bounce. Frequent edits should feel immediate.

The miniature court on session setup was selected and implemented. The check-in badge and other candidates remain optional ideas. Add one at a time and visually review it before extending the same treatment elsewhere.

## Session-setup court implementation

`SetupCourtIllustration` sits beside Available Courts. Its fixed 80×48 SVG contains a small blue court and the shared lime ball. On the first eligible setup visit per tab, the court settles by 2px and the ball drifts 4px horizontally and 3px vertically over 200ms with the existing ease-out curve. The animation ends completely; editing attendance, court sizes, or court counts does not restart it. Reloads use the static illustration. Reduced motion and unavailable sessionStorage also leave it static. Its SVG is decorative and hidden from assistive technology; the surrounding replay button is accessible and separate from the setup controls. No animation library, image request, or frame timer was added.

Verification: lint, typecheck, 354 unit/component tests, six simulations, and all 26 acceptance/resilience browser checks on mobile and desktop passed with zero retries. Tests cover one-time playback, complete animation cleanup, attendance/court edits, reloads, starting a session, reduced motion, blocked storage, and accessibility. Mobile and desktop screenshots were visually inspected; physical-device performance was not profiled. The existing tournament and empty-history ideas remain deferred.

## End-of-session implementation

A small blue paddle and lime ball provide a 240ms sign-off after confirmed completion. Matchmaking keeps its existing immediate navigation back to the group dashboard; the illustration is in the top header so it is visible above a long roster. A one-use sessionStorage marker, scoped to group and session and expiring after 30 seconds, carries the confirmation across that navigation. It is consumed even when reduced motion is enabled. Storage failures leave a static illustration and do not interfere with ending the session. Open Play stays on its completed page and triggers the same illustration from local success state; its previous bouncing end-session toast is replaced by the quiet completed status. Past-session visits and reloads do not automatically replay motion. No navigation delay, animation dependency, external visual asset, or frame timer was added.

Verification: 357 unit/component tests, six simulations, lint and typecheck pass. All eight new mobile/desktop sign-off cases pass, covering both session types, reduced motion, cancelled and failed requests, reloads and history. Handoff unit tests cover consumption, group/session isolation, expiration, malformed data and unavailable storage. The broader 22-case corrections/Open Play run exposed an existing success-toast timer race in the mobile edit-game check: an older timeout could dismiss newer feedback. The timeout is now cancelled when replaced and on unmount. The desktop checks passed, and the complete five-case mobile Open Play suite passed after the fix. Sign-off artwork was visually inspected. Tournament winner and empty-session-history animations remain deferred.

## Manual replay

The setup court and end-of-session paddle now use native replay buttons, matching the home ball. Click or tap the art, or focus it and press Enter/Space, to see the animation again. Buttons have accessible names, visible keyboard focus, and at least a 44px touch target. A replay finishes before another can start, so rapid activation never stacks or restarts motion. Reduced motion suppresses requested replay too. Manual replay works even if sessionStorage is unavailable; the original first-visit and successful-completion gates still govern automatic playback. Replay never submits a form, ends a session, or makes a network request.

The round-generation indicator keeps looping only while its real request is pending. It is status feedback inside the generation control and needs no separate replay action.

Replay verification: all 12 focused setup, matchmaking-completion, and Open Play-completion browser checks passed across mobile and desktop Chromium with zero retries. They exercise click/tap, Enter, Space, rapid activation, reduced motion, unavailable storage, unchanged navigation and zero POST requests during replay. Setup accessibility and screenshots were checked. Lint, typecheck, all 357 unit/component tests, and all six simulations also passed. The full E2E suite was not rerun for this small change.

## Slower motion and intentional paths

At the user's request, the decorative sequences now last about four to eight times longer than the initial prototypes. These longer illustrations do not change the timing of any button, request, route transition, or result.

| Illustration | Current duration | Path |
| --- | --- | --- |
| Home ball | 1.2 seconds | A 10px rising arc, landing, then a smaller 3px rebound; a 2px sideways drift and light spin return exactly to rest. |
| Setup court | 1.6 seconds | The court stays fixed. The ball travels 54 SVG units across it, arcs 22 units over the net, lands near the baseline, and makes a 5-unit rebound before settling beside it. |
| Session sign-off | 1.4 seconds | A 14-unit horizontal roll toward the paddle, with 100 degrees of matching rotation and gradual deceleration. |
| Generating indicator | 1.6 seconds per full round trip | An 8px return path with a gentle 3px arc on each leg; unmount immediately when the real request settles. |

Small nested SVG groups separate horizontal travel, vertical arcs and spin. Quadratic ascent/descent curves give the ball a clear peak and landing; only the decorative falling ball uses accelerating descent. The pending shuttle uses sine easing for smooth reversals, and the roll uses cubic easing to lose speed. Values come from [easings.net's source](https://github.com/ai/easings.net/blob/master/src/easings.yml). All animated properties remain transform/opacity; no package, animation asset, network request, frame loop or React state update was added. Reduced motion, first-visit/completion gates and accessible replay controls remain in effect.

Verification covers 20 mobile/desktop browser scenarios across setup, generation, both session-ending flows, and the home page. New checks sample the browser's real paths, ensure the setup ball stays inside its illustration, check the longer durations and roll deceleration, and retain replay/reduced-motion/pending cleanup checks. The initial run caught an SVG spin-pivot error in the mobile setup check; moving spin to a group fixed it. The other 19 checks passed, including desktop setup after that correction, and the mobile setup rerun passed. Lint, typecheck, all 357 unit/component tests, and six simulations pass. The full E2E suite was not run. Home peak and setup launch/peak/rest screenshots were inspected in `output/playwright/`; physical-device performance was not profiled.
