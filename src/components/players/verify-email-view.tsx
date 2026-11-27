"use client";

import { useState } from "react";
import Link from "next/link";
import { resendVerificationEmailAction, verifyEmailAction } from "@/app/actions/player-account";
import { Alert, Button, FormField, Input, OtpInput, isCompleteOtp } from "@/components/ui";

const headingClass = "mb-2 px-8 font-display text-2xl sm:text-3xl font-black uppercase text-black";

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
  const [shakeSignal, setShakeSignal] = useState(0);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">("idle");

  // If a 6-digit code was provided in token, pre-fill it
  const initialCode = token && /^\d{6}$/.test(token.trim()) ? token.trim() : "";
  const [manualCode, setManualCode] = useState(initialCode);
  const [manualEmail, setManualEmail] = useState(email || "");

  const fail = (message: string) => {
    setError(message);
    setShakeSignal((count) => count + 1);
  };

  const handleVerify = async (codeToUse?: string, emailToUse?: string) => {
    const effectiveCode = (codeToUse || manualCode || "").trim();
    const effectiveEmail = (emailToUse || manualEmail || email || "").trim();

    if (!isCompleteOtp(effectiveCode)) {
      fail("Fill in all 6 digits of the code.");
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

    fail(result.error);
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
      <div className="space-y-4">
        <div
          aria-hidden="true"
          className="verify-success-badge mx-auto flex h-16 w-16 items-center justify-center rounded-full border-[3px] border-black bg-[#ccff00] text-3xl font-black text-black shadow-[3px_3px_0px_0px_#000]"
        >
          ✓
        </div>
        <div role="status">
          <h1 className={headingClass}>Email verified!</h1>
          <p className="text-sm font-bold text-neutral-700">
            <span className="font-black text-black [overflow-wrap:anywhere]">{verifiedEmail}</span> can now get you back into your account.
          </p>
        </div>
        <Link
          href="/players"
          className="inline-flex min-h-11 items-center rounded-xl border-2 border-black bg-[#ccff00] px-5 text-sm font-bold text-black shadow-[3px_3px_0px_0px_#000] transition-transform hover:-translate-y-0.5 active:translate-y-0.5"
        >
          Go to Profile →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className={headingClass}>Verify Email</h1>
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
      </div>

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
          onChange={(next) => {
            setManualCode(next);
            if (error) setError(null);
          }}
          onComplete={(code) => handleVerify(code, manualEmail)}
          autoFocus
          disabled={pending}
          status={pending ? "checking" : "idle"}
          shakeSignal={shakeSignal}
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
          disabled={pending || !isCompleteOtp(manualCode)}
          className="min-h-11 w-full font-bold"
        >
          {pending ? "Checking…" : "Verify Code"}
        </Button>
      </form>

      {canResend && (
        <p aria-live="polite" className="text-sm font-bold text-neutral-700">
          {resendState === "sent" ? (
            <span data-testid="verify-email-resent">Fresh code on its way. Check your inbox.</span>
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
    </div>
  );
}
