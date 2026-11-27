"use client";

import { useState } from "react";
import { neonAuthClient } from "@/lib/auth/neon-client";

interface GoogleAuthButtonProps {
  label?: string;
  next?: string | null;
  className?: string;
}

/**
 * Starts Google sign-in through Neon Auth. The SDK posts to `/api/auth/sign-in/social` (proxied to
 * Neon Auth, which sets the sign-in challenge cookie) and then sends the browser to Google. Google
 * returns to `/auth/google/complete`, which signs the player in.
 */
export function GoogleAuthButton({
  label = "Continue with Google",
  next,
  className = "",
}: GoogleAuthButtonProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startGoogleSignIn = async () => {
    setPending(true);
    setError(null);
    const origin = window.location.origin;
    const query = next ? `?next=${encodeURIComponent(next)}` : "";
    const loginWithError = new URL("/player-login", origin);
    if (next) loginWithError.searchParams.set("next", next);
    loginWithError.searchParams.set("error", "Google sign-in was cancelled or failed. Please try again.");
    try {
      const result = await neonAuthClient.signIn.social({
        provider: "google",
        callbackURL: `${origin}/auth/google/complete${query}`,
        errorCallbackURL: loginWithError.toString(),
      });
      if (result?.error) throw new Error(result.error.message ?? "Google sign-in is unavailable.");
      // On success the SDK is already navigating to Google; keep the button busy until it leaves.
    } catch (err) {
      console.error("Google sign-in could not start", err);
      setError("Google sign-in is unavailable right now. Use your username and password instead.");
      setPending(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={startGoogleSignIn}
        disabled={pending}
        data-testid="google-sign-in-button"
        className={`flex min-h-11 w-full items-center justify-center gap-3 rounded-2xl border-2 border-black bg-white px-4 py-3 text-sm font-bold text-black shadow-[3px_3px_0px_0px_#000] hover:bg-neutral-100 hover:shadow-[4px_4px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all disabled:cursor-wait disabled:opacity-70 ${className}`}
      >
        <GoogleIcon className="h-5 w-5 shrink-0" />
        <span>{pending ? "Opening Google…" : label}</span>
      </button>
      {error && (
        <p role="alert" className="text-center text-sm font-bold text-[#b91c1c]">
          {error}
        </p>
      )}
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

