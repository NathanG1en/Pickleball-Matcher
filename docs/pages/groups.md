# Group pages

For a deeper look at roles and visibility, see [synergy-and-privacy-system.md](../synergy-and-privacy-system.md).

## Find a group — `/players/groups`

Shows public groups and lets players search them.

- **Header:** a Back button and a link to My Profile. Signed-out visitors get a Home link instead.
- **Search:** searches public groups by name. The query is in the URL (`?q=`), so a search can be shared and survives a reload. Private groups never appear here.
- **Signed out:** a line under the search asks the visitor to create an account or sign in before joining.
- **Group cards:** each card shows the group name, a role badge (Host, Organizer, or Member) when the viewer belongs to the group, and the number of active players. Every card has a **View Group** link. The second button depends on the viewer:
  - **Join** for signed-in non-members. The card refreshes to show the Member badge after joining.
  - **Leave** for members who aren't the host. It asks for confirmation first.
  - **Sign in to join** for signed-out visitors.
- **Empty states:**
  - *A search with no results* names the query (“No groups match “…””), notes that private groups never appear in search, and offers **Clear search**, which returns to `/players/groups`.
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

- **Header:** Back button, **Share**, and a **Group options** menu. The options menu is shown to organizers and to signed-in members who aren't the host. Below these sit the group name, a Public/Private badge, and the roster count, which includes the host. After a session ends, organizers also see the session sign-off control here.
- **Primary session card:** this comes first on phones, right under the header. On desktop it sits at the top of the left column. What it shows depends on the viewer:
  - **Not part of the group:** the join card.
  - **A session is running:** a lime card with the round number, start date, and court count, plus current matchups (or recent games for open play). Every court is listed; the list doesn't scroll inside the card. If the viewer is playing this round, their court is listed first and tagged **You're here**. Organizers get **End Session** (shortened to “End” on phones) and **Resume Session** (or **Manage Open Play**). **End** first opens an "End this session?" confirmation. For a normal session it says how many games are still in progress and won't be recorded; for open play it says players won't be able to log more games. It also warns that a session can't be reopened. **Keep playing** closes the dialog and leaves the session running. Players get **View Live Session** (or **View Open Play**).
  - **No session, organizer:** “Ready to Play?” with **Start New Session**, which opens `/g/[groupId]/sessions/new`.
  - **No session, player:** “No Active Session” with an explanation.
- **Organizers and roster:** on phones this follows the session card. On desktop it fills the right-hand column. Organizers can find players by username or add guests here. The roster supports search, filter, and sort.
- **Add to Home Screen tip:** a dismissible hint shown below the roster.
- **Tournaments and Past Sessions:** shown only to members. On phones they come last; on desktop they sit in the left column below the session card. Organizers get **+ Create Tournament**.

## Join a group — `/g/[groupId]/join`

This is the page the share/invite link opens.

- **Already a member:** a confirmation, with a way back to the group.
- **Signed in:** **Join Group Now** shows which account will join and its starting rating.
- **Signed out:**
  - **Join as Guest:** enter a name and skill level. The page explains: "Already on the roster? Use the name your organizer added and you'll take that spot."
    - If an active guest with the same name is already on the roster, the device takes over that guest's spot. The name match ignores case and extra spaces. No duplicate is created, so the player keeps their history.
    - An account player with the same name is never taken over; a new guest is created instead.
  - **Sign in / Create account:** after signing in, the player comes back to this page.
- Unexpected failures show a general "try again" message; the technical details go to the server logs.

