# Training and Challenges — `/training`

The Training Hub enables players to practice drills solo or with peers, track personal bests across five standardized tracking formats, and participate in weekly training plans published by their groups. It is completely isolated from competitive game matchmaking and Elo rating calculations.

## Navigation & Access

- **Accessible via Site Navigation:**
  - **Desktop:** The center top navigation bar features a direct **Training** pill link.
  - **Mobile:** The fixed 5-tab bottom navigation bar includes **Training** as a core destination between **Groups** and **Players**.
- **Group Dashboard Links:** Group dashboards (`/g/[groupId]`) feature a **Weekly Training** card linking directly to `/training?group=[groupId]` with pre-filtered context.

## Player Progress & Stats

Signed-in players and roster guests view a summary dashboard at the top of `/training`:
- **Total Completed:** Count of unique challenge attempts recorded across all drills.
- **Personal Bests:** Count of drills where the player holds a recorded personal best.
- **Practice Points:** Growth-oriented gamification XP awarded for participation, daily consistency, and personal best breakthroughs (independent of raw Elo ratings).
- **Practice Days:** Unique calendar days with logged training activity.

## Your Groups' Weekly Plans

When a viewer belongs to one or more groups that have an active weekly training plan:
- A highlighted banner surfaces at the top of the hub showing each group's plan title, week number, and a direct link to view that group's assigned challenges.

## Category Filters

Drills can be filtered by skill category using horizontal pill controls:
- **All Drills:** Comprehensive catalog.
- **Dinking:** Soft-game kitchen control and patience drills.
- **Third Shot:** Drops and transition-zone depth accuracy tests.
- **Serving:** Deep placement and trajectory drills.
- **Volleys:** Net battle reflexes and hand speed.
- **Resets:** Neutralizing offensive drives into the kitchen.
- **Conditioning:** Shuttle sprints and footwork agility.

## Challenge Cards & Reusable Result Logger

Each drill is presented in an editorial neobrutalist card with:
- **Badges:** Skill category, participant format (*Individual*, *Partner*, *Group*), and tracking format (*Streak*, *Accuracy %*, *Wins*, *Milestone*, *Timed*).
- **Personal Best Banner:** Shows the player's lifetime highest score or best time for that drill.
- **Instructions & Setup:** Expandable guide outlining court setup, target cones, and drill rules.
- **Inline Multi-Attempt Logger (`+ Record Attempt`):**
  - Allows logging multiple attempts in one practice session directly on the card without page reloads.
  - Tailors inputs to the tracking format (e.g. Shots In vs Total Attempts for accuracy with live percentage preview; duration in seconds for timed sprints; +/- steppers with 16px numeric inputs).
  - **Partner Selector:** In a group context, partner and group drills allow selecting a partner from the active group roster. A single shared result is written with participant links, avoiding duplicate entries.
  - **Instant Feedback:** Celebratory banner on save highlighting practice points earned and whether a new personal best was achieved.

## Create Weekly Plan (Organizers) — `/g/[groupId]/training/plan/new`

Accessible to group hosts and organizers from the group dashboard:
- **Fields:** Plan title, calendar week number (defaults to current ISO week), and optional coach notes/tips.
- **Challenge Picker:** Select 1 to 6 challenges from the system and group drill library.
- **Publishing:** Instantly activates the plan for the group, updating the group dashboard card and member training hub.

## Mobile-First Responsive Design

- **Touch-Friendly Controls:** Steppers and action buttons enforce 44px minimum touch targets (`min-h-[44px]` / `h-11`) with `touch-manipulation` to eliminate mobile tap delays.
- **iOS Safari Optimization:** All form text inputs, number fields, and selectors enforce a minimum 16px font size to prevent automatic browser zoom on mobile viewports.
- **Edge-Bleed Category Scrolling:** Horizontal drill category pills bleed seamlessly to the edge of the mobile screen (`-mx-4 px-4`) with smooth momentum touch scrolling.
- **Safe Area Bottom Navigation Clearance:** The page maintains ample bottom padding (`pb-28`) ensuring all cards and action buttons remain fully visible above the fixed mobile bottom navigation bar and home indicator.

