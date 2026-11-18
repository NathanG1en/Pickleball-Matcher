"use client";

import { useState } from "react";
import Link from "next/link";
import { verifyEmailAction } from "@/app/actions/player-account";
import { Alert, Button, FormField, Input } from "@/components/ui";

export function VerifyEmailView({ token, email }: { token?: string; email?: string }) {
  const [pending, setPending] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [manualEmail, setManualEmail] = useState(email || "");

  const handleVerify = async (tokenToUse?: string, emailToUse?: string) => {
    setPending(true);
    setError(null);
    const effectiveToken = (tokenToUse || token || manualCode || "").trim();
    const effectiveEmail = (emailToUse || manualEmail || email || "").trim();
    const result = await verifyEmailAction({
      token: effectiveToken,
      ...(effectiveEmail ? { email: effectiveEmail } : {}),
    });
    setPending(false);

    if (result.ok) {
      setVerifiedEmail(result.data.email);
      return;
    }

    setError(result.error);
  };

  if (verifiedEmail) {
    return (
      <div className="space-y-4 text-left">
        <div
          role="status"
          className="rounded-xl border-2 border-black bg-[#ccff00] p-3 text-xs font-black uppercase text-black shadow-[2px_2px_0px_0px_#000]"
        >
          {verifiedEmail} has been verified successfully!
        </div>
        <p className="text-xs font-bold text-neutral-700">
          Your email address has been confirmed and can now be used for account recovery.
        </p>
        <div className="pt-2 text-center">
          <Link
            href="/players"
            className="inline-block rounded-xl border-2 border-black bg-[#ccff00] px-4 py-2 font-display text-sm font-black uppercase text-black shadow-[3px_3px_0px_0px_#000] hover:bg-[#b8e600]"
          >
            Go to Profile →
          </Link>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="space-y-4 text-left">
        {!email ? (
          <div
            role="alert"
            className="rounded-xl border-2 border-red-500 bg-red-100 p-3 text-xs font-bold text-red-900"
          >
            Missing verification token. Please check your verification link.
          </div>
        ) : (
          <div
            role="status"
            className="rounded-xl border-2 border-black bg-neutral-100 p-3 text-xs font-bold text-neutral-800 shadow-[2px_2px_0px_0px_#000]"
          >
            Enter the 6-digit verification code sent to{" "}
            <span className="font-black text-black">{email}</span>.
          </div>
        )}

        {error && (
          <Alert variant="danger" size="md">
            {error}
          </Alert>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleVerify(manualCode, manualEmail);
          }}
          className="rounded-2xl border-2 border-black bg-white p-4 space-y-3 shadow-[3px_3px_0px_0px_#000]"
        >
          <p className="text-xs font-black uppercase tracking-wider text-neutral-800">
            Have a 6-digit code?
          </p>
          <FormField id="verify-email-otp" label="Verification Code">
            <Input
              id="verify-email-otp"
              required
              maxLength={8}
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value.trim())}
              placeholder="e.g. 123456"
              className="text-center font-mono text-lg tracking-widest uppercase font-bold"
            />
          </FormField>
          {!email && (
            <FormField id="verify-email-address" label="Email Address">
              <Input
                id="verify-email-address"
                type="email"
                required
                value={manualEmail}
                onChange={(e) => setManualEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </FormField>
          )}
          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={pending || !manualCode.trim()}
            className="w-full font-display uppercase font-black"
          >
            {pending ? "Verifying…" : "Verify Code"}
          </Button>
        </form>

        <div className="pt-2 text-center">
          <Link
            href="/players"
            className="inline-block rounded-xl border-2 border-black bg-[#FFFDF7] px-4 py-2 font-display text-sm font-black uppercase text-black hover:bg-neutral-100"
          >
            Go to Profile →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-center">
      {error && (
        <div
          role="alert"
          className="rounded-xl border-2 border-red-500 bg-red-100 p-3 text-xs font-bold text-red-900 text-left"
        >
          {error}
        </div>
      )}

      <p className="text-xs font-bold text-neutral-700">
        Click the button below to complete verification of your new email address.
      </p>

      <button
        type="button"
        disabled={pending}
        onClick={() => handleVerify(token, email)}
        data-testid="confirm-verify-email-button"
        className="w-full rounded-xl border-2 border-black bg-[#ccff00] px-4 py-3 font-display text-base font-black uppercase text-black shadow-[3px_3px_0px_0px_#000] hover:bg-[#b8eb00] active:translate-x-0.5 active:translate-y-0.5 cursor-pointer disabled:opacity-60"
      >
        {pending ? "Verifying…" : "Confirm Verification"}
      </button>
    </div>
  );
}

