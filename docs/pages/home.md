# Home — `/`

The home page gets every player back to their group, and to a session that's already running, in one tap.

## Live now

When any group the viewer belongs to has a session in progress, a lime **Live now** card for each one appears at the very top, above the "Fair rounds" heading.

- **What the card shows:** the group name and the session's state: "Round N in play", "Lineup being set" before round 1 starts, or "Open play is running".
- **What tapping it does:** **See my court →** opens the live session, where the viewer's own court is pinned at the top.

## Your groups

Below the heading, **Your groups** lists every group the viewer belongs to. Groups with a live session are listed first, marked **Live →**; the rest are in alphabetical order.

- **Where the list comes from:** it is loaded from the server, not from this device's browsing history, so a new phone shows the same groups.
  - **Signed-in players:** every group where they are an active roster member, the host, or an organizer.
  - **Guests (not signed in):** every group this device joined as a guest, as long as that guest is still active on the roster.
- **Groups only looked at:** groups the viewer has viewed but not joined are not listed.
- **Organizer device sign-in:** if this device is signed in as an organizer for a group, that group is shown in its own "Organizer Session" card instead of in this list.

## Actions

- **Signed in:** View Profile, Find Groups, Find Players, Create A Group, Log Out.
- **Signed out:** Sign In to Play, Create an Account, and Start a Quick Session.

## Sign in — `/player-login`

After signing in, the player goes to the page in the link's `?next=` if there is one. Otherwise they land on the home page, which shows their live sessions and groups.
