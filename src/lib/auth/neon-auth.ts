/**
 * Headless Neon Auth client.
 * Dispatches verification OTPs and password recovery emails via Neon Auth's
 * shared mailer (auth@mail.myneon.app) and verifies OTP codes.
 */

export function isNeonAuthConfigured(): boolean {
  const url = process.env.NEON_AUTH_BASE_URL || process.env.NEXT_PUBLIC_NEON_AUTH_BASE_URL;
  return Boolean(url && url.startsWith("http"));
}

export function getNeonAuthBaseUrl(): string | null {
  const url = process.env.NEON_AUTH_BASE_URL || process.env.NEXT_PUBLIC_NEON_AUTH_BASE_URL;
  if (!url) return null;
  return url.trim().replace(/\/$/, "");
}

function getAppOrigin(): string {
  return process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://localhost:3000";
}

export async function neonSignup(params: {
  email: string;
  password?: string;
  name?: string;
}): Promise<{ id?: string; email: string; error?: string }> {
  const base = getNeonAuthBaseUrl();
  if (!base) return { email: params.email, error: "Neon Auth is not configured." };

  try {
    const response = await fetch(`${base}/sign-up/email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: getAppOrigin(),
      },
      body: JSON.stringify({
        email: params.email,
        password: params.password || "TempPass123!Secure",
        name: params.name || params.email.split("@")[0],
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        email: params.email,
        error: data.message || data.error_description || "Registration failed.",
      };
    }

    return { id: data.user?.id, email: data.user?.email || params.email };
  } catch (err) {
    console.error("Neon signup error:", err);
    return { email: params.email, error: "Network error contacting Neon Auth." };
  }
}

export async function neonSendVerificationOtp(email: string): Promise<{ success: boolean; error?: string }> {
  const base = getNeonAuthBaseUrl();
  if (!base) return { success: false, error: "Neon Auth is not configured." };

  console.info(`🚀 [Neon Auth] Sending verification OTP to ${email} via auth@mail.myneon.app...`);

  try {
    const response = await fetch(`${base}/email-otp/send-verification-otp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: getAppOrigin(),
      },
      body: JSON.stringify({
        email,
        type: "email-verification",
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return { success: false, error: data.message || "Unable to send verification OTP." };
    }

    console.info(`✅ [Neon Auth] Verification OTP sent to ${email}! Check your inbox.`);
    return { success: true };
  } catch (err) {
    console.error("Neon send verification OTP error:", err);
    return { success: false, error: "Network error contacting Neon Auth." };
  }
}

export async function neonVerifyEmailOtp(params: {
  email: string;
  otp: string;
}): Promise<{ success: boolean; email?: string; error?: string }> {
  const base = getNeonAuthBaseUrl();
  if (!base) return { success: false, error: "Neon Auth is not configured." };

  try {
    const response = await fetch(`${base}/email-otp/verify-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: getAppOrigin(),
      },
      body: JSON.stringify({
        email: params.email,
        otp: params.otp,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.code === "INVALID_OTP") {
      return { success: false, error: data.message || "Invalid or expired OTP code." };
    }

    return { success: true, email: data.user?.email || params.email };
  } catch (err) {
    console.error("Neon verify OTP error:", err);
    return { success: false, error: "Network error contacting Neon Auth." };
  }
}

export async function neonSendPasswordResetOtp(email: string): Promise<{ success: boolean; error?: string }> {
  const base = getNeonAuthBaseUrl();
  if (!base) return { success: false, error: "Neon Auth is not configured." };

  console.info(`🚀 [Neon Auth] Sending password reset code to ${email} via auth@mail.myneon.app...`);

  try {
    const response = await fetch(`${base}/email-otp/send-verification-otp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: getAppOrigin(),
      },
      body: JSON.stringify({
        email,
        type: "forget-password",
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return { success: false, error: data.message || "Unable to send password reset code." };
    }

    console.info(`✅ [Neon Auth] Password reset code sent to ${email}! Check your inbox.`);
    return { success: true };
  } catch (err) {
    console.error("Neon password reset OTP error:", err);
    return { success: false, error: "Network error contacting Neon Auth." };
  }
}

export async function neonResetPasswordWithOtp(params: {
  email: string;
  otp: string;
  password: string;
}): Promise<{ success: boolean; error?: string }> {
  const base = getNeonAuthBaseUrl();
  if (!base) return { success: false, error: "Neon Auth is not configured." };

  try {
    const response = await fetch(`${base}/email-otp/reset-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: getAppOrigin(),
      },
      body: JSON.stringify({
        email: params.email,
        otp: params.otp,
        password: params.password,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.code === "INVALID_OTP") {
      return { success: false, error: data.message || "Invalid or expired reset code." };
    }

    return { success: true };
  } catch (err) {
    console.error("Neon reset password error:", err);
    return { success: false, error: "Network error contacting Neon Auth." };
  }
}

export async function neonTriggerEmailVerification(params: {
  email: string;
  password?: string;
  name?: string;
}): Promise<{ success: boolean; error?: string }> {
  const email = params.email.trim().toLowerCase();

  // 1. Try signup first: In Neon Auth, POST /sign-up/email creates the user and dispatches OTP
  const signupResult = await neonSignup({
    email,
    password: params.password,
    name: params.name,
  });

  if (!signupResult.error) {
    return { success: true };
  }

  // 2. If user already exists in Neon Auth, dispatch verification OTP
  return await neonSendVerificationOtp(email);
}
