"use client";

import { useState } from "react";
import Link from "next/link";
import { resendVerificationEmailAction, verifyEmailAction } from "@/app/actions/player-account";
import { Alert, Button, FormField, Input, OtpInput } from "@/components/ui";

export function VerifyEmailView({
  token,
  email,
  canResend = false,
}: {
  token?: string;
  email?: string;
  /** True when a player is signed in, so a fresh code can be sent to their recovery email. */
  canResend?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">("idle");

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

  const handleResend = async () => {
    setResendState("sending");
    setError(null);
    const result = await resendVerificationEmailAction();
    if (result.ok) {
      setManualCode("");
      setResendState("sent");
      return;
    }
    setResendState("idle");
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
    <div className="space-y-5">
      <p className="text-sm font-bold text-neutral-700">
        {email ? (
          <>
            We sent a 6-digit code to
            <span className="block font-black text-black [overflow-wrap:anywhere]">{email}</span>
          </>
        ) : (
          "Enter the 6-digit code from your verification email."
        )}
      </p>

      {error && (
        <Alert variant="danger" size="md" className="text-left">
          {error}
        </Alert>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleVerify(manualCode, manualEmail);
        }}
        className="space-y-4"
      >
        <OtpInput
          id="verify-email-otp"
          value={manualCode}
          onChange={setManualCode}
          onComplete={(code) => handleVerify(code, manualEmail)}
          autoFocus
          disabled={pending}
        />

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
          className="min-h-11 w-full font-display uppercase font-black"
        >
          {pending ? "Verifying…" : "Verify Code"}
        </Button>
      </form>

      <div className="space-y-1 text-sm font-bold text-neutral-700">
        {canResend && (
          <p aria-live="polite">
            {resendState === "sent" ? (
              <span data-testid="verify-email-resent">New code sent. Check your inbox.</span>
            ) : (
              <>
                Didn&apos;t get it?{" "}
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendState === "sending"}
                  data-testid="verify-email-resend"
                  className="inline-flex min-h-11 items-center font-black text-black underline decoration-2 underline-offset-4 hover:decoration-[#ccff00] disabled:opacity-60"
                >
                  {resendState === "sending" ? "Sending…" : "Send a new code"}
                </button>
              </>
            )}
          </p>
        )}
        <Link
          href="/players"
          className="inline-flex min-h-11 items-center font-black text-black underline decoration-2 underline-offset-4 hover:decoration-[#ccff00]"
        >
          Go to Profile →
        </Link>
      </div>
    </div>
  );
}
