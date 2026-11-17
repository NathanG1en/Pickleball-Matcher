# Authentication, Email Verification & Recovery — `/player-login`, `/player-signup`, `/forgot-password`, `/reset-password`, `/verify-email`

The authentication and account recovery system supports interchangeable headless authentication providers: **Neon Auth** (with built-in email delivery via Neon's shared mailer `auth@mail.myneon.app`) and **Netlify Identity (GoTrue)** for headless authentication, Google OAuth, and email recovery, backed by PostgreSQL / SQLite for player profiles and game sessions.

## Overview & Routing

- **Sign In (`/player-login`)**: Offers a 1-click **"Continue with Google"** button via Netlify Identity alongside a native credentials form accepting `username` or `email` and `password`. Includes a "Forgot password?" link directing to `/forgot-password`, preserving the return path (`?next=...`).
- **Sign Up (`/player-signup`)**: Native player registration featuring **"Continue with Google"** and custom registration capturing `username`, display `name`, optional `email`, `gender`, `password` (minimum 10 characters), and starting skill tier or custom DUPR rating. When an email is provided, automatically triggers email verification via Neon Auth or Netlify Identity.
- **Forgot Password (`/forgot-password`)**: Native input form for username or email. Dispatches a password recovery email via Neon Auth (sending a 6-digit OTP code) or Netlify Identity (`/.netlify/identity/recover`). When running in local development without a connected auth service, prints the recovery link to the terminal and displays a local shortcut. Upon request, provides a direct link to enter the 6-digit reset code (`/reset-password?email=...`).
- **Reset Password (`/reset-password`)**: Custom password reset form allowing players to enter and confirm their new password. Supports both arriving via link (`?token=...` or `#recovery_token=...`) and manual entry of the 6-digit OTP reset code with email.
- **Verify Email (`/verify-email`)**: Verification screen where users confirm their recovery email token (`?token=...`) or enter the 6-digit verification code received in their inbox.
- **Recovery Email Banner (`RecoveryEmailBanner`)**: Persistent notice on `/` and `/players` prompting players without a connected or verified recovery email to connect one, with 1-click resend, direct links to `/verify-email`, and local verification shortcuts.

## Authentication Providers Architecture

### 1. Neon Auth Architecture (`src/lib/auth/neon-auth.ts`)
- **Direct REST API Client**:
  - Connects headlessly to Neon Auth endpoints on `${NEON_AUTH_BASE_URL}` (`/sign-up/email`, `/email-otp/send-verification-otp`, `/email-otp/verify-email`, `/email-otp/reset-password`).
  - Active whenever `NEON_AUTH_BASE_URL` is set in the environment.
- **Out-of-the-Box Email Delivery**:
  - Automatically dispatches 6-digit OTP verification codes and password reset codes to real player inboxes via Neon's shared transactional email service (`auth@mail.myneon.app`).
  - Requires zero third-party email API keys (no Resend/SendGrid credentials required).
- **OTP Verification & Password Recovery**:
  - `/verify-email` verifies 6-digit codes via Neon Auth's `/email-otp/verify-email` and updates `player_accounts.email_verified = true`.
  - `/reset-password` resets credentials via Neon Auth's `/email-otp/reset-password` and updates the bcrypt password hash in `player_accounts`.

### 2. Netlify Identity (GoTrue) Architecture (`src/lib/auth/netlify-gotrue.ts`)
- **Direct REST API Client**:
  - Interacts headlessly with Netlify GoTrue endpoints (`/.netlify/identity/signup`, `/token`, `/recover`, `/user`, `/authorize?provider=google`).
  - Automatically resolves Netlify Identity URL via `process.env.URL` on Netlify or `NETLIFY_IDENTITY_URL` in local development.
- **Email Delivery via Netlify**:
  - Password recovery emails are dispatched via Netlify GoTrue's `/recover` endpoint.
  - Netlify sends recovery emails containing links with the URL hash `#recovery_token=...`.
  - The `<NetlifyAuthListener />` component intercepts `#recovery_token=...` and routes the player to `/reset-password?token=...`.
- **Production Netlify Configuration**:
  - In Netlify Dashboard: **Site configuration > Identity > Enable Identity**.
  - Under **Emails**, Netlify delivers confirmation and recovery emails through its built-in email service without requiring external SMTP configuration.
  - Under **External providers**, enable **Google** for 1-click Google OAuth.
