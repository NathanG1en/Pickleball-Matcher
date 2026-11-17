"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { loginWithNetlifyIdentityAction } from "@/app/actions/player-account";

export function NetlifyAuthListener() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const hash = window.location.hash;
    if (!hash || !hash.includes("=")) return;

    const params = new URLSearchParams(hash.replace(/^#/, ""));
    const accessToken = params.get("access_token");
    const recoveryToken = params.get("recovery_token");

    // 1. Intercept password recovery link from Netlify email
    if (recoveryToken) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      router.push(`/reset-password?token=${encodeURIComponent(recoveryToken)}`);
      return;
    }

    // 1b. Intercept email confirmation / verification link
    const confirmationToken = params.get("confirmation_token") || params.get("email_change_token");
    if (confirmationToken) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      router.push(`/verify-email?token=${encodeURIComponent(confirmationToken)}`);
      return;
    }

    // 2. Intercept Google OAuth access token from Netlify Identity
    if (accessToken) {
      try {
        const parts = accessToken.split(".");
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          const email = payload.email;
          const id = payload.sub;
          const name =
            payload.user_metadata?.full_name ||
            payload.user_metadata?.name ||
            (typeof email === "string" ? email.split("@")[0] : "Player");

          if (email && id) {
            loginWithNetlifyIdentityAction({
              id,
              email,
              name,
              token: accessToken,
            }).then((res) => {
              if (res.ok) {
                window.history.replaceState(null, "", window.location.pathname);
                const next = new URLSearchParams(window.location.search).get("next");
                if (next && next.startsWith("/") && !next.startsWith("//")) {
                  router.push(next);
                } else {
                  router.push("/players/groups");
                }
                router.refresh();
              }
            });
          }
        }
      } catch (err) {
        console.error("Failed to process Netlify Identity access token", err);
      }
    }
  }, [router]);

  return null;
}

