# Authentication, Google OAuth & Account Recovery — `/player-login`, `/player-signup`, `/forgot-password`, `/reset-password`, `/verify-email`

The authentication system handles player onboarding, credential verification, Google OAuth single sign-on, recovery email attachment, and self-service password resets.

## Overview & Routing

- **Sign In (`/player-login`)**: Offers 1-click **"Continue with Google"** OAuth sign-in and a credentials form accepting `username` and `password`. Includes a "Forgot password?" link for account recovery and context preservation when entering from invite or session links (`?next=...`).
- **Sign Up (`/player-signup`)**: New player onboarding featuring **"Sign up with Google"** and traditional registration capturing `username`, display `name`, optional `email` (for recovery), `gender`, `password` (minimum 10 characters), and starting skill tier or custom DUPR rating.
- **Forgot Password (`/forgot-password`)**: Self-service recovery entry point accepting username or email. Sends a time-limited (1-hour) cryptographic password reset link via Resend.
- **Reset Password (`/reset-password?token=...`)**: Form validating a one-time reset token and allowing the player to set and confirm a new password.
- **Verify Email (`/verify-email?token=...`)**: Confirms ownership of a recovery email address, enabling automated password reset for that account.

## Google OAuth Flow & Account Linking

1. **Initiate (`/api/auth/google`)**:
   - Generates a random cryptographic `state` and `nonce`.
   - Preserves destination return path (`?next=...`) in a secure HTTP-only cookie (`google_oauth_state`).
   - Redirects to Google's OpenID Connect consent screen requesting `openid email profile` scopes.
2. **Callback (`/api/auth/google/callback`)**:
   - Validates the returned authorization code and CSRF `state`.
   - Exchanges code for tokens at `https://oauth2.googleapis.com/token`.
   - Fetches verified profile from Google's OpenID Connect userinfo endpoint.
3. **Smart Account Resolution & Linking**:
   - **Existing Linked Account**: If `(provider='google', provider_user_id=sub)` exists in `oauth_accounts`, immediately signs in the associated player account.
   - **Email Match Linking**: If an existing player account shares the Google email address, automatically creates a new `oauth_accounts` link and marks `email_verified = true`.
   - **New Player Provisioning**: Automatically generates a unique username from the Google profile name/email, initializes default intermediate rating (1000 Elo), sets `password_hash = null`, marks `email_verified = true`, and creates both `player_accounts` and `oauth_accounts` records.
4. **Session Cookie**:
   - Issues a signed JWT session cookie (`player_session`, 30-day expiry) and redirects to the intended destination (`next` or `/`).

## Account Recovery & Migration for Existing Users

1. **Non-blocking Schema Migration**:
   - `player_accounts` includes nullable `email` and `email_verified` columns with a unique index on `lower(trim(email))`.
   - `player_accounts.password_hash` is nullable to support OAuth-only accounts.
   - Existing accounts created prior to the email layer continue to authenticate normally via `username` and `password`.
2. **Progressive Email Onboarding**:
   - Authenticated players without an email address see a friendly, non-blocking notification banner (`RecoveryEmailBanner`) on their profile page and home screen: *"Add Account Recovery Email"*.
   - Players can enter an email directly in the banner or dismiss it ("Remind me later").
   - Upon entering an email, a 24-hour verification token is dispatched via email.
3. **Verification**:
   - Unverified recovery emails cannot be used for password resets to protect against typos or account takeover.
   - Clicking the verification link updates `email_verified = true`.
4. **Self-Service Password Reset**:
   - If an account has a recovery email, the player can request a reset link anytime from `/forgot-password`.
   - The reset endpoint generates a cryptographically random token, stores its SHA-256 hash in `password_reset_tokens`, and sends a one-click link valid for 1 hour.
   - Reset requests return a uniform, privacy-preserving success message regardless of whether the account was found.
