# Home — `/`

The home page provides a modern, editorial neo-brutalist entry point to the Pickleball Matchmaker application, getting players back to their groups and running sessions quickly.

## Responsive Navigation System

The application features an Instagram-inspired responsive navigation system shared across the platform:

- **Desktop (Top Navigation Bar):**
  - **Left:** Pickleball Matchmaker branding linking to `/`.
  - **Center:** Quick navigation pill links for **Home** (`/`), **Groups** (`/players/groups`), and **Players** (`/players/find`), with lime active-state indicators.
  - **Right:** Player Profile avatar linking directly to `/players`. When authenticated, includes an account dropdown menu with shortcuts to Profile, Create A Group, and Log Out.
- **Mobile (Fixed Bottom Navigation Bar):**
  - Persistent bottom bar with four core destinations:
    1. **Home** (`/`)
    2. **Groups** (`/players/groups`)
    3. **Players** (`/players/find`)
    4. **Profile** (`/players`)
  - Features recognizable icons with uppercase text labels underneath.
  - Active destinations are highlighted with the neon lime accent (`#ccff00`), black border, and subtle neo-brutalist offset drop shadow.
  - Subdued inactive states.
  - Supports mobile safe-area insets (`env(safe-area-inset-bottom)`).
  - Page layouts reserve bottom padding (`pb-20 md:pb-0`) to prevent content from being obscured.
  - Suppressed during live court match scoring sessions (`/sessions/`) to keep in-game scoring controls (`.mobile-action-bar`) unobstructed.

## Live Now

When any group the viewer belongs to has a session in progress, a compact, informative status card appears at the top:

- **What the card shows:** An eye-catching lime live badge ("Live now · Round N in play", "Lineup being set", or "Open play is running"), the group name, and an obvious action button.
- **What tapping it does:** **See my court →** opens the running session with the viewer's court pinned at the top.

## Hero

- **Headlines:** "FAIR ROUNDS. FRESH PARTNERS." rendered in bold Barlow Condensed display typography, accented with a selective neon lime badge highlight.
- **Tagline:** "An elevated pickleball experience."
- **Interactive Court Divider:** Features the interactive pickleball animation that bounces once per session and responds to hover/tap interactions.

## Main Actions

A cohesive 3-card layout provides unified access to primary features across both mobile and desktop:

1. **Find Groups:** Browse public pickleball groups, check skill levels, and join rosters.
2. **Find Players:** Discover players across groups, inspect chemistry rankings, and view match history.
3. **Create A Group:** Set up new groups, configure courts, and run automated round-robins.

## User States & Actions

- **Signed In:**
  - Welcome banner with the player's username (`@handle`) and a primary **View Profile →** action.
  - Cohesive 3-card action grid (**Find Groups**, **Find Players**, **Create A Group**).
  - **Your groups** listing showing all active groups.
  - Discrete **Log Out** button at the footer.
- **Signed Out:**
  - High-priority **Sign In to Play →** action button in signature neon lime.
  - **Create an Account** secondary action.
  - **Start a Quick Session** option for temporary round-robins without account creation.
  - Feature preview action cards allowing guest exploration of groups and players.
  - **Your groups** listing if guest groups are active on the current device.

## Sign in — `/player-login`

When the link's `?next=` points inside a group, the page names that group ("Sign in to open <Group>") and offers **Not in this group yet? Join as a guest**. That link goes to the group's join page and keeps the destination. After signing in, the player goes to the page in the link's `?next=` if there is one. Otherwise they land on the home page, which shows their live sessions and groups.

