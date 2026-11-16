# Authentication & Account Recovery — `/player-login`, `/player-signup`, `/forgot-password`, `/reset-password`, `/verify-email`

The authentication system handles player onboarding, credential verification, recovery email attachment, and self-service password resets.

## Overview & Routing

- **Sign In (`/player-login`)**: Form accepting `username` and `password`. Includes a "Forgot password?" link for account recovery and context preservation when entering from invite or session links (`?next=...`).
- **Sign Up (`/player-signup`)**: New player registration capturing `username`, display `name`, optional `email` (for recovery), `gender`, `password` (minimum 10 characters), and starting skill tier or custom DUPR rating.
- **Forgot Password (`/forgot-password`)**: Self-service recovery entry point accepting username or email. Sends a time-limited (1-hour) cryptographic password reset link via Resend.
- **Reset Password (`/reset-password?token=...`)**: Form validating a one-time reset token and allowing the player to set and confirm a new password.
- **Verify Email (`/verify-email?token=...`)**: Confirms ownership of a recovery email address, enabling automated password reset for that account.

## Account Recovery & Migration for Existing Users

1. **Non-blocking Schema Migration**:
   - `player_accounts` includes nullable `email` and `email_verified` columns with a unique index on `lower(trim(email))`.
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

