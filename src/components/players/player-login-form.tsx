"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { playerLoginAction } from "@/app/actions/player-account";
import {
  Alert,
  Button,
  FormField,
  Input,
  VisibilityToggle,
} from "@/components/ui";

export function PlayerLoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await playerLoginAction({ username, password });
    if (result.ok) {
      router.push(getReturnPath() ?? "/players");
      router.refresh();
      return;
    }
    setError(result.error);
    setPending(false);
  };

  return (
    <form onSubmit={submit} className="space-y-4 text-left">
      {error && (
        <Alert variant="danger" size="md" className="text-center">
          {error}
        </Alert>
      )}

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
