# Authentication, Email Verification & Recovery — `/player-login`, `/player-signup`, `/forgot-password`, `/reset-password`, `/verify-email`

The authentication and account recovery system uses **Neon Auth** (with built-in email delivery via Neon's transactional mailer `auth@mail.myneon.app`) for headless authentication, OTP verification, password resets, and social OAuth, backed by PostgreSQL / SQLite for player profiles and game sessions.

## Overview & Routing

- **Sign In (`/player-login`)**: Offers a native credentials form accepting `username` or `email` and `password`, along with social authentication options. Includes a "Forgot password?" link directing to `/forgot-password`, preserving the return path (`?next=...`).
- **Sign Up (`/player-signup`)**: Native player registration capturing `username`, display `name`, optional `email`, `gender`, `password` (minimum 10 characters), and starting skill tier or custom DUPR rating. When an email is provided, automatically triggers email verification via Neon Auth.
- **Forgot Password (`/forgot-password`)**: Native input form for username or email. Dispatches a password recovery email via Neon Auth (sending a 6-digit OTP code). When running in local development without a connected auth service, prints the recovery link to the terminal and displays a local shortcut. Upon request, provides a direct link to enter the 6-digit reset code (`/reset-password?email=...`).
- **Reset Password (`/reset-password`)**: Custom password reset form allowing players to enter and confirm their new password. Supports arriving via local link (`?token=...`) or entering the 6-digit reset code in the same tappable code boxes as Verify Email; all six boxes must be filled.
- **Verify Email (`/verify-email`)**: One card with the **Verify Email** heading and a single line saying where the code went ("We sent a 6-digit code to <email>"). With no `?email=`, the line asks for the code from the verification email, and an Email Address field appears.
  - **Code boxes:** six boxes, one per digit. Tap any box, or use ← → (Home/End), to choose where to type. Typing replaces that box's digit and moves to the next box. Backspace clears the box, or, in an empty box, steps back and clears the one before. Clearing a middle box leaves a gap instead of sliding later digits over.
  - **Paste and autofill:** a pasted or autofilled code fills every box. Every box is marked as a one-time code, so the browser offers codes (iOS and macOS Safari can pull them from Messages and Mail) rather than saved email addresses. The focused box lifts and turns lime, and each digit pops in as it lands.
  - **Checking:** a code is checked as soon as it's complete, when the last box is typed, or when a whole code is pasted. Fixing a middle digit of an already complete code waits for **Verify Code**, so retyping doesn't resend it after every digit. The boxes bounce in a wave while it's checked. **Verify Code** works too. A wrong code shakes the boxes and shows an error. The digits stay, and focus returns to the first box, so retyping overwrites them from the start. A 6-digit `?token=` pre-fills the boxes; a long link token is ignored.
  - **Didn't get it? Send a new code:** shown only to a signed-in player. It sends a fresh code to their recovery email, clears the boxes and says "Fresh code on its way. Check your inbox."
  - **Go to Profile →:** a text link back to `/players` for anyone who wants to verify later.
  - **Success:** the card swaps to a bouncing lime check, the heading **Email verified!**, one line ("<email> can now get you back into your account.") and a **Go to Profile →** button. No separate notification box.
  - **Motion:** all of it is skipped when the device asks for reduced motion.
- **Recovery Email Banner (`RecoveryEmailBanner`)**: A short notice on `/` and `/players`. It's hidden once the recovery email is verified.
  - **Unverified email:**
    - **Text:** **Recovery email not verified** and "Check <email> for your 6-digit verification code."
    - **Enter code →:** opens `/verify-email?email=<email>`.
    - **Resend code:** sends a fresh code and changes to "New code sent."
    - **Change email:** opens one email field with **Send code** and **Cancel**. Saving shows the banner again for the new address.
    - Errors show as one red line.
  - **No email yet:**
    - **Text:** **Add a recovery email** and "So you can reset your password if you forget it."
    - **Add email →:** opens the same email field.
    - **Not now:** hides the banner until the next visit.

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

