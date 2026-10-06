# Pickleball Matchmaker (MVP)

A mobile-first, high-contrast web application designed for recurring recreational pickleball groups (12–24 players, 2–4 courts). It generates fair, varied doubles pairings in under 500 ms while running on phones outdoors in bright sunlight.

---

## Key Features

- **Fair Matchmaking Engine**: Enforces strict lexicographic fairness:
  1. Sit equity (no player sits twice until all eligible players have sat).
  2. Court utilization (maximize active courts).
  3. Partnership variation (minimize repeat partners).
  4. Opponent variation (minimize repeat opponents).
  5. Competitive balance (even matches based on dynamic skill ratings).
- **Outdoor-Optimized Mobile UI**: High-contrast, large tap targets, dark surface theme (`slate-950`), sticky action bar within thumb reach, and Atkinson Hyperlegible typography.
- **PIN-Based Group Security**: Lightweight 4-digit PIN for group organizers; no email or OAuth required on court. Protected by bcrypt, rate limiting, and signed JWT cookies.
- **Read-Only Spectator Mode**: Live shareable link (`/s/[shareId]`) for players to view court assignments and scores on their own devices without mutation access.
- **Safe Corrections & Rating Replay**: Edit past scores, cancel matches, or undo rounds at any point. When a historical score changes, ratings are deterministically recomputed from the beginning.
- **Installable PWA**: Web manifest and icons support "Add to Home Screen" on iOS and Android.

---

## Architecture & Tech Stack

- **Framework**: Next.js 16 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS v4, mobile-first responsive layout, Atkinson Hyperlegible typography
- **Database**: PostgreSQL (Supabase or standard Postgres), `postgres.js` client
- **Testing**:
  - **Vitest**: Unit tests, component tests, and Monte Carlo fairness simulations
  - **Playwright**: End-to-end acceptance workflows at mobile and desktop viewports
  - **@axe-core/playwright**: Automated accessibility audits (WCAG AA)

---

## Authentication & Security Model

1. **Group Creation**:
   - Creating a group at `/setup` requires a secret `SETUP_TOKEN` defined in the server environment.
   - The organizer sets the group name and a 4-digit PIN.
2. **PIN Authentication**:
   - Organizers sign in at `/g/[groupId]/login` with their 4-digit PIN.
   - PINs are hashed using `bcryptjs` (salt rounds: 10).
   - Rate limiting tracks failed attempts by group and client fingerprint in Postgres; excessive attempts trigger temporary lockout.
3. **Session Cookies**:
   - Organizers receive an `organizer_session` HTTP-only, SameSite=Lax JWT cookie signed with HS256 (`ORGANIZER_SESSION_SECRET`).
   - The token payload binds the group ID, expiration, and a hash of the client's user-agent fingerprint (`ORGANIZER_FINGERPRINT_SECRET`).
4. **Public Spectator Sharing**:
   - Each group has an unguessable high-entropy `public_share_id`.
   - The route `/s/[shareId]` provides a read-only spectator view. Server actions strictly check organizer authorization to prevent unauthenticated mutations.

---

## Matchmaking Configuration & Tuning

Matchmaking weights and penalties are defined in `src/lib/matchmaking/config.ts`:

```ts
export const DEFAULT_MATCHMAKING_CONFIG: MatchmakingConfig = {
  weights: {
    repeatPartnerSession: 1_000,
    repeatOpponentSession: 100,
    ratingImbalance: 10,
    repeatPartnerLifetime: 5,
    repeatOpponentLifetime: 1,
  },
  // Recency decay, partner/opponent limits, and court priorities
};
```

Monte Carlo simulation benchmarks in `tests/matchmaking/simulation.test.ts` verify that:
- Every round is computed in < 500 ms (median < 50 ms).
- Sit variance across players remains $\le 1$ game.
- Duplicate partnerships are minimized over multi-round sessions.

---

## Local Development Setup

### 1. Prerequisites

- **Node.js**: >= 22.12.0
- **Docker**: For running the local PostgreSQL container (or Supabase CLI)

### 2. Start PostgreSQL

Run the Postgres container on port `54322`:

```bash
docker run -d \
  --name pickleball-test-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_HOST_AUTH_METHOD=trust \
  -e POSTGRES_DB=postgres \
  -p 54322:5432 \
  postgres:17-alpine
```

*(Alternatively, use `npx supabase start` if you prefer the Supabase CLI).*

### 3. Configure Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Example configuration:

```env
DATABASE_URL=postgresql://postgres@127.0.0.1:54322/postgres
ORGANIZER_SESSION_SECRET=local-dev-organizer-secret-at-least-32-chars
ORGANIZER_FINGERPRINT_SECRET=local-dev-fingerprint-secret-at-least-32-chars
SESSION_COOKIE_SECURE=false
SETUP_TOKEN=test-setup-token
```

### 4. Run Migrations

Apply the database schema and rate limiting tables:

```bash
npm run db:migrate
```

To reset the database cleanly:

```bash
npm run db:reset
```

### 5. Start the Dev Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to view the application.

---

## Verification & Testing Gates

Run the verification suite across all layers:

```bash
# 1. Code Quality & Formatting
npm run lint

# 2. Type Checking
npm run typecheck

# 3. Unit & Component Tests
npm test

# 4. Matchmaking Fairness & Simulation Benchmarks
npm run test:simulation

# 5. Database & Server Action Integration Tests
npm run test:integration

# 6. Production Build Verification
npm run build

# 7. End-to-End Acceptance Tests (Playwright)
npm run test:e2e
```

---

## CI / CD Pipeline

The GitHub Actions workflow in `.github/workflows/ci.yml` runs on every push and pull request:
- Starts a PostgreSQL 17 service container on port `54322`.
- Runs ESLint, TypeScript check, and Vitest unit/component tests.
- Executes the Monte Carlo simulation suite to ensure matchmaking latency and fairness criteria.
- Applies database migrations and runs integration tests.
- Builds the production Next.js bundle.
- Runs Playwright end-to-end acceptance and accessibility tests on Mobile and Desktop Chrome.
