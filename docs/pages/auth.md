# Authentication, Email Delivery & Identity — `/player-login`, `/player-signup`, `/forgot-password`, `/reset-password`, `/verify-email`

The authentication system handles player onboarding, credential verification, email delivery (local console mock, Resend, or Cloudflare Email Sending), headless Netlify Identity (GoTrue) integration, Google OAuth, and player session management.

## Overview & Routing

- **Sign In (`/player-login`)**: Offers a 1-click **"Continue with Google"** button alongside a native credentials form accepting `username` or `email` and `password`. Includes a "Forgot password?" link directing to `/forgot-password`, and preserves the target return path (`?next=...`).
- **Sign Up (`/player-signup`)**: Native player registration featuring **"Continue with Google"** and custom registration capturing `username`, display `name`, optional `email`, `gender`, `password` (minimum 10 characters), and starting skill tier or custom DUPR rating. If an email is supplied, a verification token is created and a verification email is dispatched.
- **Forgot Password (`/forgot-password`)**: Native input form for username or email. Generates a database-backed password reset token (`password_reset_tokens`), sends a reset email with an actionable URL (`/reset-password?token=...`), and supports Netlify Identity recovery as a secondary provider. In local development, the reset link is printed to the terminal console and displayed directly on screen.
- **Reset Password (`/reset-password`)**: Custom password reset form allowing players to enter and confirm their new password using either a database token (`?token=...`) or Netlify Identity recovery token (`#recovery_token=...`).
- **Verify Email (`/verify-email`)**: Verification screen where users confirm their recovery email token (`?token=...`). On confirmation, sets `email_verified = true` in PostgreSQL and deletes the token.
- **Recovery Email Banner (`RecoveryEmailBanner`)**: Persistent notice on `/` and `/players` prompting players without a connected or verified recovery email to add one, with 1-click resend and local verification shortcuts.

## Email Delivery Architecture (`src/lib/email/email-service.ts`)

1. **Local Development (Zero-Config)**:
   - When no external email provider API key is configured, emails are dispatched to the server terminal console with recipient, subject, and direct action URLs:
     ```
     ══════════════════════════════════════════════════════════════════════════════
     📬 [LOCAL DEV EMAIL DISPATCH]
        To:         athlete@example.com
        Subject:    Verify your Pickleball Matcher recovery email
        👉 Link:    http://localhost:3000/verify-email?token=...
     ══════════════════════════════════════════════════════════════════════════════
     ```
   - In addition, server actions return `localDevUrl` and `verificationToken` so developers can click "Verify Now →" directly in the UI.

2. **Production Providers**:
   - **Resend API (`RESEND_API_KEY`)**: Universal REST-based dispatch (`https://api.resend.com/emails`) that runs identically in Node.js, Cloudflare Workers, and Netlify Functions. Configured via `RESEND_API_KEY` and optional `RESEND_FROM_EMAIL`.
   - **Cloudflare Email Sending (`CLOUDFLARE_EMAIL_TOKEN` & `CLOUDFLARE_ACCOUNT_ID`)**: Native transactional email support via Cloudflare Email Sending REST API.
   - **Netlify Identity (GoTrue)**: Secondary authentication and password recovery provider when deployed to Netlify with Identity enabled.

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
