"use client";

import { useState } from "react";
import Link from "next/link";
import { verifyEmailAction } from "@/app/actions/player-account";
import { Alert, Button, FormField, Input, OtpInput } from "@/components/ui";

export function VerifyEmailView({
  token,
  email,
}: {
  token?: string;
  email?: string;
}) {
  const [pending, setPending] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // If a 6-digit code was provided in token, pre-fill it
  const initialCode = token && /^\d{6}$/.test(token.trim()) ? token.trim() : "";
  const [manualCode, setManualCode] = useState(initialCode);
  const [manualEmail, setManualEmail] = useState(email || "");

  const handleVerify = async (codeToUse?: string, emailToUse?: string) => {
    const effectiveCode = (codeToUse || manualCode || "").trim();
    const effectiveEmail = (emailToUse || manualEmail || email || "").trim();

    if (effectiveCode.length !== 6) {
      setError("Please enter the complete 6-digit verification code.");
      return;
    }

    setPending(true);
    setError(null);
    const result = await verifyEmailAction({
      token: effectiveCode,
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

  return (
    <div className="space-y-4 text-left">
      {email && (
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
        className="rounded-2xl border-2 border-black bg-white p-4 sm:p-5 space-y-4 shadow-[3px_3px_0px_0px_#000] text-center"
      >
        <div className="text-left sm:text-center">
          <p className="text-xs font-black uppercase tracking-wider text-neutral-800">
            Enter your 6-digit verification code.
          </p>
        </div>

        <div className="flex justify-center my-2">
          <OtpInput
            id="verify-email-otp"
            value={manualCode}
            onChange={setManualCode}
            onComplete={(code) => handleVerify(code, manualEmail)}
            autoFocus
            disabled={pending}
          />
        </div>

        {!email && (
          <div className="text-left">
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
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          size="md"
          disabled={pending || manualCode.trim().length !== 6}
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
