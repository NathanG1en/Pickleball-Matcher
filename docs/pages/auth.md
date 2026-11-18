# Authentication, Email Verification & Recovery — `/player-login`, `/player-signup`, `/forgot-password`, `/reset-password`, `/verify-email`

The authentication and account recovery system uses **Neon Auth** (with built-in email delivery via Neon's transactional mailer `auth@mail.myneon.app`) for headless authentication, OTP verification, password resets, and social OAuth, backed by PostgreSQL / SQLite for player profiles and game sessions.

## Overview & Routing

- **Sign In (`/player-login`)**: Offers a native credentials form accepting `username` or `email` and `password`, along with social authentication options. Includes a "Forgot password?" link directing to `/forgot-password`, preserving the return path (`?next=...`).
- **Sign Up (`/player-signup`)**: Native player registration capturing `username`, display `name`, optional `email`, `gender`, `password` (minimum 10 characters), and starting skill tier or custom DUPR rating. When an email is provided, automatically triggers email verification via Neon Auth.
- **Forgot Password (`/forgot-password`)**: Native input form for username or email. Dispatches a password recovery email via Neon Auth (sending a 6-digit OTP code). When running in local development without a connected auth service, prints the recovery link to the terminal and displays a local shortcut. Upon request, provides a direct link to enter the 6-digit reset code (`/reset-password?email=...`).
- **Reset Password (`/reset-password`)**: Custom password reset form allowing players to enter and confirm their new password. Supports both arriving via local link (`?token=...`) and manual entry of the 6-digit OTP reset code with email.
- **Verify Email (`/verify-email`)**: Verification screen where users confirm their recovery email token (`?token=...`) or enter the 6-digit verification code received in their inbox.
- **Recovery Email Banner (`RecoveryEmailBanner`)**: Persistent notice on `/` and `/players` prompting players without a connected or verified recovery email to connect one, with 1-click resend, direct links to `/verify-email`, and local verification shortcuts.

## Authentication Architecture

### Neon Auth (`src/lib/auth/neon-auth.ts`)
- **Direct REST API Client**:
  - Connects headlessly to Neon Auth endpoints on `${NEON_AUTH_BASE_URL}` (`/sign-up/email`, `/email-otp/send-verification-otp`, `/email-otp/verify-email`, `/email-otp/reset-password`).
  - Active whenever `NEON_AUTH_BASE_URL` is configured in the environment.
- **Out-of-the-Box Email Delivery**:
  - Automatically dispatches 6-digit OTP verification codes and password reset codes to player inboxes via Neon's shared transactional email service (`auth@mail.myneon.app`).
  - Requires zero third-party email API keys (no Resend/SendGrid credentials required).
- **OTP Verification & Password Recovery**:
  - `/verify-email` verifies 6-digit codes via Neon Auth's `/email-otp/verify-email` and updates `player_accounts.email_verified = true`.
  - `/reset-password` resets credentials via Neon Auth's `/email-otp/reset-password` and updates the bcrypt password hash in `player_accounts`.
- **Social & OAuth Authentication**:
  - Headless OAuth handling supported via `loginWithSocialAuthAction` in `src/app/actions/player-account.ts`, linking social identities with local player accounts.

