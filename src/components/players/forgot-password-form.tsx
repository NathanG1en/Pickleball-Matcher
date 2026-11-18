"use client";

import { useState } from "react";
import Link from "next/link";
import { requestPasswordResetAction } from "@/app/actions/player-account";
import { Alert, Button, FormField, Input } from "@/components/ui";

export function ForgotPasswordForm() {
  const [identifier, setIdentifier] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState("");

  const [localDevUrl, setLocalDevUrl] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);

    const result = await requestPasswordResetAction({ identifier });
    setPending(false);

    if (result.ok) {
      setSubmitted(true);
      setMessage(result.data.message);
      setLocalDevUrl(result.data.localDevUrl ?? null);
      return;
    }

    setError(result.error);
  };

  if (submitted) {
    return (
      <div className="space-y-4 text-left">
        <Alert variant="success" size="md">
          {message}
        </Alert>
        {localDevUrl && (
          <div className="rounded-xl border-2 border-black bg-[#ccff00] p-3 text-xs font-bold text-black shadow-[2px_2px_0px_0px_#000]">
            <p className="font-black uppercase tracking-wider text-[11px]">Local Development Link:</p>
            <Link
              href={localDevUrl}
              className="mt-1 inline-block underline font-black text-black break-all"
            >
              Click here to reset your password →
            </Link>
          </div>
        )}
        <p className="text-sm font-medium text-neutral-700">
          Be sure to check your spam folder if you don&apos;t see the email within a couple of minutes.
        </p>
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
          <Link
            href={`/reset-password${identifier.includes("@") ? `?email=${encodeURIComponent(identifier)}` : ""}`}
            className="w-full sm:w-auto text-center rounded-xl border-2 border-black bg-[#ccff00] px-4 py-2 font-display text-sm font-black uppercase text-black shadow-[3px_3px_0px_0px_#000] hover:bg-[#b8e600]"
          >
            Enter Reset Code →
          </Link>
          <Link
            href="/player-login"
            className="w-full sm:w-auto text-center rounded-xl border-2 border-black bg-white px-4 py-2 font-display text-sm font-black uppercase text-black hover:bg-neutral-100"
          >
            Back to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 text-left">
      {error && (
        <Alert variant="danger" size="md" className="text-center">
          {error}
        </Alert>
      )}

      <FormField
        id="forgot-password-identifier"
        label="Username or Email"
        hint="Enter the username or email linked to your account."
      >
        <Input
          id="forgot-password-identifier"
          required
          autoComplete="username"
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          placeholder="e.g. rally_champ or you@example.com"
        />
      </FormField>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        disabled={pending || !identifier.trim()}
        className="w-full font-display text-lg uppercase"
      >
        {pending ? "Sending Link…" : "Send Reset Link"}
      </Button>

      <div className="pt-2 text-center">
        <Link
          href="/player-login"
          className="text-xs font-bold text-neutral-600 hover:text-black hover:underline"
        >
          ← Back to Sign In
        </Link>
      </div>
    </form>
  );
}

