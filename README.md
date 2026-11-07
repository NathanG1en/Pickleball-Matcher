# Pickleball Matchmaker

**Fair rounds. Fresh partners. Less time organizing, more time playing.**

A mobile-first app for pickleball clubs and recurring groups. Manage attendance, generate varied court lineups, record scores, and follow player ratings and partner chemistry across sessions.

![Pickleball Matchmaker home screen with account and quick-session options](docs/screenshots/home.webp)

[Explore the screens](#screenshots) · [Run locally](#run-locally) · [Testing](#testing) · [Technical docs](#technical-docs)

## What you can do

- **Run organized sessions.** Choose up to six courts, mark attendance, and generate lineups that weigh playing time, consecutive sit-outs, repeat partners and opponents, and skill balance.
- **Keep the group flexible.** Mix doubles, singles, and 2v1 courts; adjust attendance or court sizes as the session changes. Rated doubles affect Elo; singles and 2v1 games in normal sessions keep scores without changing ratings.
- **Keep friends together.** Set session-specific Stay Together pairs, or let members request a partner for organizer approval. Friends generally play and sit together, with an exception when only one bench spot is available.
- **Save scores and keep moving.** Save individual courts, batch-save results, or use **Save & Start** to save scores and start the next round in one action. Preview upcoming lineups before advancing.
- **Correct mistakes.** Edit historical scores, cancel matches, or undo a round. Rating and chemistry replay keeps derived history consistent with corrected results.
- **Choose another format.** Use Open Play for flexible game submissions, tournaments for bracket play, or a temporary quick session without creating an account.
- **Follow progress.** Player profiles show ratings, results, and partner chemistry. Completed sessions include highlights and a player-by-player summary.
- **Share the organizing.** Group hosts can appoint additional organizers. Public/private group and profile settings control visibility.

The interface uses high contrast, large controls, a thumb-reachable action bar, and small pickleball animations with reduced-motion support.

## Screenshots

Captured from a local instance with a fictional **Riverside Pickleball Club** and demo accounts. No production player data is shown. Click a screenshot to view it at full size.

<table>
  <tr>
    <td width="50%" valign="top">
      <strong>Group dashboard</strong><br>
      Manage the roster, search and filter players, and organize your club.<br><br>
      <a href="docs/screenshots/group-dashboard.webp"><img src="docs/screenshots/group-dashboard.webp" alt="Riverside club dashboard with a searchable roster and player ratings" width="100%"></a>
    </td>
    <td width="50%" valign="top">
      <strong>Session setup</strong><br>
      Choose court sizes and select the players who are attending.<br><br>
      <a href="docs/screenshots/session-setup.webp"><img src="docs/screenshots/session-setup.webp" alt="Session setup with two doubles courts and twelve selected players" width="100%"></a>
    </td>
  </tr>
  <tr>
    <td valign="top">
      <strong>Round lineups</strong><br>
      Review teams, sitting players, and the matchmaking variety setting.<br><br>
      <a href="docs/screenshots/round-lineup.webp"><img src="docs/screenshots/round-lineup.webp" alt="Generated doubles lineups on two courts with four players sitting out" width="100%"></a>
    </td>
    <td valign="top">
      <strong>Score entry</strong><br>
      Enter court results and save them together before starting the next round.<br><br>
      <a href="docs/screenshots/score-entry.webp"><img src="docs/screenshots/score-entry.webp" alt="Organizer score entry with two court results and Save All and Save and Start controls" width="100%"></a>
    </td>
  </tr>
  <tr>
    <td valign="top">
      <strong>Player profile</strong><br>
      See your rating, partner chemistry, results, and groups.<br><br>
      <a href="docs/screenshots/player-profile.webp"><img src="docs/screenshots/player-profile.webp" alt="Demo player profile showing current rating, chemistry spotlight, and match statistics" width="100%"></a>
    </td>
    <td valign="top">
      <strong>Session recap</strong><br>
      Look back at highlights and each player's results.<br><br>
      <a href="docs/screenshots/session-summary.webp"><img src="docs/screenshots/session-summary.webp" alt="Completed session showing game totals and closest-game, wins, and partnership highlights" width="100%"></a>
    </td>
  </tr>
</table>

<details>
<summary><strong>On your phone</strong> — scoring with the action bar within reach</summary>
<br>
<img src="docs/screenshots/mobile-scoring.webp" alt="Mobile score entry with large score inputs and a sticky Save All and Save and Start action bar" width="390">
</details>

## A typical club session

1. Create an account and a group, then add registered players or guests.
2. Start a normal session, select attendees and courts, and optionally pair friends with Stay Together.
3. Review the proposed lineup, reshuffle or make manual changes, then confirm the round.
4. Enter results and use **Save & Start** to advance. Adjust attendance as people arrive or leave.
5. End the session and review its highlights, results, and rating changes.

## Run locally

### Prerequisites

- Node.js **22.12.0 or newer** and npm.
- PostgreSQL. A local Docker container works; a separate Neon development branch also works.

### 1. Install dependencies

```bash
npm install
cp .env.example .env.local
```

### 2. Start a local database

If you already have a development database, use its connection string instead. Otherwise:

```bash
docker run -d \
  --name pickleball-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=local-dev-only \
  -e POSTGRES_DB=pickleball \
  -p 127.0.0.1:54322:5432 \
  postgres:17-alpine
```

### 3. Configure `.env.local`

Set `DATABASE_URL` to your development database. For the container above:

```dotenv
DATABASE_URL=postgresql://postgres:local-dev-only@127.0.0.1:54322/pickleball
PLAYER_SESSION_SECRET=replace-with-an-independent-random-secret
ORGANIZER_SESSION_SECRET=replace-with-an-independent-random-secret
ORGANIZER_FINGERPRINT_SECRET=replace-with-an-independent-random-secret
SESSION_COOKIE_SECURE=false
```

Generate a different secret for each secret variable; each must contain at least 32 bytes:

```bash
openssl rand -hex 32
```

Keep environment files and database credentials out of Git. Use secure cookies (`SESSION_COOKIE_SECURE=true`) for HTTPS deployments. `.env.example` also includes `SETUP_TOKEN` for legacy setup compatibility; current group creation uses an authenticated player account.

### 4. Migrate and start

```bash
npm run db:migrate
npm run dev
```

Open [localhost:3000](http://localhost:3000), create a player account, and create your first group. Its creator becomes the host and is automatically included in the roster.

## Testing

Fast checks:

```bash
npm run lint
npm run typecheck
npm test
npm run test:simulation
```

Database integration and browser tests require a **separate test database**. For the disposable local container above:

```bash
export DATABASE_URL='postgresql://postgres:local-dev-only@127.0.0.1:54322/pickleball'
export TEST_DATABASE_URL='postgresql://postgres:local-dev-only@127.0.0.1:54322/test_db'
export DISPOSABLE_POSTGRES_TESTS=1

node scripts/create-test-db.js
npm run db:migrate:test
npx playwright install chromium

npm run test:integration
npm run test:e2e
```

These suites create and modify test data; keep them off production and shared development databases. The browser suite covers desktop and mobile Chrome, organizer permissions, corrections, accessibility, failure recovery, and concurrent submissions. Its local server defaults to port **3100**.

The maintenance suite creates its own temporary database on an explicitly supplied local PostgreSQL server:

```bash
MAINTENANCE_TEST_ADMIN_URL="$DATABASE_URL" npm run test:maintenance
```

[GitHub Actions CI](.github/workflows/ci.yml) defines the complete lint, typecheck, unit, simulation, integration, maintenance, build, and browser gates.

## Stack and project layout

| Layer | Technology |
| --- | --- |
| Application | Next.js 16 App Router, React 19, TypeScript |
| Styling | Tailwind CSS 4, Barlow Condensed, Atkinson Hyperlegible |
| Persistence | PostgreSQL / Neon with `postgres.js` |
| Authentication | Player accounts, bcrypt password hashes, signed HTTP-only session cookies |
| Hosting | Cloudflare Workers through OpenNext |
| Verification | Vitest, Playwright, axe accessibility checks |

```text
src/app/                 Routes and server actions
src/components/          Shared UI and session screens
src/lib/domain/          Session workflows, ratings, and chemistry replay
src/lib/matchmaking/     Lineup generation, fairness scoring, and Stay Together
src/lib/db/              PostgreSQL repositories
migrations/             Database migrations
scripts/maintenance/    Controlled starting-rating corrections
tests/                  Unit, component, simulation, integration, and E2E suites
docs/                   Design notes, operations guides, and benchmarks
```

Matchmaking weights and the search iteration budget live in [`src/lib/matchmaking/config.ts`](src/lib/matchmaking/config.ts). Application request latency also includes database and rendering work; algorithm timings alone do not measure the full organizer experience.

## Deployment

The repository includes an OpenNext/Cloudflare Workers configuration and a [deployment workflow](.github/workflows/deploy-cloudflare.yml) triggered by pushes to `development`.

```bash
npm run build:worker     # Build the Worker bundle
npm run preview:worker   # Build and preview with Wrangler
npm run deploy:worker    # Build and deploy with Wrangler
```

Configure the target database and authentication secrets in the deployment environment, and apply any pending migrations to that database. The deployment workflow and CI workflow run separately; the deploy workflow does not wait for the CI release gate.

## Technical docs

- [Elo rating system and displayed ratings](docs/elo-rating-system.md)
- [Partner chemistry and privacy](docs/synergy-and-privacy-system.md)
- [Controlled starting-rating maintenance](docs/operations/rating-maintenance.md)
- [Organizer performance benchmarks](docs/benchmarks/2026-10-31-current-club-profile.md)
- [Design specifications](docs/superpowers/specs/) and [implementation plans](docs/superpowers/plans/)
