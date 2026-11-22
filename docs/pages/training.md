# Training and Challenges — `/training`

The Training Hub enables players to practice drills solo or with peers, track personal bests across five standardized tracking formats, and participate in weekly training plans published by their groups. It is completely isolated from competitive game matchmaking and Elo rating calculations.

## Navigation & Access

- **Accessible via Site Navigation:**
  - **Desktop:** The center top navigation bar features a direct **Training** pill link placed after **Players**.
  - **Mobile:** The fixed 5-tab bottom navigation bar includes **Training** as a core destination between **Players** and **Profile**.
- **Group Dashboard Links:** Group dashboards (`/g/[groupId]`) feature a **Weekly Training** card linking directly to `/training?group=[groupId]` with pre-filtered context.

## Player Progress & Stats

Signed-in players and roster guests view a summary dashboard at the top of `/training`:
- **Total Completed:** Count of unique challenge attempts recorded across all drills.
- **Personal Bests:** Count of drills where the player holds a recorded personal best.
- **Practice Points:** Growth-oriented gamification XP awarded for participation, daily consistency, and personal best breakthroughs (independent of raw Elo ratings).
- **Practice Days:** Unique calendar days with logged training activity.

## Personal Weekly Training Plan — `/training/plan/new`

Players can construct a customized training plan for themselves for any week:
- **Build Plan (`+ Build My Weekly Plan`):** Available directly from `/training`.
- **Target Week Selector:** Formatted human-readably as "Week of [Sunday Date]" (e.g. "Week of Nov 22, 2026 (Current Week)") rather than raw numbers like 48/52.
- **Drill Selection:** Select 1 to 6 focus drills from the challenge library.
- **Goal Setting:** Add custom benchmarks or target notes for individual drills (e.g. "Hit 18/20 drops" or "Under 28s").
- **Weekly Progress Tracking:** Displays an active progress bar with "X / Y Goals Met", drill checkmarks, and visual strike-throughs as attempts are recorded throughout the week.

## Your Groups' Weekly Plans

When a viewer belongs to one or more groups that have an active weekly training plan:
- A highlighted banner surfaces at the top of the main training hub showing each group's plan title, target week formatted as "Week of [Sunday Date]", and a direct link to view that group's assigned challenges.

## Group Weekly Drills View — `/training?group=[groupId]`

When navigating to a group's plan (via "Practice Weekly Drills →" on the group dashboard or "View" on a group plan card):
- **Dedicated Drill Spot:** The page focuses exclusively on that specific week's drills assigned to the group, instead of showing all drill templates across the library.
- **Group Training Banner:** Displays the group name, plan title, target week formatted as "Week of [Sunday Date]", coach focus notes/tips, and an active completion progress bar ("X / Y Done").
- **Custom Drill Goals:** Each challenge card displays any custom target goals set for that drill in the weekly plan.
- **Focused Filtering:** Category filter pills dynamically adapt to only display categories present in the current weekly plan (plus "All Plan Drills").
- **Clean Context:** Suppresses the personal training plan card and other group banners to eliminate distractions while practicing the group's weekly drills.
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
- **Personal Best Banner:** Shows the player's lifetime highest score or best time for that drill.
- **Instructions & Setup:** Expandable guide outlining court setup, target cones, and drill rules.
- **Inline Multi-Attempt Logger (`+ Record Attempt`):**
  - Allows logging multiple attempts in one practice session directly on the card without page reloads.
  - Tailors inputs to the tracking format (e.g. Shots In vs Total Attempts for accuracy with live percentage preview; duration in seconds for timed sprints; +/- steppers with 16px numeric inputs).
  - **Partner Selector:** In a group context, partner and group drills allow selecting a partner from the active group roster. A single shared result is written with participant links, avoiding duplicate entries.
  - **Instant Feedback:** Celebratory banner on save highlighting practice points earned and whether a new personal best was achieved.

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

