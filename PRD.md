# Pickleball Matchmaker
## Product Requirements Document

**Status:** MVP specification  
**Target:** Mobile-first web app / PWA  
**Primary audience:** Casual recurring pickleball groups of roughly 6–24 players  
**Primary implementation target:** Claude Code, Codex, Antigravity, or another coding agent

---

## 1. Product Summary

Pickleball Matchmaker is a lightweight application for recurring social pickleball groups.

The application automatically creates each round of doubles matches while balancing four competing goals:

1. **Equal playing time**
2. **Partner variety**
3. **Opponent variety**
4. **Competitive match balance**

The application maintains player history and a dynamically changing skill rating so that matchmaking improves over time.

The core interaction should be extremely simple:

1. Select who is present.
2. Select the number of available courts.
3. Tap **Generate Round**.
4. Play.
5. Enter results.
6. Tap **Next Round**.

The application should replace manual/random team creation while preserving the social randomness that makes casual pickleball enjoyable.

---

# 2. Problem

The current group contains approximately 24 possible players, with typical attendance of 6–10 and occasional attendance of 12–16+.

Teams are currently created by repeated random splitting, such as players holding their hands up or down.

This method has several weaknesses:

- Some people repeatedly play together.
- Some people rarely play together.
- Skill mismatches can produce poor games.
- Sitting out is not necessarily distributed fairly.
- The system has no memory of previous rounds.
- Improving players are not recognized automatically.
- Larger attendance makes organization increasingly difficult.

The goal is not to create a hyper-competitive ranking system.

The goal is to create **fun, varied, reasonably competitive games with minimal organizational effort**.

---

# 3. Product Principles

The matchmaking system should optimize in roughly this priority:

**1. Fair playing time**  
**2. Partner diversity**  
**3. Competitive balance**  
**4. Opponent diversity**

These priorities matter.

For example, the system should prefer:

> Strong Player + Developing Player  
> vs.  
> Medium Player + Medium Player

when that produces a balanced match and increases partner variety.

It should NOT simply divide players into permanent skill tiers.

The system should encourage the entire group to mix.

---

# 4. MVP User Roles

## Organizer

An organizer can:

- Create a playing session.
- Select attending players.
- Add a temporary/new player.
- Set number of courts.
- Generate rounds.
- View court assignments.
- Record scores/results.
- Undo an accidentally generated round.
- Check players in or out during the session.
- End the session.

For MVP, one organizer controlling the session is sufficient.

## Player

Players primarily need to:

- See court assignments.
- See whether they are playing or sitting.
- Optionally submit/confirm results later.

Player accounts are **not required for MVP**.

---

# 5. Core User Flow

## Start Session

Organizer opens the application.

Display the group roster:

```text
Who's playing today?

☑ Nathan
☑ Alex
☑ Chris
☑ Sam
☑ Ryan
☑ Jake
☐ Eric
☐ John
...

14 players selected

Courts
[-] 3 [+]

[Start Session]
```

---

## Generate Round

After starting:

```text
Round 1

Court 1
Nathan + Chris
vs.
Alex + Sam

Court 2
Ryan + Jake
vs.
Eric + John

Court 3
Matt + Andrew
vs.
Ben + Kyle

Sitting
David
Joe
```

Actions:

```text
[Regenerate]
[Start Round]
```

Once a round starts, assignments should be saved to history.

---

## Record Results

After matches finish:

```text
Court 1

Nathan / Chris    [11]
Alex / Sam         [7]

[Save Result]
```

Exact scores should be stored.

For MVP, ratings only need to consider **win/loss**, not margin of victory.

---

## Next Round

Once matches are complete:

```text
[Generate Next Round]
```

The algorithm considers:

- previous partners
- previous opponents
- number of games played
- previous sitting rounds
- current skill ratings

and creates the next set of matches.

---

# 6. Fair Playing-Time Rules

Playing-time fairness is the strongest matchmaking constraint.

The system should track during each session:

- games played
- rounds sat
- whether the player sat during the previous round

### Requirement

When more players are present than courts can support, the system determines who sits.

Example:

- 14 players
- 3 courts
- 12 available spots
- 2 players sit each round

The system should strongly prefer players who have played more games.

### Rules

The matchmaker should:

- Keep games played per player within 1 game whenever mathematically possible.
- Strongly avoid making someone sit twice consecutively.
- Prefer sitting someone who has played more games than others.
- Randomize between otherwise equally eligible players.

Example:

```text
Player A — 4 games
Player B — 4 games
Player C — 3 games
Player D — 3 games
```

A or B should sit before C or D.

### Mid-session arrivals

If a player joins late, do **not** immediately force everyone else to sit until the new player catches up.

Playing-time fairness should be calculated relative to the player's time present in the session.

Store:

```text
joined_round
left_round
```

or equivalent attendance timestamps.

---

# 7. Partner Diversity

The system should strongly discourage repeat partnerships.

For every pair of players, maintain:

```text
times_as_partners
last_partner_round
```

Recent partnerships receive a large penalty.

Example conceptual weighting:

```text
Partners last round        +100
Partners 2 rounds ago       +70
Partners 3 rounds ago       +50
Partners 5 rounds ago       +25
Partners 10+ rounds ago      +5
Never partnered               0
```

Exact values should be configurable constants.

The algorithm should prefer people who have played together less frequently.

Long-term history should matter less than recent history.

---

# 8. Opponent Diversity

Opponent repetition should also be discouraged, but less aggressively than partner repetition.

Playing against the same player twice is significantly less undesirable than having the same teammate twice.

Conceptual weighting:

```text
Opponent last round       +25
Opponent 2 rounds ago     +15
Opponent 3 rounds ago     +10
Opponent 5+ rounds ago     +3
Never opposed               0
```

Again, exact values should live in configuration/constants rather than being scattered through application code.

---

# 9. Player Skill Rating

Every player has an internal numerical skill rating.

Default:

```text
1000
```

When first adding someone, the organizer may optionally classify them:

```text
Beginner      900
Intermediate 1000
Advanced     1100
```

This is only an initial estimate.

Afterward, match results automatically adjust the rating.

Players should NOT normally need to manually maintain their rating.

---

# 10. Rating Algorithm

Use a doubles Elo-style system.

## Team Rating

A team's rating is the average of its members:

```text
teamRating = (player1Rating + player2Rating) / 2
```

Example:

```text
Nathan 1100
Chris   900

Team rating = 1000
```

---

## Expected Win Probability

Use standard Elo expectation:

```text
expectedA =
1 / (1 + 10 ^ ((ratingB - ratingA) / 400))
```

---

## Rating Update

After a game:

```text
newRating =
oldRating + K × (actualResult - expectedResult)
```

Where:

```text
win  = 1
loss = 0
```

Both teammates receive the same rating delta for MVP.

### K factor

New players should adjust quickly.

```text
First 10 rated games: K = 40
After 10 games:       K = 20
```

This allows skill estimates to converge quickly.

---

# 11. Skill Improvement

The system must adapt naturally as players improve.

Do NOT permanently categorize someone as beginner/intermediate/advanced.

Those categories only seed the initial rating.

Example:

A new player begins:

```text
Rating: 900
```

After repeatedly beating teams rated around 1000:

```text
900
935
966
991
1013
...
```

Matchmaking therefore gradually begins treating that person as a stronger player.

No manual intervention should be necessary.

---

# 12. Match Balance

For any proposed match:

```text
A + B
vs.
C + D
```

calculate:

```text
team1Rating = average(A, B)
team2Rating = average(C, D)

skillDifference =
abs(team1Rating - team2Rating)
```

Smaller differences are preferable.

However, match balance must NOT override every other consideration.

For example:

```text
Player A: 1200
Player B: 900

vs.

Player C: 1075
Player D: 1025
```

produces:

```text
Team 1 = 1050
Team 2 = 1050
```

This is an excellent match even though individual skill levels vary considerably.

This behavior is desirable because it allows strong and developing players to interact.

---

# 13. Matchmaking Objective Function

Every candidate round should receive a penalty score.

Lower scores are better.

Conceptually:

```text
roundScore =
    playingTimePenalty
  + consecutiveSitPenalty
  + partnerRepeatPenalty
  + opponentRepeatPenalty
  + skillBalancePenalty
```

Recommended relative importance:

```text
Consecutive sitting     VERY HIGH
Playing-time imbalance  VERY HIGH
Repeat partnership      HIGH
Skill imbalance         MEDIUM-HIGH
Repeat opponents        MEDIUM
```

Suggested initial weights:

```text
CONSECUTIVE_SIT_WEIGHT = 100
PLAYING_TIME_WEIGHT    = 80
PARTNER_REPEAT_WEIGHT  = 50
SKILL_BALANCE_WEIGHT   = 20
OPPONENT_REPEAT_WEIGHT = 10
```

These constants should be easy to tune.

The exact numerical values are less important than keeping the priorities separate and configurable.

---

# 14. Match Generation Algorithm

Do not attempt to enumerate every possible arrangement.

The number of combinations becomes unnecessarily large.

For MVP, use a **randomized candidate search**.

## Algorithm

Given:

```text
N active players
C courts
```

Calculate:

```text
playingSlots = min(N, C × 4)

playersSitting = N - playingSlots
```

Generate several thousand valid candidate rounds.

For each candidate:

1. Choose eligible sitting players.
2. Shuffle active players.
3. Divide players into groups of four.
4. Evaluate the three possible doubles pairings for each group.
5. Select or randomly explore pairings.
6. Calculate the total round penalty.
7. Retain the lowest-scoring round.

Suggested iterations:

```text
2,000–10,000
```

For a maximum group size around 24, this should be computationally inexpensive.

The number of iterations should be configurable.

Add a tiny random tie-break component so identical conditions do not always generate the same arrangement.

---

# 15. Session History vs. Long-Term History

The application should consider both.

## Session history

Strongest influence.

Includes:

- who played together tonight
- who played against each other tonight
- number of games tonight
- sitting history tonight

## Long-term history

Used as a weaker tie-breaker.

For example, if Nathan has partnered with:

```text
Alex   12 times
Chris   7 times
Sam     1 time
Jake    0 times
```

the system should prefer Jake or Sam when all other factors are similar.

Long-term partner/opponent penalties should decay substantially over time.

---

# 16. Required Data Model

Suggested schema:

## Group

```text
id
name
created_at
```

## Player

```text
id
group_id
name
rating
rated_games_played
active
created_at
```

## Session

```text
id
group_id
started_at
ended_at
court_count
status
```

## SessionAttendance

```text
id
session_id
player_id
joined_round
left_round
```

## Round

```text
id
session_id
round_number
created_at
started_at
completed_at
```

## Match

```text
id
round_id
court_number
team1_score
team2_score
completed
```

## MatchPlayer

```text
id
match_id
player_id
team
rating_before
rating_after
```

Where:

```text
team = 1 or 2
```

## RoundSit

```text
round_id
player_id
```

---

# 17. Screens

MVP should have approximately five primary views.

## 1. Home

```text
Pickleball

[Start Session]

Recent Sessions
```

## 2. Attendance

Roster selection.

```text
Who's here?

☑ Nathan
☑ Alex
☑ Chris
...

14 players

Courts: 3

[Start]
```

## 3. Current Round

Large mobile-readable court assignments.

```text
ROUND 3

COURT 1
Nathan + Alex
vs
Chris + Sam

COURT 2
...

SITTING
Jake
Ryan
```

## 4. Results

Simple score entry.

## 5. Players

Basic roster management.

Show:

```text
Nathan
Rating: 1048
Games: 32

Alex
Rating: 1012
Games: 27
```

Ratings do not need to dominate the main experience.

---

# 18. Mobile UX Requirements

The application will usually be used beside pickleball courts.

Therefore:

- Design mobile-first.
- Large tap targets.
- High readability outdoors.
- Minimal typing.
- No complicated menus.
- Round assignments should fit naturally on a phone.
- Primary actions should be reachable with one hand.
- Do not require app installation.

Implement as a responsive PWA.

---

# 19. MVP Authentication

Do not overbuild authentication.

For MVP:

- A group has an organizer/admin link or simple organizer PIN.
- Players do not need individual accounts.
- Public/shared session links may be read-only.

Future versions can introduce individual accounts if necessary.

---

# 20. Regenerating a Round

Before a round starts:

```text
[Regenerate]
```

should be allowed.

Regeneration should NOT modify:

- ratings
- game counts
- partner history
- opponent history

until the organizer selects:

```text
[Start Round]
```

Once started, the round becomes part of session history.

---

# 21. Undo / Correction

Organizer must be able to correct mistakes.

Support:

- editing a result
- removing an accidentally recorded result
- undoing the most recently started round
- correcting a player check-in/check-out

When a historical result is edited, ratings should be recalculated reliably.

Prefer deterministic rating recalculation from game history rather than attempting complicated inverse Elo adjustments.

---

# 22. Edge Cases

The system must handle:

### Fewer than four players

Disable round generation and explain:

```text
At least 4 players are required for doubles.
```

### 5–7 players

One court operates while extra players rotate out.

### More players than court capacity

Fair sitting algorithm applies.

### Exact court capacity

Nobody sits.

Example:

```text
12 players
3 courts
```

### More courts than needed

Only use required courts.

Example:

```text
8 players
4 courts
```

Use 2 courts.

### Player leaves

Remove them from future rounds without affecting previous results.

### Player joins late

Add them to future matchmaking.

### Match does not finish

Allow:

```text
Cancel match
```

Cancelled games should not affect ratings.

---

# 23. Explicit Non-Goals for MVP

Do NOT initially build:

- tournaments
- brackets
- DUPR integration
- messaging
- friend requests
- achievements
- badges
- global leaderboards
- public player profiles
- AI features
- court reservations
- payment features
- native iOS/Android apps
- complicated account systems

The value proposition is the matchmaking engine.

Build that well first.

---

# 24. Suggested Technical Architecture

Optimize for simplicity and easy deployment.

## Frontend

Recommended:

```text
Next.js
TypeScript
Tailwind CSS
```

Mobile-first responsive PWA.

## Backend

Use Next.js server routes/server actions for MVP.

Avoid creating a separate backend service unless needed.

## Database

Recommended:

```text
PostgreSQL
```

Supabase is acceptable for fast development and hosting.

Suggested:

```text
Next.js
+
Supabase Postgres
+
Vercel
```

No AI APIs are required.

The matchmaking algorithm should be deterministic/testable application code and should NOT depend on an LLM.

---

# 25. Application Architecture

Keep matchmaking logic separate from UI and database code.

Recommended structure:

```text
src/
  app/
  components/
  lib/
    matchmaking/
      generateRound.ts
      scoreRound.ts
      skillBalance.ts
      partnerHistory.ts
      sittingFairness.ts
      rating.ts
      types.ts
  db/
  tests/
```

The matchmaking engine should accept plain structured data:

```typescript
generateRound({
  players,
  courts,
  matchHistory,
  currentSessionHistory
})
```

and return:

```typescript
{
  courts: [...],
  sitting: [...],
  score: ...
}
```

This makes the algorithm independently testable.

---

# 26. Testing Requirements

The matchmaking engine requires strong automated tests.

At minimum test:

### Playing-time fairness

With:

```text
14 players
3 courts
7 rounds
```

no player should systematically receive significantly fewer games than others.

### No consecutive sits

Verify consecutive sitting does not occur unless unavoidable.

### Partner diversity

Across many rounds, repeated partnerships should occur significantly less often than random assignment.

### Skill balance

Generated matches should generally have smaller rating differences than purely random matchmaking.

### Odd attendance sizes

Test:

```text
4
5
6
7
8
9
10
11
12
13
14
15
16
20
24
```

players.

### Rating updates

Test:

- expected favorite wins
- underdog wins
- equal teams
- provisional player K-factor
- established player K-factor

### Reproducibility

Allow the matchmaking function to optionally accept a random seed for tests.

---

# 27. Success Metrics

For the MVP, success means:

### Playing fairness

Across a session, games played should generally differ by no more than one among players who attended the same amount of time.

### Variety

The system should maximize unique partners before heavily repeating existing partners when possible.

### Match quality

Most games should avoid extreme team-rating differences.

### Speed

Generating a round should feel instantaneous.

Target:

```text
< 500 ms
```

on normal workloads.

### Usability

An organizer should be able to go from opening the app to generating Round 1 in less than one minute.

Generating subsequent rounds should require only a few taps.

---

# 28. MVP Acceptance Scenario

Given:

```text
14 attending players
3 courts
```

When the organizer generates Round 1:

- 12 players are assigned to three courts.
- 2 players sit.

After results are entered and Round 2 is generated:

- players who sat Round 1 should strongly be favored to play.
- players should generally receive new partners.
- teams should have reasonably similar average ratings.

After several rounds:

- game counts remain approximately even.
- partnerships rotate throughout the group.
- opponent combinations vary.
- skill ratings update from recorded results.

If a player's ability improves over several weeks, their rating should rise automatically and future games should adjust accordingly.

---

# 29. Implementation Order

Build in this order:

### Phase 1 — Core Engine

Implement:

- player model
- Elo calculations
- round scoring
- sitting fairness
- partner-history scoring
- opponent-history scoring
- randomized candidate generation
- automated tests

Do this before spending significant effort on UI.

### Phase 2 — Local Functional App

Implement:

- roster
- attendance
- court count
- generate round
- results entry
- next round
- session history

### Phase 3 — Persistence

Add PostgreSQL/Supabase.

Persist:

- players
- sessions
- rounds
- games
- results
- ratings

### Phase 4 — Mobile Polish

Add:

- responsive layout
- PWA manifest
- installability
- loading/error states
- outdoor-readable UI
- confirmation/undo interactions

### Phase 5 — Group Sharing

Add:

- read-only session URL
- QR code
- optional player self-check-in

---

# 30. Instructions for Coding Agent

Treat this PRD as the source of truth.

Before implementation:

1. Produce a concise architecture plan.
2. Define the database schema.
3. Define TypeScript interfaces for matchmaking inputs/outputs.
4. Implement and test the matchmaking engine independently.
5. Only then build the application UI around the engine.

Prioritize working software over unnecessary abstraction.

Do not add features outside this PRD without a clear requirement.

When ambiguity exists, optimize for:

```text
simple UX
> fair participation
> partner variety
> balanced matches
> technical sophistication
```

The hardest and most important component is the matchmaking engine.

It should be well-tested, understandable, configurable, and independent of the presentation layer.
