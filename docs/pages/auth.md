# Authentication & Netlify Identity — `/player-login`, `/player-signup`

The authentication system handles player onboarding, credential verification, Netlify Identity integration, and player session management.

## Overview & Routing

- **Sign In (`/player-login`)**: Offers 1-click **"Sign In with Netlify"** opening the Netlify Identity widget modal, alongside a credentials form accepting `username` or `email` and `password`. Includes a "Forgot password?" link triggering Netlify Identity's built-in password recovery modal, and context preservation when entering from invite or session links (`?next=...`).
- **Sign Up (`/player-signup`)**: New player onboarding featuring **"Sign Up with Netlify"** and traditional registration capturing `username`, display `name`, optional `email`, `gender`, `password` (minimum 10 characters), and starting skill tier or custom DUPR rating.

## Netlify Identity Widget Integration

1. **Client-Side Initialization**:
   - The Netlify Identity widget is loaded via `<NetlifyIdentityInitializer />` in the root layout (`src/app/layout.tsx`).
   - Connects automatically to the site's `/.netlify/identity` endpoint (or `NEXT_PUBLIC_NETLIFY_IDENTITY_URL` when developing locally).
   - Detects URL hash tokens (`#recovery_token=...`, `#confirmation_token=...`, `#invite_token=...`) dispatched in Netlify emails and automatically opens the appropriate modal view.
2. **Session Linking (`loginWithNetlifyIdentityAction`)**:
   - When a player authenticates via the Netlify Identity widget, the client receives the user object (`id`, `email`, `user_metadata`).
   - Dispatches `loginWithNetlifyIdentityAction` to verify/match the user:
     - If an existing account matches `email`, links the session to that account.
     - If not, auto-provisions a new player account with intermediate rating (1000 Elo), unique username, and verified email status.
   - Issues a signed JWT session cookie (`player_session`, 30-day expiry) and redirects to the intended destination (`next` or `/`).
3. **Password Recovery & Email Delivery**:
   - Handled directly by Netlify Identity's email infrastructure, eliminating external SMTP dependencies or custom domain configuration requirements.
