# Player Profile — `/players` & `/players/[username]`

The player profile page is where athletes can review their rating, track their game and session history, discover their best chemistry partners, see their joined groups, and manage their account details and privacy controls.

## Overview & Routing

- **Personal Profile (`/players`)**: Accessible from the home page or navigation menu when signed in. Automatically loads the authenticated player's profile in owner mode. Unauthenticated visitors are redirected to `/player-login`.
- **Public Profile (`/players/[username]`)**: Accessible by clicking player usernames or "View profile" across group rosters, chemistry spotlights, and search results. Requires a signed-in player account; unauthenticated visitors are redirected to `/player-login?next=...`.
  - When the signed-in player visits their own `@username`, the page renders in owner mode with full editing capabilities.
  - When viewing another player, the page displays a read-only view that strictly honors the target player's privacy controls.

## Profile Sections

1. **Header & Identity**:
   - **Display Name & Username**: Prominently displayed at the top.
   - **Gender**: Displayed if configured (`Male` or `Female`).
   - **Rating & Skill Tier**: Displays current DUPR rating (e.g., `3.75`) and skill tier (e.g., `Advanced Intermediate`). Hidden if the player has made their rating private.
   - **Visibility Badge**: Indicates the active account visibility tier (`Everyone`, `Group Members Only`, or `Only You`). Tooltip explains the three tiers: Everyone, Group Members, and Only You.
   - **Account Recovery Banner & Email Status**: When viewing one's own profile, if no recovery email is on file or if an email is pending verification, a dedicated recovery card prompts the player to add an email or resend verification. Once verified, the account is protected with automated password recovery.
   - **Owner Controls**: "Edit Profile" button to enter edit mode, and three-dot options menu (`···`) with "Settings" and "Log Out".
2. **Chemistry Spotlight & Mutual Chemistry**:
   - **Best Partner**: Highlights the partner with whom the player shares the highest synergy score, along with matches played together and percentage synergy boost. Placed in the top row alongside Performance Stats to maintain balanced card proportions.
   - **Mutual Chemistry**: When another signed-in player views the profile, displays mutual partner chemistry between the viewer and the profile owner in the main content stream.
   - **No partner yet**: With no chemistry yet, the card explains that chemistry only tracks doubles partners who have player accounts, so games with guest partners don't unlock it.
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
   - Week, Month, Year and All filters. Under the chart, a line reads "from → to rating" for the selected range. For **All**, "from" is the player's starting rating, so the line shows a change even after the first session.
6. **Past Sessions**:
   - Chronological list of completed sessions with date, group name, session type (e.g. Regular or Open Play), and win/loss match records.
   - When viewed by the owner, includes direct links (`?from=profile`) to inspect session round results.
   - **Privacy fallback**: Displays a locked notice ("Past Sessions Private") if the player has hidden activity history.

## Edit Profile Mode

Clicking the **Edit Profile** button switches the header into in-page edit mode:
- **General Information**:
  - **Display Name**: Editable text field (up to 80 characters).
  - **Username**: Editable `@username` with live availability check against the database.
  - **Gender**: Dropdown to select Male or Female.
  - **Save Changes & Cancel**: The **Save Changes** button is disabled until at least one field is changed from its current value and valid. When disabled, the button displays in a flat, muted neutral gray with `cursor-not-allowed` and does not change color on hover. Saving persists changes immediately with live validation, or prompts to discard unsaved changes.

## User Settings Modal (`···` Options Menu)

Clicking the three dots (`···`) in the profile header opens the account actions dropdown, offering **Settings** and **Log Out**. Selecting **Settings** displays the User Settings Modal (styled consistently with the Group Settings dialog, featuring a fixed neo-brutalist header, sticky pill-style tab navigation, and scrollable content area), organized into tabbable categories:

### 1. Account & Security Tab
- **Email Address & Re-Verification**:
  - Shows current email on file with live verification status badge (`Verified` or `Unverified · Re-verification Required`).
  - When an email address is changed, the account's email verification status is immediately reset to unverified, previous verification tokens are invalidated, a new verification token is created, and re-verification is required before it can be used for account recovery.
  - **Inline Blur Validation**: Catches malformed inputs that lack an `@` symbol or domain (e.g. `example.com`). Validation triggers upon unfocusing (`onBlur`) and highlights the input box with a red border and surfaces a red invalid input alert box beneath it, remaining until corrected.
  - The **Update Email** button is disabled until the entered email is valid, non-empty, and changed from the current email address. Disabled buttons retain a neutral gray style with `cursor-not-allowed` and do not activate hover styling.
- **Password**:
  - Dedicated password management with three verification fields, each equipped with an eye toggle button (`EyeIcon` / `EyeOffIcon`) to view or obscure entered text:
    - **Current Password**: Authenticates existing credentials via secure password comparison.
    - **New Password**: Enforces strong credential requirements (at least 10 characters, up to 72 bytes).
    - **Confirm New Password**: Ensures exact character match with the new password before submission.
  - The **Update Password** button enables as soon as password fields are modified, remaining disabled when empty. Submitting invalid combinations surfaces clear, localized error notices (e.g., matching requirements, minimum 10 characters, current password requirement).
  - Password updates immediately hash the new password using bcrypt cost 12.

### 2. Privacy Tab
Single unified source of truth for visibility, organized as collapsible drawers per profile portion:
- The **Save Privacy Settings** button is disabled if no visibility options have been modified from the current saved settings (displaying in neutral gray with `cursor-not-allowed` and no green hover).
- Inside each drawer, options are presented as a clean list of choices (`Everyone`, `Group Members`, `Only You`) with a bold label, a lighter-weight and smaller description of that choice, and a radio button on the right that turns green (`#ccff00`) when selected.
- **Profile Page (Account Baseline & Visibility Ceiling)**: Sets who can discover and view your overall profile (`Everyone`, `Group Members`, or `Only You`). This acts as a strict ceiling for all child portions:
  - Setting Profile Page to `Only You` automatically clamps all other portions to `Only You` and disables higher options.
  - Setting Profile Page to `Group Members` caps child options to `Group Members` (disabling `Everyone`).
  - Setting Profile Page to `Everyone` permits all three visibility levels across child portions.
- **Activities & Past Sessions**: Controls who can see session history and game results (`Everyone`, `Group Members`, or `Only You`, capped by Profile Page).
- **Rating & Stats**: Controls who can see DUPR rating, skill tier, win/loss record, and rating chart (`Everyone`, `Group Members`, or `Only You`, capped by Profile Page).
- **Chemistry Spotlight**: Controls who can see synergy scores and best partner (`Everyone`, `Group Members`, or `Only You`, capped by Profile Page).
- **Groups**: Controls who can see joined groups and clubs (`Everyone`, `Group Members`, or `Only You`, capped by Profile Page).
- **Save Privacy Settings Button**: Persists privacy configurations and surfaces feedback toasts.

### Visibility Levels & Ceiling Rule (Modeled after Strava)
- **Everyone**: Visible to all players and public visitors.
- **Group Members**: Visible only to players who share at least one group with the player (and the player themselves).
- **Only You**: Visible only to the player themselves.
- **The Ceiling Rule**: No individual portion of a profile can be configured to be more visible than the overall Profile Page. Setting the Profile Page to `Only You` locks the entire profile and all of its contents to private. Each option row displays a green radio button when selected.

## Restricted & Private Profile States

When a player visits another athlete's profile:
- **Private Profile**: If the player set their Profile Page to `Only You` (or toggled account visibility to `Private`), non-owners see a locked card stating the profile is private; no stats, ratings, groups, chemistry, or session history are exposed.
- **Restricted Profile**: If the player set their Profile Page to `Group Members` and the viewer is not a co-member of any group, a locked card explains that the profile is only shared with group members.
- **Granular Customization**: If the profile is viewable, but specific portions (such as Past Sessions or Rating) are set to `Group Members` or `Only You`, those specific sections show polite privacy notices while allowing the rest of the profile to be viewed.

### Find Players & Search Privacy
In the community player directory (`/players/find`):
- For private players (`Only You`), their gender and current rating are hidden from other viewers to respect their privacy settings.
- Athletes with viewable profiles display their username, gender, and current rating.

