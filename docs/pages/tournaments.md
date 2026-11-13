# Tournament pages

## Create a division tournament — `/g/[groupId]/tournaments/new`

Organizers choose a format first, then build the tournament in step 2.

- **Tournament details:** a name, which defaults to "<Group> Championship".
- **Select divisions:** Men's Singles, Women's Singles, Men's Doubles, Women's Doubles and Mixed Doubles.
  - Nothing is selected to start with; the organizer ticks the brackets they want to run. **Select All** ticks only divisions that have enough players, and **Clear** unticks everything.
  - Each division shows how many entrants it would have from the selected players.
  - Gendered divisions only ever include players of that gender. Mixed Doubles only pairs one man with one woman; anyone left over is not entered. Players with no gender set are left out of all three until a gender is set for them.
  - A division with fewer than 2 entrants is greyed out with a dashed border, says "Needs 2+ eligible players", and can't be ticked.
- **Players:** every active roster player is selected by default. Each player shows their gender. Organizers can untick players or add a guest with a gender; other players' genders are set from the roster.
- **Create Tournament:**
  - The form blocks creating with no divisions or fewer than 2 players.
  - If a ticked division drops below 2 entrants because players were unticked, the form names that division and suggests setting player genders on the roster or removing the division.
  - The server checks the same rule.
