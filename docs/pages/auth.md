# Authentication, Netlify Identity & Recovery — `/player-login`, `/player-signup`, `/forgot-password`, `/reset-password`, `/verify-email`

The authentication and account recovery system uses **Netlify Identity (GoTrue)** for headless authentication, Google OAuth, and email recovery, combined with PostgreSQL for player profiles and game sessions.

## Overview & Routing

- **Sign In (`/player-login`)**: Offers a 1-click **"Continue with Google"** button via Netlify Identity alongside a native credentials form accepting `username` or `email` and `password`. Includes a "Forgot password?" link directing to `/forgot-password`, preserving the return path (`?next=...`).
- **Sign Up (`/player-signup`)**: Native player registration featuring **"Continue with Google"** and custom registration capturing `username`, display `name`, optional `email`, `gender`, `password` (minimum 10 characters), and starting skill tier or custom DUPR rating.
- **Forgot Password (`/forgot-password`)**: Native input form for username or email. Dispatches a password recovery email via Netlify Identity (`/.netlify/identity/recover`). When running in local development without a connected Netlify Identity instance, prints the recovery link to the terminal and displays a local shortcut.
- **Reset Password (`/reset-password`)**: Custom password reset form allowing players to enter and confirm their new password when arriving with a `#recovery_token=...` or `?token=...`.
- **Verify Email (`/verify-email`)**: Verification screen where users confirm their recovery email token (`?token=...`).
- **Recovery Email Banner (`RecoveryEmailBanner`)**: Persistent notice on `/` and `/players` prompting players without a connected or verified recovery email to connect one, with local verification shortcuts.

## Netlify Identity (GoTrue) Architecture (`src/lib/auth/netlify-gotrue.ts`)

1. **Direct REST API Client**:
   - Interacts headlessly with Netlify GoTrue endpoints (`/.netlify/identity/signup`, `/token`, `/recover`, `/user`, `/authorize?provider=google`).
   - Automatically resolves Netlify Identity URL via `process.env.URL` on Netlify or `NETLIFY_IDENTITY_URL` in local development.

2. **Email Delivery via Netlify**:
   - Password recovery emails are dispatched via Netlify GoTrue's `/recover` endpoint.
   - Netlify sends recovery emails containing links with the URL hash `#recovery_token=...`.
   - The `<NetlifyAuthListener />` component intercepts `#recovery_token=...` and routes the player to `/reset-password?token=...`.
   - On password reset, `resetPasswordAction` updates the password in Netlify Identity and updates the PostgreSQL account hash.

3. **Local Development Setup**:
   - **Offline / Mock Mode (Default)**: If `NETLIFY_IDENTITY_URL` is not configured in `.env.local`, actions log a clear banner in the server terminal with direct reset/verification links, and provide on-screen testing buttons.
   - **Connected Mode (Live Emails from Localhost)**: Setting `NETLIFY_IDENTITY_URL=https://<your-site>.netlify.app/.netlify/identity` in `.env.local` directs all local recovery requests to your live Netlify Identity service, triggering real outbound emails to inboxes.

4. **Production Netlify Configuration**:
   - In Netlify Dashboard: **Site configuration > Identity > Enable Identity**.
   - Under **Emails**, Netlify delivers confirmation and recovery emails through its built-in email service without requiring external SMTP configuration.
   - Under **External providers**, enable **Google** for 1-click Google OAuth.

5. **Cloudflare Integration**:
   - When using Cloudflare DNS with Netlify hosting, Cloudflare serves purely as the DNS and CDN layer (CNAME pointing to your Netlify site).
   - No email workers or third-party email providers are required.
