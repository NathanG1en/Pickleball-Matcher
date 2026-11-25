# Training and Challenges — `/training`

The Training Hub enables players to practice drills solo or with peers, track personal bests across five standardized tracking formats, and participate in weekly training plans published by their groups. It is completely isolated from competitive game matchmaking and Elo rating calculations.

## Navigation & Access

- **Accessible via Site Navigation:**
  - **Desktop:** The center top navigation bar features a direct **Training** pill link placed after **Players**.
  - **Mobile:** The fixed 5-tab bottom navigation bar includes **Training** as a core destination between **Players** and **Profile**.
- **Group Dashboard Links:** Group dashboards (`/g/[groupId]`) feature a **Weekly Training** card linking directly to `/training?group=[groupId]` with pre-filtered context.

## Page Order

`/training` opens on this week's work: the personal weekly plan first, then any group plans, then the **All-time practice** totals, then the **Drill Library** (heading, category filters, and drill cards).

## All-time Practice Totals

Signed-in players see an **All-time practice** card below their weekly plans (hidden when signed out and in the group view). Each total is a large number with a small icon and label beneath it, laid out 2 × 2 on phones and as one grouped row on wider screens:
- **Attempts logged:** Count of unique challenge attempts recorded across all drills.
- **Personal bests:** Count of drills where the player holds a recorded personal best.
- **Days practiced:** Unique calendar days with logged training activity.
- **Practice points:** Growth-oriented gamification XP awarded for participation, daily consistency, and personal best breakthroughs (independent of raw Elo ratings).

## Personal Weekly Training Plan — `/training` and `/training/plan/new`

Signed-in players always have a default weekly training plan ready on `/training` for the current week, eliminating any requirement to "create plan" to get started:
- **Header:** "Week of [Sunday Date]" above the heading **My Weekly Plan**. A custom plan title replaces the heading; auto-generated "Week of … Plan" titles are not shown because they repeat the week.
- **Default Empty Plan:** When visiting `/training`, players see their active weekly plan container immediately. If empty, it reads **No drills yet** ("Add up to 6 drills to practice this week.") with a highlighted **+ Add Drills** button.
- **Plan Actions:** Two controls: **+ Add Drills** toggles an inline drill picker (it reads **Done Adding** while open and is hidden once the plan has 6 drills), and an **Edit Plan** text link opens `/training/plan/new` for titles, notes, goals, and removing drills.
- **Participant Format Restrictions:** Group drills (`participantFormat === "group"`) cannot be added to an individual plan. In the drill library, group drills display a dedicated **Group Drill** badge instead of "+ Add to Plan", and are omitted from individual plan selectors. Individual plans support individual and partner drills.
- **Target Week Selector:** Formatted human-readably as "Week of [Sunday Date]" (e.g. "Week of Nov 22, 2026 (Current Week)") rather than raw week numbers.
- **Drill Selection:** Select 1 to 6 focus drills from the challenge library.
- **Goal Setting:** Add custom benchmarks or target notes for individual drills (e.g. "Hit 18/20 drops" or "Under 28s") via **Edit Plan**.
- **Training Weeks:** A training week runs Sunday through Saturday. An attempt counts toward a weekly plan when it is recorded between that Sunday at 00:00 and the next Sunday at 00:00 (server time).
- **Weekly Progress Tracking:** Once the plan has drills, a progress bar with the label "X of Y drills practiced" (a drill counts once any attempt is logged that week, whether or not its goal was met), drill checkmarks, and visual strike-throughs update as attempts are recorded.
- **Direct In-Plan Result Recording:** Players can record attempts directly on each drill item in their plan card via **+ Record** without searching for the drill in the library. An inline logger expands right in the plan card, and saving instantly marks the drill done, awards points, and updates the progress bar live.
- **Add to Plan from the Library:** In the Drill Library below, every eligible drill card provides a one-click **+ Add to Plan** button (updating to **In Plan ✓**) to append drills to the current weekly plan.

## Group Weekly Training Plans Under Personal Plan

When a viewer belongs to one or more groups that have an active weekly training plan:
- Each group plan appears directly underneath the player's personal training plan on the main Training Hub (`/training`).
- **Group Name Tag:** Each group card features a badge with the group name above its heading: the plan's custom title, or **Group Plan** when the title is auto-generated. A "X of Y drills practiced" progress bar shows the viewer's own completion.
- **Direct In-Plan Recording:** Group members can see all drills assigned for that week, see their personal completion status, and record results directly via **+ Record**.
- **Open Group Drills:** Each card links to **Open Group Drills →** (`/training?group=[groupId]`) to practice that week's group drills with full drill cards. Organizers also see **Edit Group Plan**.

## Group Weekly Drills View — `/training?group=[groupId]`

When navigating to a group's plan (via "Practice Weekly Drills →" on the group dashboard or "Open Group Drills →" on a group plan card):
- **Dedicated Drill Spot & Group Progress:** The page focuses on that specific week's drills assigned to the group, showing group progress %, coach focus notes, and completions across group members.
- **Participant Format Restrictions:** Individual drills (`participantFormat === "individual"`) cannot be added to a group plan. Group plans support group and partner drills.
- **Header:** **Weekly Training** with the group name beneath it.
- **Group Training Banner:** Displays "Week of [Sunday Date]", the plan's custom title (or **This Week's Drills** when the title is auto-generated), coach focus notes/tips, and a "X of Y drills practiced" progress bar for the viewer. Organizers see **Edit Plan**.
- **Custom Drill Goals:** Each challenge card displays any custom target goals set for that drill in the weekly plan.
- **Focused Filtering:** Category filter pills dynamically adapt to only display categories present in the current weekly plan (plus "All Plan Drills").
- **Clean Context:** Suppresses the personal training plan card, other group banners, and the all-time practice totals while practicing the group's weekly drills.
- **Navigation:** Header includes quick links to return to the group dashboard (`← Back to [Group]`) or explore the general drill library (`Browse All Drills`). Organizers have a direct `Edit Plan` shortcut.
- **Empty State:** If no weekly plan has been published for the target week, a helpful empty state explains this and gives organizers a single-click action to create one.

## Category Filters & Filterable Labels

All visible drill labels across the drill browser, individual plan builder, and group plan builder are directly filterable:
- **Interactive Category Badges:** Tapping the Category badge on any drill card or item filters the list directly to that category (and toggles back to All Drills if tapped again).
- **Filter Pills:** Category pill controls allow quick filtering across **All Drills**, **Dinking**, **Third Shot**, **Serving**, **Volleys**, **Resets**, **Conditioning**, and **Strategy**. In plan builders, pills indicate how many focus drills are currently selected within each category.
- **Removed Unfilterable Labels:** Metadata that cannot be cleanly filtered (such as participant format and tracking format) is omitted from drill cards and selection lists to eliminate clutter and keep filtering fast and intuitive.

## Standardized Drill Library (30 Drills)

The drill library contains 30 standardized drills spanning 6 core skill categories:
- **Dinking & Kitchen Control (6 drills):** Crosscourt Dink Streak, Dink Target Practice, Backhand Dink Challenge, Dink and Speed Up, Dink Under Pressure, Short and Deep Dinks.
- **Third-Shot Drops & Transition (6 drills):** Third-Shot Drop Repetition, Drop and Advance, Third-Shot Drop Placement, Drop vs. Drive Decision, Five-Ball Transition Drill, Return, Drop, and Dink.
- **Resets & Defensive Skills (5 drills):** Reset Master, Transition Zone Resets, Reset Under Pressure, Block and Counter, Defensive Footwork.
- **Volleys & Hand Speed (5 drills):** Volley Rally Challenge, Hand Speed Battle, Body Bag Defense, Attack and Counter, Alternating Volley Targets.
- **Serving & Returning (4 drills):** Deep Serve Challenge, Serve Placement Challenge, Deep Return Challenge, Return Placement Challenge.
- **Doubles Strategy & Point Construction (4 drills):** Seven-Shot Patience, Skinny Singles, Attack vs. Defense, Situational Doubles.

## Challenge Cards & Reusable Result Logger

Each drill is presented in an editorial neobrutalist card with:
- **Filterable Category Badge:** Tapping filters the browser to that category.
- **Done Badge:** Highlights drills with completed attempts in the current calendar week.
- **Personal Best Banner:** Shows the player's lifetime highest score or best time for that drill. Once the drill has attempts, a **History** link opens the drill history page.
- **Instructions & Setup:** Expandable guide outlining court setup, target cones, and drill rules.
- **Inline Multi-Attempt Logger (`+ Record Attempt`):**
  - Allows logging multiple attempts in one practice session directly on the card without page reloads.
  - **Last time:** Above the inputs, a muted line shows the player's most recent result for that drill (e.g. "Last time · 16/20 (80%) · Yesterday") with a **History** link to the drill's history page. Inputs are pre-filled from that result. Before the first attempt it reads "First attempt. This will be your starting point." After a save the line shows the new result ("Just now"); **Undo** restores the previous one.
  - Tailors inputs to the tracking format (e.g. Shots In vs Total Attempts for accuracy with live percentage preview; duration in seconds for timed sprints; +/- steppers with 16px numeric inputs).
  - **Partner Selector:** In a group context, partner and group drills allow selecting a partner from the active group roster. A single shared result is written with participant links, avoiding duplicate entries.
  - **Instant Feedback:** Celebratory banner on save highlighting practice points earned and whether a new personal best was achieved.
  - **Undo:** The save confirmation includes an **Undo** button that deletes that attempt. The card's personal best, **✓ Done** badge, and plan checkmarks/progress roll back to their state before the attempt (a drill stays done if it already had another attempt that week). The banner then reads "Attempt removed." If undo fails, the error is shown and **Undo** stays available to retry. Signed-in players and roster guests (in a group context) can undo their own attempts.

## Drill History — `/training/drills/[challengeId]`

Opened from **History** on a drill card's personal best row or from the logger's "Last time" line. Group context (`?group=[groupId]`) is kept so roster guests can view their own history and choose partners.
- **Headline:** Latest result (with the accuracy breakdown when relevant) and personal best, followed by a plain-language summary that compares the best result on the first and most recent practice days in the range using the drill's own metric and units (e.g. "Up 15 percentage points since Nov 3 (65% → 80%).", "3.2s faster since Nov 10 (31s → 27.8s)."). A single practice day reads "Starting point: 65% on Nov 15."
- **Activity line:** Neutral gap copy ("Last logged 9 days ago") plus attempt and day counts for the range.
- **Date range:** **Last 90 days** (default) or **All time** (`?range=all`). If nothing falls in the last 90 days the headline says so and **All time** shows older results.
- **Trend chart:** Shown once there are two or more practice days. Plots the best result per day on a date-scaled axis (gaps between sessions are visible), labels the first and last dates and the value range, and draws the drill's target benchmark as a dashed "Target" line. Timed drills are captioned "lower is better". The chart has an accessible text summary.
- **Record from history:** The standard result logger (with Last time and Undo) sits below the summary; saving or undoing refreshes the headline, chart, and list.
- **Attempts list:** Newest first, with value, weekday and date, notes, and a **PB** tag on the first attempt that reached the personal best. Attempts the player logged themselves have a two-step **Delete** (Delete → Delete / Keep) for correcting mistakes; on failure an error and **Retry delete** are shown. Attempts logged by a partner are listed without a delete control.
- **Signed out:** Shows a sign-in prompt that returns to the same history page.

## Create Weekly Plan (Organizers) — `/g/[groupId]/training/plan/new`

Accessible to group hosts and organizers from the group dashboard:
- **Fields:** Plan title, target week dropdown formatted as "Week of [Sunday Date]" (defaults to current Sunday week), and optional coach notes/tips.
- **Category-Filtered Drill Picker:** Browse and filter drills with category pills and interactive badges with active selection counts. Select 1 to 6 challenges from the system and group drill library.
- **Publishing:** Instantly activates the plan for the group, updating the group dashboard card and member training hub.

## Mobile-First Responsive Design

- **Touch-Friendly Controls:** Steppers and action buttons enforce 44px minimum touch targets (`min-h-[44px]` / `h-11`) with `touch-manipulation` to eliminate mobile tap delays.
- **iOS Safari Optimization:** All form text inputs, number fields, and selectors enforce a minimum 16px font size to prevent automatic browser zoom on mobile viewports.
- **Zero Horizontal Scrolling:** Category filter pills and card contents wrap cleanly within the mobile viewport width so that all drills, controls, and weekly goals are immediately visible without any left-or-right horizontal scrolling.
- **Unified Desktop Max Width:** The training hub aligns with `max-w-4xl mx-auto` and a 2-column drill grid (`sm:grid-cols-2`), matching the layout proportions and container widths of the Home and Groups tabs without over-stretching on wide monitors.
- **Safe Area Bottom Navigation Clearance:** The page maintains ample bottom padding (`pb-28`) ensuring all cards and action buttons remain fully visible above the fixed mobile bottom navigation bar and home indicator.

