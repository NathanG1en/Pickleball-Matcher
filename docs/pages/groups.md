# Group pages

For a deeper look at roles and visibility, see [synergy-and-privacy-system.md](../synergy-and-privacy-system.md).

## Find a group — `/players/groups`

Shows public groups and lets players search them. Requires a signed-in player account; unauthenticated visitors are automatically redirected to `/player-login?next=%2Fplayers%2Fgroups`.

- **Header:** clean header with category eyebrow, page title ("Find a group"), and a responsive **+ Create Group** button (`/setup`) aligned horizontally for easy access across mobile and desktop.
- **Search:** searches public groups by name. The query is in the URL (`?q=`), so a search can be shared and survives a reload. Private groups never appear here.
- **Group cards:** each card shows the group name, a role badge (Host, Organizer, or Member) when the viewer belongs to the group, and the number of active players. Long group names wrap naturally onto up to two lines (with a 2-line clamp and ellipsis for exceptionally long names) without dynamically shrinking the font size. The role badge sits alongside the title when space permits and wraps below when needed, with the active player count directly beneath. On mobile, the action buttons sit in a separate row beneath the group details, where **View Group** expands to fill available width while **Leave** or **Join** serves as a smaller secondary action. On larger screens, the side-by-side horizontal layout is preserved. Every card has a **View Group** link. The second button depends on the viewer:
  - **Join** for signed-in non-members. The card refreshes to show the Member badge after joining.
  - **Leave** for members who aren't the host. It asks for confirmation first.
- **Empty states:**
  - *A search with no results* names the query (“No groups match “…””), notes that private groups never appear in search, suggests checking spelling or trying another name, and offers **Clear search** alongside a path to create a group (`/setup`, or create an account for signed-out visitors).
  - *No public groups at all* (no search entered) shows “No public groups yet”, suggests asking an organizer for an invite link, and offers **Create a group** (`/setup`). Signed-out visitors see **Create an account** instead, which leads to signup and then on to `/setup`.

## Create group — `/setup`

Requires a signed-in player account. The creator becomes the host and is added to the roster automatically.

- **Fields:** Group name (case-sensitive, must be unique, up to 80 characters) and a checkbox to make the group public.
- **Submit:** **Create Group** stays disabled until a name is entered, and shows “Creating…” while saving. On success the page goes to the new group's dashboard.
- **Errors:** messages appear above the form, and the entered name and visibility are kept so the organizer can retry.
  - A duplicate name shows “A group with this exact name already exists.”
  - A signed-out player sees “Sign in to your player account to create a group.”
  - Any other failure shows a general retry message. Technical details go to the server logs and are never shown to the user.

## Group dashboard — `/g/[groupId]`

- **Header:** **Share**, and a **Group options** menu (integrated with the shared responsive navigation). The options menu is shown to organizers and to signed-in members who aren't the host. Below these sit the group name, a Public/Private badge, and the roster count, which includes the host. After a session ends, organizers also see the session sign-off control here.

- **Feedback toasts:** Success feedback (e.g. adding a player or guest) uses a compact toast placed at the bottom of the screen on mobile devices so header navigation and group title remain clear and accessible. On larger screens it stays in the top-right corner. It includes an accessible announcement, a dismiss control, and a visual loader progress bar running along the bottom indicating how long the notification will remain visible before auto-dismissing.
- **Primary session card:** this comes first on phones, right under the header. On desktop it sits at the top of the left column. What it shows depends on the viewer:
  - **Not part of the group:** the join card.
  - **A session is running:** a card with a warm neutral surface (`#FFFDF7`), a status badge ("Round N" once a round has started, or "Lineup being set" before the first round), start date, and court count, plus current matchups (or recent games for open play). Every court is listed; the list doesn't scroll inside the card. If the viewer is playing this round, their court is listed first and tagged with a bright lime **You're here** badge. The primary action is a prominent bright lime button: **Resume Session** (or **Manage Open Play**) for organizers, and **View Live Session** (or **View Open Play**) for players. Organizers also get **End Session** (shortened to “End” on phones). **End** first opens an "End this session?" confirmation. For a normal session it says how many games are still in progress and won't be recorded; for open play it says players won't be able to log more games. It also warns that a session can't be reopened. **Keep playing** closes the dialog and leaves the session running.
  - **No session, organizer:** “Ready to Play?” with **Start New Session**, which opens `/g/[groupId]/sessions/new`.
  - **No session, player:** “No Active Session” with an explanation.
- **Organizers and roster:** on phones this follows the session card. On desktop it fills the right-hand column. Organizers can find players by username or add guests here. The roster supports search, filter, and sort.
- **After a session ends:** for 12 hours, the header shows a **See the session summary** link to that session. Organizers also see the sign-off animation.
- **Weekly Training:** shown to members in the left column. Displays the current week's published training plan, drill completion checkmarks, direct in-plan result recording via **+ Record** on each drill, and a link to practice weekly drills (`/training?group=[groupId]`), which takes the user directly to a focused view of just that week's drills. Group organizers can create, edit, and publish weekly plans via the primary **Create Weekly Plan →** or **Edit** action button (`/g/[groupId]/training/plan/new`), which safely returns back to the group dashboard upon cancellation or completion.
- **Tournaments and Past Sessions:** shown only to members. On phones they follow training; on desktop they sit in the left column below the session card. Organizers get **+ Create Tournament**.

## Join a group — `/g/[groupId]/join`

This is the page the share/invite link opens.

- **Already a member:** a confirmation, with a way back to the group.
- **Signed in:** **Join Group Now** shows which account will join and its starting rating.
- **Continuing to a shared link:** when the page is opened with `?next=` pointing inside this group (a shared session link, for example), joining continues there. The sign-in and sign-up links carry it along. Members see **Continue →** instead of **Go to Group Dashboard →**. Links outside the group are ignored.
- **Signed out:**
  - **Join as Guest:** enter a name and skill level. The page explains: "Already on the roster? Use the name your organizer added and you'll take that spot."
    - If an active guest with the same name is already on the roster, the device takes over that guest's spot. The name match ignores case and extra spaces. No duplicate is created, so the player keeps their history.
    - An account player with the same name is never taken over; a new guest is created instead.
  - **Sign in / Create account:** after signing in, the player comes back to this page.
- Unexpected failures show a general "try again" message; the technical details go to the server logs.

## Group Roster — `/g/[groupId]/players`

Displays the regular players and skill ratings for the group.

- **Header:** a 44px **← Back to Group** button, the group title ("[Group] Roster", which wraps on narrow phones instead of overflowing), and a role-appropriate description.
- **Organizer controls:**
  - When viewed by an organizer, a player search drawer allows searching registered accounts by name or `@username` to add them to the roster.
  - Initial player addition form for creating local guest players with custom or preset skill ratings.
  - Pin controls to pin important regular players to the top of the roster list.
  - Delete action to remove a player from the roster (with confirmation modal).
- **Roster list controls:**
  - **Search:** Search players by name or `@username`.
  - **Filter:** Filter by pinned players, account members, or guests, as well as by gender (Male/Female).
  - **Sort:** Sort by Name (A–Z / Z–A), Rating (High–Low / Low–High), or Games Played (Most–Least / Least–Most).
- **Privacy and details visibility (Dashboard Roster & Dedicated Roster):**
  - Unlinked guest players show their rating, gender, and games played.
  - For account players:
    - Players viewing their own entry on the roster can always see their own rating, gender, and games played.
    - If a player sets their profile or rating stats visibility to **Only You** (or private), their rating and gender are masked from all other viewers. Only the number of games they have played in that group (e.g. "X games") is shown. They are also sorted to the bottom when sorting by rating or games played to prevent rank inference.
    - If a player sets their visibility to **Group Members**, fellow group members can view their details, while non-members/public visitors only see their games played with rating and gender hidden.
    - Linked player usernames provide clickable links to their profile page (`/players/[username]`). For non-organizers, a right chevron or dropdown item also links to the profile.

## Add to Home Screen tip

- A yellow tip card ("Save 1-Tap App to Your Phone") explains installing the app; it offers **Install App to Home Screen →** where the browser supports it, or step-by-step instructions on iPhone. It never shows when the app is already installed, and a 44px **×** dismisses it for good on this device.
- On desktop it sits at the bottom of the right-hand column; on phones it appears at the very end of the group dashboard, after Past Sessions, so it never comes between the roster and the group's main features.
