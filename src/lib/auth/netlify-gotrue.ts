import { randomBytes } from "crypto";

/**
 * Headless Netlify Identity (GoTrue API) client.
 * Handles user signup, authentication, password recovery, and OAuth redirects
 * without using the Netlify Identity modal popup.
 */

export function isLiveNetlifyIdentityConfigured(): boolean {
  const url = process.env.NETLIFY_IDENTITY_URL || process.env.NEXT_PUBLIC_NETLIFY_IDENTITY_URL;
  return Boolean(url && !url.includes("localhost") && !url.includes("127.0.0.1"));
}

export function getNetlifyIdentityUrl(): string | null {
  let url =
    process.env.NETLIFY_IDENTITY_URL ||
    process.env.NEXT_PUBLIC_NETLIFY_IDENTITY_URL ||
    (process.env.URL ? `${process.env.URL}/.netlify/identity` : null);

  if (url) {
    url = url.trim().replace(/\/$/, "");
    if (!url.endsWith("/.netlify/identity")) {
      url = `${url}/.netlify/identity`;
    }
    return url;
  }

  // In local development server, route to the built-in Netlify Identity emulator
  if (process.env.NODE_ENV === "development") {
    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      "http://localhost:3000";
    return `${origin.replace(/\/$/, "")}/.netlify/identity`;
  }

  return null;
}

export function isNetlifyIdentityConfigured(): boolean {
  return Boolean(getNetlifyIdentityUrl());
}

export function getNetlifyOAuthAuthorizeUrl(provider = "google"): string | null {
  const base = getNetlifyIdentityUrl();
  if (!base) return null;
  return `${base}/authorize?provider=${provider}`;
}

export async function netlifySignup(params: {
  email: string;
  password: string;
  name?: string;
  username?: string;
}): Promise<{ id?: string; email: string; localDev?: boolean; error?: string }> {
  const base = getNetlifyIdentityUrl();
  if (!base) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`[Netlify Identity] Mock signup for ${params.email} (NETLIFY_IDENTITY_URL not configured).`);
      return { email: params.email, localDev: true };
    }
    return { email: params.email, error: "Netlify Identity not configured." };
  }

  const isLive = isLiveNetlifyIdentityConfigured();
  if (isLive) {
    console.info(`🚀 [Netlify Identity] Sending signup / verification email to ${params.email} via ${base}...`);
  }

  try {
    const response = await fetch(`${base}/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: params.email,
        password: params.password,
        data: {
          full_name: params.name,
          username: params.username,
        },
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (isLive) {
        console.warn(`⚠️ [Netlify Identity] Signup notice for ${params.email}:`, data.msg || data.error_description || response.statusText);
      }
      return {
        email: params.email,
        error: data.msg || data.error_description || "Netlify registration failed.",
      };
    }

    if (isLive) {
      console.info(`✅ [Netlify Identity] Verification email successfully sent to ${params.email}! Check your inbox.`);
    }

    return { id: data.id, email: data.email };
  } catch (err) {
    console.error("Netlify signup error:", err);
    return { email: params.email, error: "Network error contacting Netlify Identity." };
  }
}

export async function netlifyLogin(params: {
  email: string;
  password: string;
}): Promise<{ id?: string; email: string; token?: string; error?: string }> {
  const base = getNetlifyIdentityUrl();
  if (!base) return { email: params.email, error: "Netlify Identity not configured." };

  try {
    const body = new URLSearchParams({
      grant_type: "password",
      username: params.email,
      password: params.password,
    });

    const response = await fetch(`${base}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        email: params.email,
        error: data.error_description || data.msg || "Invalid credentials.",
      };
    }

    return {
      id: data.user?.id,
      email: data.user?.email || params.email,
      token: data.access_token,
    };
  } catch (err) {
    console.error("Netlify login error:", err);
    return { email: params.email, error: "Network error contacting Netlify Identity." };
  }
}

export async function netlifyRecover(email: string): Promise<{ success: boolean; localDev?: boolean; error?: string }> {
  const base = getNetlifyIdentityUrl();
  if (!base) {
    if (process.env.NODE_ENV !== "production") {
      const separator = "═".repeat(78);
      console.info(`\n${separator}`);
      console.info("📬 [NETLIFY IDENTITY - LOCAL DEVELOPMENT]");
      console.info(`   Password recovery requested for: ${email}`);
      console.info("   ℹ️  NETLIFY_IDENTITY_URL is not set in .env.local");
      console.info("   👉 To receive real emails from localhost, set this in your .env.local:");
      console.info("      NETLIFY_IDENTITY_URL=https://<your-site-name>.netlify.app/.netlify/identity");
      console.info(`${separator}\n`);
      return { success: true, localDev: true };
    }
    return { success: false, error: "Netlify Identity is not configured." };
  }

  const isLive = isLiveNetlifyIdentityConfigured();
  if (isLive) {
    console.info(`🚀 [Netlify Identity] Sending recovery email to ${email} via ${base}...`);
  }

  try {
    const response = await fetch(`${base}/recover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      if (isLive) {
        console.warn(`⚠️ [Netlify Identity] Recover notice for ${email}:`, data.msg || data.error_description || response.statusText);
      }
      return {
        success: false,
        error: data.msg || data.error_description || "Unable to send recovery email.",
      };
    }

    if (isLive) {
      console.info(`✅ [Netlify Identity] Recovery email successfully sent to ${email}! Check your inbox.`);
    }

    return { success: true };
  } catch (err) {
    console.error("Netlify recover error:", err);
    return { success: false, error: "Network error contacting Netlify Identity." };
  }
}

export async function netlifyTriggerEmailVerification(params: {
  email: string;
  password?: string;
  name?: string;
  username?: string;
}): Promise<{ success: boolean; error?: string }> {
  const email = params.email.trim().toLowerCase();

  // 1. Try signup first: In Netlify GoTrue, POST /signup creates the user and dispatches confirmation email
  const signupResult = await netlifySignup({
    email,
    password: params.password || randomBytes(16).toString("hex"),
    name: params.name,
    username: params.username,
  });

  if (!signupResult.error) {
    return { success: true };
  }

  // 2. If user already exists in Netlify Identity, trigger recovery email
  return await netlifyRecover(email);
}

export async function netlifyResetPassword(params: {
  token: string;
  password: string;
}): Promise<{ success: boolean; email?: string; error?: string }> {
  const base = getNetlifyIdentityUrl();
  if (!base) return { success: false, error: "Netlify Identity is not configured." };

  try {
    // 1. Verify recovery token to get access session
    const verifyRes = await fetch(`${base}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: params.token,
        type: "recovery",
      }),
    });

    const verifyData = await verifyRes.json().catch(() => ({}));
    if (!verifyRes.ok || !verifyData.access_token) {
      return {
        success: false,
        error: verifyData.msg || "This password reset link is invalid or has expired.",
      };
    }

    // 2. Update user's password using the access token
    const updateRes = await fetch(`${base}/user`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${verifyData.access_token}`,
      },
      body: JSON.stringify({
        password: params.password,
      }),
    });

    if (!updateRes.ok) {
      const updateData = await updateRes.json().catch(() => ({}));
      return {
        success: false,
        error: updateData.msg || "Unable to update password.",
      };
    }

    return { success: true, email: verifyData.user?.email };
  } catch (err) {
    console.error("Netlify password reset error:", err);
    return { success: false, error: "Network error contacting Netlify Identity." };
  }
}

export async function netlifyGetUser(token: string): Promise<{ id: string; email: string; name?: string } | null> {
  const base = getNetlifyIdentityUrl();
  if (!base) return null;

  try {
    const res = await fetch(`${base}/user`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      id: data.id,
      email: data.email,
      name: data.user_metadata?.full_name || data.user_metadata?.name,
    };
  } catch {
    return null;
  }
}

export async function netlifyVerifyEmailToken(token: string): Promise<{ success: boolean; email?: string; error?: string }> {
  const base = getNetlifyIdentityUrl();
  if (!base) return { success: false, error: "Netlify Identity is not configured." };

  const typesToTry = ["signup", "email_change", "recovery"] as const;
  for (const type of typesToTry) {
    try {
      const verifyRes = await fetch(`${base}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, type }),
      });
      const data = await verifyRes.json().catch(() => ({}));
      if (verifyRes.ok && (data.user?.email || data.email)) {
        return { success: true, email: data.user?.email || data.email };
      }
    } catch {
      // try next type
    }
  }

  return { success: false, error: "Invalid or expired verification link." };
}


