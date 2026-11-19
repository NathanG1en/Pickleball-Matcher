# Authentication, Email Verification & Recovery — `/player-login`, `/player-signup`, `/forgot-password`, `/reset-password`, `/verify-email`

The authentication and account recovery system uses **Neon Auth** (with built-in email delivery via Neon's transactional mailer `auth@mail.myneon.app`) for headless authentication, OTP verification, password resets, and social OAuth, backed by PostgreSQL / SQLite for player profiles and game sessions.

## Overview & Routing

- **Sign In (`/player-login`)**: The card is centred vertically and horizontally in the space under the navigation. When the card fits fully within the viewport, page scrolling is prevented so the interface stays steady and centered; screens too short for the card (such as a phone in landscape) allow natural scrolling to reach all fields. Offers a native credentials form accepting `username` or `email` and `password`, along with social authentication options. Includes a "Forgot password?" link directing to `/forgot-password`, preserving the return path (`?next=...`).
- **Sign Up (`/player-signup`)**: Native player registration capturing `username`, display `name`, optional `email`, `gender`, `password` (minimum 10 characters), and starting skill tier or custom DUPR rating. When an email is provided, automatically triggers email verification via Neon Auth.
- **Forgot Password (`/forgot-password`)**: Native input form for username or email. Dispatches a password recovery email via Neon Auth (sending a 6-digit OTP code). When running in local development without a connected auth service, prints the recovery link to the terminal and displays a local shortcut. Upon request, provides a direct link to enter the 6-digit reset code (`/reset-password?email=...`).
- **Reset Password (`/reset-password`)**: Custom password reset form allowing players to enter and confirm their new password. Supports arriving via local link (`?token=...`) or entering the 6-digit reset code in the same tappable code boxes as Verify Email; all six boxes must be filled.
- **Verify Email (`/verify-email`)**: The card is centred in the space under the navigation (and above the phone tab bar). The page doesn't scroll, so the code boxes can't be scrolled away; only a screen too short for the card, like a phone in landscape, scrolls just enough to reach it. It's one card with the **Verify Email** heading and a single line saying where the code went ("We sent a 6-digit code to <email>"). With no `?email=`, the line asks for the code from the verification email, and an Email Address field appears.
  - **Code boxes:** six boxes, one per digit. Tap any box, or use ← → (Home/End), to choose where to type. Typing replaces that box's digit and moves to the next box. Backspace clears the box, or, in an empty box, steps back and clears the one before. Clearing a middle box leaves a gap instead of sliding later digits over.
  - **Paste and autofill:** a pasted or autofilled code fills every box. Every box is marked as a one-time code, so the browser offers codes (iOS and macOS Safari can pull them from Messages and Mail) rather than saved email addresses. The focused box lifts and turns lime, and each digit pops in as it lands.
  - **Checking:** a code is checked as soon as it's complete, when the last box is typed, or when a whole code is pasted. Fixing a middle digit of an already complete code waits for **Verify Code**, so retyping doesn't resend it after every digit. The boxes bounce in a wave while it's checked. **Verify Code** works too. A wrong code shakes the boxes and shows an error. The digits stay, and focus returns to the first box, so retyping overwrites them from the start. A 6-digit `?token=` pre-fills the boxes; a long link token is ignored.
  - **Didn't get it? Send a new code:** shown only to a signed-in player. It sends a fresh code to their recovery email, clears the boxes and says "Fresh code on its way. Check your inbox."
  - **Leaving:** the × in the corner returns home. There's no separate link under the form.
  - **Success:** the card swaps to a bouncing lime check, the heading **Email verified!**, one line ("<email> can now get you back into your account.") and a **Go to Profile →** button. No separate notification box.
  - **Motion:** all of it is skipped when the device asks for reduced motion.
- **Sending verification codes**: adding, changing or resending a recovery email asks Neon Auth for a code first, then signs the email up.
  - **Why this order:** with email verification required, Neon answers sign-up for an email it already knows with a generic success and sends nothing. Asking for a code first means changing an email and then changing it back, or resending to an email Neon already knows, still sends a code. A brand-new email gets its code from the sign-up instead, so there's exactly one email either way.
  - **When Neon refuses both requests:** the server logs "[Neon Auth] Couldn't send a verification code".
- **Finish your profile (`/player-signup/finish`)**: Shown once, after a first Google sign-in, before the account exists.
  - **Header:** "Signed in with Google as <email>".
  - **Username:** pre-filled from the part of the email before the @, with `_1`, `_2`… if it's taken.
  - **Display name:** pre-filled from Google.
  - **Gender:** **Male** / **Female** buttons with no default. Submitting without one says "Choose male or female."
  - **Starting skill level:** the same slider as sign-up, with "I know my exact rating" for a typed rating.
  - **Let's play →:** creates the account with the Google email, already verified, and no password; signs the player in; then continues to `?next=` (default `/players/groups`). The email always comes from the signed cookie, never from the form.
  - **No pending Google sign-in:** visiting without one, or after it expires, returns to `/player-login` with "Your Google sign-in timed out. Please try again."
- **Recovery Email Banner (`RecoveryEmailBanner`)**: A short notice on `/` and `/players`. It's hidden once the recovery email is verified.
  - **Layout:** one compact strip. On desktop: an envelope icon tile, the title with the email under it, small links under that, and the main button on the right. On a phone, the links and the button share one row under the icon and text.
  - **Unverified email:**
    - **Text:** **Recovery email not verified** with the email under it, beside a yellow envelope-with-alert tile.
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
- **Continue with Google** (on `/player-login`):
  1. **Starting:** the button calls Neon Auth's client SDK (`signIn.social`). It posts to `/api/auth/sign-in/social`, which the `[...path]` route proxies to Neon Auth; Neon sets a sign-in challenge cookie and sends the browser to Google. While it starts, the button reads "Opening Google…". If it can't start, a red line suggests the username and password form instead.
  2. **Coming back:** Google returns through Neon Auth to `/auth/google/complete?neon_auth_session_verifier=…`. `src/proxy.ts` runs Neon's middleware on that one path only, swaps the verifier for a Neon session cookie, and reloads the page without it.
  3. **Signing in:** the `/auth/google/complete` route reads the Google email from the Neon session.
     - **Existing player:** if a player already has that email, they're signed straight in and sent to `?next=` (default `/`).
     - **First-time player:** no account is created yet. The verified email and Google name go into a signed, http-only `pending_google_signup` cookie (30 minutes), and the player goes to **Finish your profile** (`/player-signup/finish`).
  4. **Failures:** a cancelled sign-in, a missing session or an unverified Google email returns to `/player-login` with a red error.
  - **Safety:** accounts are matched only by an email read from the server-side Neon session. There is no server action that signs in by an email the browser sends.
  - **The `/api/auth/*` proxy:** it forwards only `POST sign-in/social`, `GET get-session` and `POST sign-out`, and everything else returns 404. Neon's own email sign-in and sign-up aren't reachable on this domain, so a Neon session here can only come from Google.
  - **Neon users and passwords:** the app creates Neon users only to email verification codes. When no player password is involved, such as changing an email or resending, the Neon user gets a random password nobody knows.
  - **Neon Auth settings:** the Google provider must be enabled, using Neon's shared credentials or your own client. Localhost must be allowed for local development, and each deployed domain must be a trusted origin.
  - **Required environment:** every deployment needs `NEON_AUTH_BASE_URL` (that environment's branch's Neon Auth URL) and `NEON_AUTH_COOKIE_SECRET` (a random value, at least 32 characters). There are no built-in fallbacks.
    - **On first Google use without them:** the `/api/auth` request fails with "Neon Auth isn't configured", and the return page reports that sign-in didn't finish.
    - **What still works:** everything else, including builds.

