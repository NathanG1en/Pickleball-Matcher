/**
 * Headless Netlify Identity (GoTrue API) client.
 * Handles user signup, authentication, password recovery, and OAuth redirects
 * without using the Netlify Identity modal popup.
 */

export function getNetlifyIdentityUrl(): string | null {
  const url =
    process.env.NETLIFY_IDENTITY_URL ||
    process.env.NEXT_PUBLIC_NETLIFY_IDENTITY_URL ||
    (process.env.URL ? `${process.env.URL}/.netlify/identity` : null);
  if (!url) return null;
  return url.replace(/\/$/, "");
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
}): Promise<{ id?: string; email: string; error?: string }> {
  const base = getNetlifyIdentityUrl();
  if (!base) return { email: params.email };

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
      return {
        email: params.email,
        error: data.msg || data.error_description || "Netlify registration failed.",
      };
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

export async function netlifyRecover(email: string): Promise<{ success: boolean; error?: string }> {
  const base = getNetlifyIdentityUrl();
  if (!base) return { success: false, error: "Netlify Identity is not configured." };

  try {
    const response = await fetch(`${base}/recover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return {
        success: false,
        error: data.msg || data.error_description || "Unable to send recovery email.",
      };
    }

    return { success: true };
  } catch (err) {
    console.error("Netlify recover error:", err);
    return { success: false, error: "Network error contacting Netlify Identity." };
  }
}

export async function netlifyResetPassword(params: {
  token: string;
  password: string;
}): Promise<{ success: boolean; error?: string }> {
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

    return { success: true };
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

