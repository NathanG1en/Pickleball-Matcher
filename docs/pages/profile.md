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
   - **Recovery email banner:** on one's own profile, while no recovery email is on file or it isn't verified yet. The unverified version is one compact strip: a yellow envelope tile, **Recovery email not verified**, the email, **Resend code · Change email** and **Enter code →**. Hidden once verified. See [auth.md](auth.md).
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
5. **Practice Profile** (owner only):
   - Shown only to the profile owner (on `/players` and on their own `/players/[username]`), under My Groups. Other viewers never see it.
   - **Collapsed by default:** the card is a disclosure. Closed, it shows the title, a one-line summary ("3 of 6 skills tested · Focus: Resets 48%", or "No skills tested yet"), and a chevron button. Tapping anywhere on the header opens the full card below. Each time it opens, the card plays a short reveal (about 1.3s): the body unfolds, the hexagon outline draws itself, axis labels fade in around it, the skill shape springs out from the centre, each skill dot drops in with a pickleball-style bounce in turn, the skill bars fill left to right, and the focus suggestion pops in last. Content stays usable throughout, and there is no motion when the device asks for reduced motion.
   - A hexagon with six skills — Dinking, Third Shot, Resets, Volleys, Serving, Strategy — scored as the average, across drills tried in that skill, of the player's best result in the last 60 days divided by the drill's target (capped at 100%). The outer ring is 100% of target; the inner ring is 50%.
   - Skills with no scorable attempts are drawn as dashed spokes labelled **Not tested** (never zero). The filled shape connects tested skills once at least three are tested; a hollow point marks a score based on a single attempt.
   - Win-based drills are excluded (results depend on the opponent), as are completion drills and drills without a target.
   - **Focus suggestion:** the lowest tested skill below target ("Focus next: Resets · 48% of target") with a **Practice [Skill]** button; once every tested skill is at target it suggests an untested skill; with no data it reads "Start your practice profile" and links to `/training`.
   - **Skill list:** each skill shows its % of target with a bar and "N drills · N attempts" (plus "early estimate" for a single attempt) or "Not tested yet". Every row and hexagon label links to `/training?category=[skill]`, which opens the drill library filtered to that skill.
   - Footer: "Last practiced N days ago" (or "No drills logged yet.").
6. **Score History Chart**:
   - Visual trend of rating progression over time across completed sessions. Hidden if rating & stats are private.
   - Week, Month, Year and All filters. Under the chart, a line reads "from → to rating" for the selected range. For **All**, "from" is the player's starting rating, so the line shows a change even after the first session.
   - **Interactive Swiping & Scrubbing**: Athletes can swipe across the rating timeline on touch devices or hover/drag on desktop to scrub through ratings over time without needing to tap individual dots. As you swipe across the chart, a vertical dashed guide line follows the gesture, highlighting the nearest session dot with an active ring, displaying a floating tooltip with the exact DUPR rating and session date, and updating active details under the chart. Tapping or releasing a swipe keeps the session pinned; clicking outside or pressing Escape dismisses the detail.
7. **Past Sessions**:
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

Clicking the three dots (`···`) in the profile header opens the account actions dropdown, offering **Settings** and **Log Out**. Selecting **Settings** opens the User Settings Modal. It's styled like the Group Settings dialog: a fixed header, pill tabs and a scrolling content area. The header holds just **Settings** and a round **×** close button, which stays in view at any width. Clicking outside the dialog or pressing Escape also closes it. It's organized into tabs:

### 1. Account & Security Tab
- **Email**:
  - **Header:** **Email**, with a small **Change** link on the right (**Add** when there's no email).
  - **Address:** the email itself, or "No email yet", followed by its status: a lime **✓ Verified** tag, or a yellow **Not verified** tag. Both are square-ish and black-bordered, like the rest of the app.
  - **Unverified email:** "Enter the 6-digit code we sent." with the code boxes from Verify Email right in the section.
    - **Checking:** a complete code is checked straight away. A right code switches the tag to **Verified**, hides the boxes and shows an "Email verified" toast. A wrong one shakes the boxes and says "That code didn't work. Check it, or send a new one."
    - **Didn't get it? Resend code:** sits under the boxes. It sends a fresh code, empties the boxes and changes to "New code sent."
  - **Change / Add:** opens an empty, focused field with **Cancel** and **Send code**. Sending switches the section to the new address, marks it not verified, closes the field and shows empty, focused code boxes for the code just sent.
    - **Send code** is disabled until the field holds a valid email that differs from the current one.
    - **Validation:** a malformed address is flagged when the field loses focus, with a red outline and a message under it. An empty field isn't flagged.
- **Change Password** (or **Set Password** for an account made with Google, which has none yet):
  - The heading is the only text. Each field has an eye toggle to show or hide what's typed.
    - **Current Password**: shown and required only when the account has a password. A wrong one shows "Current password is incorrect." under the box.
    - **New Password**: at least 10 characters, up to 72 bytes. Fewer than 10 is flagged in red when the field loses focus.
    - **Confirm New Password**: must match. A mismatch shows "Confirm password must match the new password."
  - **Update Password** (or **Set Password**) is enabled once the new password is long enough and confirmed, plus the current password when there is one. The new password is hashed with bcrypt (cost 12).
  - **After setting a first password:** the section switches to **Change Password** right away. From then on the server requires the current password to change it, and refuses an empty one with "Current password is required."

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

