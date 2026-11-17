# Authentication & Netlify Identity — `/player-login`, `/player-signup`, `/forgot-password`, `/reset-password`

The authentication system handles player onboarding, credential verification, headless Netlify Identity (GoTrue) integration, Google OAuth, and player session management without any third-party popups or modals.

## Overview & Routing

- **Sign In (`/player-login`)**: Offers a 1-click **"Continue with Google"** button alongside a native credentials form accepting `username` or `email` and `password`. Includes a "Forgot password?" link directing to `/forgot-password`, and preserves the target return path (`?next=...`).
- **Sign Up (`/player-signup`)**: Native player registration featuring **"Continue with Google"** and custom registration capturing `username`, display `name`, optional `email`, `gender`, `password` (minimum 10 characters), and starting skill tier or custom DUPR rating.
- **Forgot Password (`/forgot-password`)**: Native input form for player email that dispatches password recovery emails via Netlify GoTrue (`/.netlify/identity/recover`), eliminating custom SMTP and DNS setup requirements.
- **Reset Password (`/reset-password`)**: Custom password reset form allowing players to enter and confirm their new password when arriving with a `#recovery_token=...` or `?token=...`.

## Headless Netlify Identity (GoTrue) Integration

1. **Direct REST API Client (`src/lib/auth/netlify-gotrue.ts`)**:
   - Interacts headlessly with Netlify GoTrue endpoints (`/.netlify/identity/signup`, `/token`, `/recover`, `/user`, `/authorize?provider=google`).
   - Automatically resolves Netlify identity URL via `URL` environment variable on Netlify or `NEXT_PUBLIC_NETLIFY_IDENTITY_URL` / `NETLIFY_IDENTITY_URL` in local development.
2. **Google OAuth (`/api/auth/google`)**:
   - Initiates external OAuth flow by redirecting to Netlify Identity's `/authorize?provider=google`.
   - Upon completion, Netlify redirects to the application with `#access_token=...`.
3. **Client-Side Auth Listener (`<NetlifyAuthListener />`)**:
   - Mounted globally in `src/app/layout.tsx`.
   - Detects URL hash fragments:
     - `#access_token=...`: Decodes the identity JWT payload, extracts player profile/email, calls `loginWithNetlifyIdentityAction` to link or auto-provision the player account in PostgreSQL, sets the `player_session` cookie, and cleans the URL hash.
     - `#recovery_token=...`: Intercepts recovery email links and redirects the user to `/reset-password?token=...` with the token preserved.
4. **Session Linking (`loginWithNetlifyIdentityAction`)**:
   - Dispatched automatically on Google OAuth callback.
   - If an existing account matches `email`, links the session to that account.
   - If not, auto-provisions a new player account with intermediate rating (1000 Elo), unique username, and verified email status.
   - Issues a signed JWT session cookie (`player_session`, 30-day expiry) and redirects to the intended destination (`next` or `/`).
5. **Password Recovery & Email Delivery**:
   - Netlify Identity GoTrue delivers recovery emails directly through Netlify's built-in mailers without requiring custom domain DKIM/SPF records.
