"use client";

import { useEffect } from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { loginWithNetlifyIdentityAction } from "@/app/actions/player-account";

declare global {
  interface Window {
    netlifyIdentity?: {
      init: (options?: { APIUrl?: string }) => void;
      open: (tab?: "login" | "signup") => void;
      close: () => void;
      currentUser: () => NetlifyIdentityUser | null;
      on: (event: string, callback: (...args: unknown[]) => void) => void;
      off: (event: string, callback?: (...args: unknown[]) => void) => void;
      logout: () => void;
    };
  }
}

export interface NetlifyIdentityUser {
  id: string;
  email: string;
  user_metadata?: {
    full_name?: string;
    name?: string;
  };
  token?: {
    access_token?: string;
  };
}

export function openNetlifyIdentity(tab?: "login" | "signup") {
  if (typeof window !== "undefined" && window.netlifyIdentity) {
    window.netlifyIdentity.open(tab);
  }
}

export function logoutNetlifyIdentity() {
  if (typeof window !== "undefined" && window.netlifyIdentity) {
    window.netlifyIdentity.logout();
  }
}

export function NetlifyIdentityInitializer() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const setup = () => {
      if (!window.netlifyIdentity) return;
      const apiUrl = process.env.NEXT_PUBLIC_NETLIFY_IDENTITY_URL;
      window.netlifyIdentity.init(apiUrl ? { APIUrl: apiUrl } : {});

      const handleLogin = async (user: NetlifyIdentityUser) => {
        if (!user || !user.email) return;
        try {
          const result = await loginWithNetlifyIdentityAction({
            id: user.id,
            email: user.email,
            name: user.user_metadata?.full_name || user.user_metadata?.name || user.email.split("@")[0],
            token: user.token?.access_token,
          });
          if (result.ok) {
            window.netlifyIdentity?.close();
            const next = new URLSearchParams(window.location.search).get("next");
            if (next && next.startsWith("/") && !next.startsWith("//")) {
              router.push(next);
            } else {
              router.refresh();
            }
          }
        } catch (err) {
          console.error("Failed to link Netlify Identity session", err);
        }
      };

      window.netlifyIdentity.on("login", handleLogin);
    };

    if (window.netlifyIdentity) {
      setup();
    }
  }, [router]);

  return (
    <Script
      src="https://identity.netlify.com/v1/netlify-identity-widget.js"
      strategy="afterInteractive"
      onLoad={() => {
        if (typeof window !== "undefined" && window.netlifyIdentity) {
          const apiUrl = process.env.NEXT_PUBLIC_NETLIFY_IDENTITY_URL;
          window.netlifyIdentity.init(apiUrl ? { APIUrl: apiUrl } : {});
        }
      }}
    />
  );
}

