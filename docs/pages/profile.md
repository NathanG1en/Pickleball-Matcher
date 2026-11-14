# Player Profile — `/players` & `/players/[username]`

The player profile page is where athletes can review their rating, track their game and session history, discover their best chemistry partners, see their joined groups, and manage their account details and privacy controls.

## Overview & Routing

- **Personal Profile (`/players`)**: Accessible from the home page or navigation menu when signed in. Automatically loads the authenticated player's profile in owner mode.
- **Public Profile (`/players/[username]`)**: Accessible by clicking player usernames or "View profile" across group rosters, chemistry spotlights, and search results.
  - When the signed-in player visits their own `@username`, the page renders in owner mode with full editing capabilities.
  - When viewing another player, the page displays a read-only view that strictly honors the target player's privacy controls.

## Profile Sections

1. **Header & Identity**:
   - **Display Name & Username**: Prominently displayed at the top.
   - **Gender**: Displayed if configured (`Male` or `Female`).
   - **Rating & Skill Tier**: Displays current DUPR rating (e.g., `3.75`) and skill tier (e.g., `Advanced Intermediate`). Hidden if the player has made their rating private.
   - **Visibility Badge**: Indicates whether the account is `Public` or `Private`, along with any customized portion privacy controls.
   - **Owner Controls**: "Edit Profile" button to enter edit mode, and three-dot options menu with "Log Out".
2. **Chemistry Spotlight**:
   - **Best Partner**: Highlights the partner with whom the player shares the highest synergy score, along with matches played together and percentage synergy boost.
   - **Mutual Chemistry**: When another signed-in player views the profile, displays mutual partner chemistry between the viewer and the profile owner.
   - **Privacy fallback**: Displays a locked notice ("Chemistry Private") if the player has hidden partner chemistry.
3. **Performance Stats**:
   - Stat cards showing total attended sessions, match wins, and match losses across all groups.
   - **Privacy fallback**: Displays a locked notice ("Stats Private") if the player has hidden rating & stats.
4. **My Groups / Groups**:
   - Lists all groups where the player is an active member or organizer, showing member count and quick links.
   - When viewing one's own profile, provides "Create" and "Find groups" shortcut buttons.
   - **Privacy fallback**: Displays a locked notice ("Groups Private") if the player has hidden group memberships.
5. **Score History Chart**:
   - Visual trend of rating progression over time across completed sessions. Hidden if rating & stats are private.
6. **Past Sessions**:
   - Chronological list of completed sessions with date, group name, session type (e.g. Regular or Open Play), and win/loss match records.
   - When viewed by the owner, includes direct links (`?from=profile`) to inspect session round results.
   - **Privacy fallback**: Displays a locked notice ("Past Sessions Private") if the player has hidden activity history.

## Edit Profile Mode

Clicking the **Edit Profile** button switches the header into edit mode:
- **Display Name**: Editable text field (up to 80 characters).
- **Username**: Editable `@username` with live availability check against the database.
- **Gender**: Dropdown to select Male or Female.
- **Account Visibility**: Quick toggle between Public and Private.
- **Privacy Controls (Portion Visibility)**: Granular Strava-modeled privacy options allowing athletes to control who can view each specific section of their profile:
  - **Profile Page**: Controls general discoverability in search (`Everyone`, `Group Members`, or `Only You`).
  - **Activities & Past Sessions**: Controls who can see session history and game results (`Everyone`, `Group Members`, or `Only You`).
  - **Rating & Stats**: Controls who can see DUPR rating, skill tier, win/loss record, and rating chart (`Everyone`, `Group Members`, or `Only You`).
  - **Chemistry Spotlight**: Controls who can see synergy scores and best partner (`Everyone`, `Group Members`, or `Only You`).
  - **Groups**: Controls who can see joined groups and clubs (`Everyone`, `Group Members`, or `Only You`).

### Visibility Levels (Modeled after Strava)
- **Everyone**: Visible to all players and public visitors.
- **Group Members**: Visible only to players who share at least one group with the player (and the player themselves).
- **Only You**: Visible only to the player themselves.

## Restricted & Private Profile States

When a player visits another athlete's profile:
- **Private Profile**: If the player set their Profile Page to `Only You` (or toggled account visibility to `Private`), non-owners see a locked card stating the profile is private; no stats, ratings, groups, chemistry, or session history are exposed.
- **Restricted Profile**: If the player set their Profile Page to `Group Members` and the viewer is not a co-member of any group, a locked card explains that the profile is only shared with group members.
- **Granular Customization**: If the profile is viewable, but specific portions (such as Past Sessions or Rating) are set to `Group Members` or `Only You`, those specific sections show polite privacy notices while allowing the rest of the profile to be viewed.

