# Home — `/`

The home page provides a modern, editorial neo-brutalist entry point to the Pickleball Matchmaker application, getting players back to their groups and running sessions quickly.

## Responsive Navigation System

The application features an Instagram-inspired responsive navigation system shared across the platform:

- **Top Navigation Bar:**
  - **Desktop (`md` and up):** Compact editorial neo-brutalist header (`h-16`) with branding on the left, quick navigation pill links (**Home**, **Groups**, **Training**, **Players**) in the center when signed in, and player profile avatar with account dropdown (or **Sign In**) on the right.
  - **Mobile (`md:hidden`):** Sticky compact branding header (`h-13`) displaying the Pickleball Matchmaker branding. It contains **no profile option** in the header, keeping the mobile top clean; profile access is instead handled directly via the persistent mobile bottom navigation bar.
- **Mobile (Fixed Bottom Navigation Bar):**
  - Persistent bottom bar with five core destinations for signed-in players:
    1. **Home** (`/`)
    2. **Groups** (`/players/groups`)
    3. **Training** (`/training`)
    4. **Players** (`/players/find`)
    5. **Profile** (`/players`)
  - Features recognizable icons with uppercase text labels underneath.
  - Active destinations are highlighted with the neon lime accent (`#ccff00`), black border, and subtle neo-brutalist offset drop shadow.
  - Subdued inactive states.
  - Supports mobile safe-area insets (`env(safe-area-inset-bottom)`).
  - Page layouts reserve bottom padding (`pb-20 md:pb-0`) when signed in to prevent content from being obscured.
  - Omitted entirely for signed-out visitors.
  - Suppressed during live court match scoring sessions (`/sessions/`) to keep in-game scoring controls (`.mobile-action-bar`) unobstructed.

## Live Now

When any group the viewer belongs to has a session in progress, a compact, informative status card appears at the top:

- **What the card shows:** An eye-catching lime live badge ("Live now · Round N in play", "Lineup being set", or "Open play is running"), the group name, and an obvious action button.
- **What tapping it does:** **See my court →** opens the running session with the viewer's court pinned at the top.

## Hero

The hero section introduces the application's core identity with balanced, refined proportions that do not dominate the initial viewport:

- **Headlines:** "FAIR ROUNDS. FRESH PARTNERS." rendered in bold Barlow Condensed display typography, scaled to `text-[2.5rem]` on mobile and `text-6xl` on desktop, accented with a selective neon lime badge highlight.
- **Tagline:** "An elevated pickleball experience.", styled at `text-base` font size.
- **Interactive Court Divider:** The centered decorative bouncing pickleball divider (horizontal lines with the interactive pickleball button) sits below the subtitle, extending wider across desktop viewports (`max-w-xl`).
- **Hero Footer / Contextual Actions:**
  - **Signed In:** Features a horizontally spread profile footer row beneath the divider spanning across the card with a neon-lime initial avatar and "PLAYING AS" @username on the left, and a distinct neon-lime "View Profile →" button on the right.
  - **Signed Out:** Integrates the **Sign In to Play →**, **Create an Account**, and **Start a Quick Session** actions within the card.

## Main Actions

A cohesive 3-card layout provides unified access to primary features across both mobile and desktop (available to signed-in users):

1. **Find Groups:** Browse public pickleball groups, check skill levels, and join rosters.
2. **Find Players:** Discover players across groups, inspect chemistry rankings, and view match history.
3. **Create A Group:** Set up new groups, configure courts, and run automated round-robins.

## User States & Actions

- **Signed In:**
  - Active live session status cards and organizer session indicators (if in progress).
  - **Recovery email banner**: above the hero while the player has no verified recovery email. It's one compact strip. With an unverified email it shows a yellow envelope tile, **Recovery email not verified**, the email, **Resend code · Change email** and **Enter code →** on the right (on a phone, the links and button share a row). With no email it reads **Add a recovery email** with **Add email →** and **Not now**. See [auth.md](auth.md).
  - Refined hero section containing "FAIR ROUNDS. FRESH PARTNERS.", subtitle, pickleball divider, and the compact profile footer row (**Playing as @username** and **View Profile →**).
  - **Your groups** listing showing all active groups.
  - Cohesive 3-card action grid (**Find Groups**, **Find Players**, **Create A Group**).
  - Account logout is available via the Profile page and the desktop top navigation account dropdown.
- **Signed Out:**
  - Visitors see a single unified welcome hero section with "FAIR ROUNDS. FRESH PARTNERS." and integrated sign-in / registration options (**Sign In to Play →**, **Create an Account**, and **Start a Quick Session**).
  - Groups, player lists, action cards, and profiles are hidden from unauthenticated visitors.
  - Protected routes (`/players/groups`, `/players/find`, `/players`, `/players/[username]`, `/setup`) automatically redirect unauthenticated visitors to `/player-login`.


## Sign in — `/player-login`

When the link's `?next=` points inside a group, the page names that group ("Sign in to open <Group>") and offers **Not in this group yet? Join as a guest**. That link goes to the group's join page and keeps the destination. After signing in, the player goes to the page in the link's `?next=` if there is one. Otherwise they land on the home page, which shows their live sessions and groups.

