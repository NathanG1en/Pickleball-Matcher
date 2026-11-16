"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { playerLoginAction } from "@/app/actions/player-account";
import { GoogleAuthButton } from "@/components/players/google-auth-button";
import {
  Alert,
  Button,
  FormField,
  Input,
  VisibilityToggle,
} from "@/components/ui";

export function PlayerLoginForm({
  initialError,
  initialNext,
}: {
  initialError?: string;
  initialNext?: string;
} = {}) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [pending, setPending] = useState(false);
  const returnPath = initialNext ?? getReturnPath();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await playerLoginAction({ username, password });
    if (result.ok) {
      router.push(getReturnPath() ?? "/");
      router.refresh();
      return;
    }
    setError(result.error);
    setPending(false);
  };

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="danger" size="md" className="text-center">
          {error}
        </Alert>
      )}

      <GoogleAuthButton label="Continue with Google" next={returnPath} />

      <div className="flex items-center gap-3">
        <div className="h-0.5 flex-1 bg-black/15" />
        <span className="text-xs font-black uppercase tracking-wider text-neutral-500">or</span>
        <div className="h-0.5 flex-1 bg-black/15" />
      </div>

      <form onSubmit={submit} className="space-y-4 text-left">

      <FormField id="player-login-username" label="Username">
        <Input
          id="player-login-username"
          required
          autoComplete="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
        />
      </FormField>

      <FormField id="player-login-password" label="Password">
        <div className="relative">
          <Input
            id="player-login-password"
            required
            type={passwordVisible ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="pr-14"
          />
          <VisibilityToggle
            visible={passwordVisible}
            onToggle={() => setPasswordVisible((visible) => !visible)}
            label="password"
          />
        </div>
      </FormField>

      <div className="flex items-center justify-end -mt-2">
        <Link
          href="/forgot-password"
          className="text-xs font-bold text-neutral-600 hover:text-black hover:underline"
        >
          Forgot password?
        </Link>
      </div>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        disabled={pending || !username.trim() || !password}
        className="w-full font-display text-lg uppercase"
      >
        {pending ? "Signing in…" : "Sign In"}
      </Button>

      <p className="text-center text-sm font-bold text-neutral-700">
        New player?{" "}
        <Link
          href="/player-signup"
          onClick={(event) => {
            const next = getReturnPath();
            if (next) {
              event.preventDefault();
              router.push(`/player-signup?next=${encodeURIComponent(next)}`);
            }
          }}
          className="underline"
        >
          Create an account
        </Link>
      </p>
    </form>
    </div>
  );
}

function getReturnPath(): string | null {
  if (typeof window === "undefined") return null;
  const requested = new URLSearchParams(window.location.search).get("next");
  if (!requested) return null;
  if (requested.startsWith("/") && !requested.startsWith("//") && !requested.includes("\\")) {
    return requested;
  }
  return null;
}
