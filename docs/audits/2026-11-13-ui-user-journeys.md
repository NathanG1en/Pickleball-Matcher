# UI audit — player and organizer journeys

Audited November 13, 2026, at commit 94c5aae using Impeccable 4.9.0 and headed Chromium driven through Playwright CLI. Local Next.js development server on port 3100 used the separate TEST_DATABASE_URL. Browser interactions used visible links, fields, and buttons. Primary viewport was 390 × 844, with a 1440 × 900 scoring check. Screenshots are under `output/playwright/ui-audit-2026-11-13/`.

## Implementation integrity

The inspected screens express a coherent courtside product with bold headings, strong outlines, lime primary actions, and readable score inputs. Qualified pass for the inspected journeys. The detector returned two source candidates. Its side-border warning in `src/components/groups/group-settings/organizers-tab.tsx:286` represents a staged selection accent and is not sufficient evidence of a defect. The `animate-bounce` advisory in `src/components/rounds/current-round.tsx:899` needs a rendered manual-edit/reduced-motion check before promotion to a finding.

## Coverage and outcomes

| Role | Journey | Result |
|---|---|---|
| Player | Home → create account → discover groups | Signup completed. Empty discovery page exposed unclear empty-state copy. |
| Player | My Profile → Edit Profile → change display name → save | Saved Alex Courtside successfully, subsequently shown on the group roster. Edit mode focused the name field. |
| Organizer | Profile → Create → create private group → add three guests | Completed with four roster entries including the host after updating the test schema. Each guest addition confirmed via toast. |
| Organizer | Start New Session → Normal → courts/attendance → pairings → start → start round → submit 11–8 | Completed. Result displayed FINAL and round progress changed to 1 of 1 done. |

The same new account exercised ordinary-player flows before becoming host of its new group. This did not exercise a separate non-host member's permissions. The audit account is `audit_1113_player`, group `grp_9921fbeb-c`, session `session_84e811bd-fb7`. These fixtures remain in the test database.

## Health assessment

| Dimension | Score | Evidence |
|---|---|---|
| Accessibility | 2/4 | Confirmed contrast failure in scoring. Form labels and edit focus worked. |
| Performance | Unrated | Development compilation prevents representative production measurements. |
| Theming | 2/4 provisional | Hard-coded destructive-action color produces a verified contrast failure. Alternate themes untested. |
| Responsive design | 3/4 provisional | Scoring fits mobile and desktop. Mobile document width equalled viewport width, 390px. Small cancel target and deeply placed start action remain. |
| Implementation integrity | 3/4 provisional | Coherent UI with inconsistent wizard progress and discovery messaging. |

Observed subtotal 10/16. A complete /20 rating would require production performance evidence. These scores describe sampled surfaces, not site-wide conformance.

## Findings

### P1 — Cancel match fails text contrast

- Location — `src/components/results/results-entry.tsx:362`.
- Category — Accessibility / Theming.
- Reproduce — Create a normal session, start the round, enter 11 and 8, save the result, inspect Cancel match.
- Evidence — Axe reports foreground #ff6b6b on #ecfdf5 at 2.63:1 for bold 12px text. WCAG 1.4.3 requires 4.5:1. See `axe.txt` and `scoring.png`.
- Impact — The destructive action is difficult to read, particularly outdoors.
- Recommendation — Use a destructive text token meeting 4.5:1 on every result-card background, including active and final states. Verify all states after changing it.
- Suggested command — `$impeccable harden`.

### P2 — Cancel match has a 16px-high target

- Location — `src/components/results/results-entry.tsx:359`.
- Category — Responsive / Accessibility.
- Evidence — Playwright measured 90.84 × 16 CSS px at 390px viewport width.
- Impact — Precise tapping is required for a consequential action during courtside use.
- Recommendation — Give the button at least a 44px-high interaction area. A WCAG 2.5.8 failure is not asserted because spacing exceptions were not fully evaluated.
- Suggested command — `$impeccable adapt`.

### P2 — Session wizard changes its promised length

- Location — `src/app/g/[groupId]/sessions/new/new-session-client.tsx:148`.
- Category — Implementation Integrity.
- Reproduce — Open Start New Session, observe Step 1 of 2, select Normal Session, observe Step 2 of 3, then continue to Step 3 of 3.
- Impact — Organizers receive an inaccurate expectation of the remaining setup effort.
- Recommendation — Omit the total until the format is known, or show a total consistent with the selected flow.
- Suggested command — `$impeccable clarify`.

### P2 — Start session sits below lower-priority content on mobile

- Location — `src/app/g/[groupId]/page.tsx:377`; `src/components/groups/home-screen-tip.tsx`.
- Category — Responsive / workflow hierarchy.
- Evidence — `roster.png` shows the start action below the expanded guest form, four-player roster, and installation tip, roughly 1,600px into the captured page. This is a UX judgment based on the observed layout.
- Impact — A frequent organizer action requires substantial scrolling even with a small roster.
- Recommendation — Place a start-session action near the group header and keep it readily accessible as the roster grows. Deprioritize the installation tip relative to session controls.
- Suggested command — `$impeccable layout`.

### P2 — Empty discovery implies a failed search before one was submitted

- Location — `src/components/players/public-group-list.tsx:34`.
- Category — Implementation Integrity / UX copy.
- Reproduce — Finish signup with no public groups available. The empty search field is followed by “No public groups match that search.”
- Evidence — `discovery.png`.
- Impact — A new player receives no explanation of how to proceed when discovery has no inventory.
- Recommendation — Distinguish an empty directory from a search with no results. Explain that a player can ask an organizer for an invitation or create a group, with appropriate navigation.
- Suggested command — `$impeccable onboard`.

### P2 — Group creation exposes raw database errors

- Location — `src/components/groups/create-group-form.tsx:25`, which displays `result.error`.
- Category — Implementation Integrity / error recovery.
- Evidence — Before applying the pending test migration, group creation displayed `column "organizer_permissions" does not exist`. See `setup-error.png`.
- Impact — The message gives organizers no useful recovery instructions and reveals implementation details.
- Recommendation — Map unexpected server failures to a useful general error with retry guidance, retaining diagnostic detail in server logs.
- Environment qualification — The triggering schema mismatch was local to the test environment. Production failure is not established. Running the existing `npm run db:migrate:test` applied `202611100001_group_organizer_permissions.sql`; retry then succeeded with the preserved group name.
- Suggested command — `$impeccable harden`.

## Strengths and limitations

Signup, profile editing, guest creation, normal-session setup, and score saving completed through the UI. The four-player count included the host. Pending saves disabled submission, and saved scoring had clear final status and progress. Mobile score fields stacked coherently and desktop fields used two columns. The mobile scoring page had no horizontal overflow.

This was a focused exploratory audit, not the full E2E suite. Axe ran against the scored session's main region only. Physical touch, gesture synthesis, full keyboard traversal, screen readers, dark mode, production performance, large rosters, joining a public group, open play, tournaments, and non-host authorization were not validated. Screenshots include development-tool overlays, which are excluded from product findings. No app behavior or test expectations were changed.

## Recommended actions

Address the P1 contrast issue with `$impeccable harden`, then enlarge the cancel target with `$impeccable adapt`. Use `$impeccable clarify` for the wizard, `$impeccable layout` for group actions, and `$impeccable onboard` for empty discovery. Harden unexpected server errors. Finish with `$impeccable polish` and repeat the affected journeys and accessibility scan.
