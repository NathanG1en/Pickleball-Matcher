"use client";

import { useState } from "react";
import Link from "next/link";
import {
  resendVerificationEmailAction,
  updatePlayerEmailAction,
} from "@/app/actions/player-account";
import { Button, FormField, Input } from "@/components/ui";

export interface RecoveryEmailBannerProps {
  currentEmail?: string | null;
  isVerified?: boolean;
  className?: string;
}

const linkButtonClass =
  "inline-flex min-h-11 items-center font-black text-black underline decoration-2 underline-offset-4 hover:decoration-[#ccff00] disabled:opacity-60";

/** A short nudge on Home and the profile: add a recovery email, or verify the one you added. */
export function RecoveryEmailBanner({
  currentEmail: initialEmail,
  isVerified: initialVerified = false,
  className = "",
}: RecoveryEmailBannerProps) {
  const [currentEmail, setCurrentEmail] = useState(initialEmail);
  const [isVerified, setIsVerified] = useState(initialVerified);
  const [isEditing, setIsEditing] = useState(false);
  const [emailInput, setEmailInput] = useState(initialEmail ?? "");
  const [pending, setPending] = useState<"save" | "resend" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || (currentEmail && isVerified)) return null;

  const handleSaveEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!emailInput.trim()) return;
    setPending("save");
    setError(null);
    const result = await updatePlayerEmailAction({ email: emailInput.trim() });
    setPending(null);
    if (result.ok) {
      // The banner itself now says where the code went, so no separate success message.
      setCurrentEmail(result.data.email);
      setIsVerified(false);
      setIsEditing(false);
      setResent(false);
      return;
    }
    setError(result.error);
  };

  const handleResend = async () => {
    setPending("resend");
    setError(null);
    const result = await resendVerificationEmailAction();
    setPending(null);
    if (result.ok) setResent(true);
    else setError(result.error);
  };

  const emailForm = (label: string, submitLabel: string) => (
    <form onSubmit={handleSaveEmail} className="mt-3 space-y-3">
      <FormField id="recovery-email-input" label={label}>
        <Input
          id="recovery-email-input"
          type="email"
          autoComplete="email"
          required
          autoFocus
          value={emailInput}
          onChange={(e) => setEmailInput(e.target.value)}
          placeholder="you@example.com"
        />
      </FormField>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" size="sm" disabled={pending !== null || !emailInput.trim()} className="min-h-11 font-display uppercase">
          {pending === "save" ? "Sending…" : submitLabel}
        </Button>
        <button type="button" onClick={() => setIsEditing(false)} className={`${linkButtonClass} text-sm`}>
          Cancel
        </button>
      </div>
    </form>
  );

  const errorLine = error && (
    <p role="alert" className="mt-2 text-sm font-bold text-[#b91c1c]">
      {error}
    </p>
  );

  // An email was added but not verified yet.
  if (currentEmail) {
    return (
      <section
        aria-labelledby="recovery-email-heading"
        data-testid="recovery-email-banner"
        className={`rounded-2xl border-[3px] border-black bg-[#FFF9E6] p-4 text-left shadow-[4px_4px_0px_0px_#000] sm:p-5 ${className}`}
      >
        <h2 id="recovery-email-heading" className="font-display text-lg font-black uppercase text-black">
          Recovery email not verified
        </h2>
        <p className="mt-1 text-sm font-bold text-neutral-700">
          Check <span className="font-black text-black [overflow-wrap:anywhere]">{currentEmail}</span> for your 6&#8209;digit
          verification code.
        </p>

        {isEditing ? (
          emailForm("New recovery email", "Send code")
        ) : (
          <>
            <Link
              href={`/verify-email?email=${encodeURIComponent(currentEmail)}`}
              data-testid="recovery-email-enter-code"
              className="mt-3 inline-flex min-h-11 items-center rounded-xl border-2 border-black bg-[#ccff00] px-4 font-display text-sm font-black uppercase text-black shadow-[3px_3px_0px_0px_#000] transition-transform hover:-translate-y-0.5 active:translate-y-0.5"
            >
              Enter code →
            </Link>
            <p aria-live="polite" className="mt-1 flex flex-wrap items-center gap-x-2 text-sm font-bold text-neutral-700">
              {resent ? (
                <span data-testid="recovery-email-resent" className="inline-flex min-h-11 items-center">New code sent.</span>
              ) : (
                <button type="button" onClick={handleResend} disabled={pending !== null} className={linkButtonClass}>
                  {pending === "resend" ? "Sending…" : "Resend code"}
                </button>
              )}
              <span aria-hidden="true">·</span>
              <button type="button" onClick={() => setIsEditing(true)} className={linkButtonClass}>
                Change email
              </button>
            </p>
          </>
        )}
        {errorLine}
      </section>
    );
  }

  // No recovery email yet.
  return (
    <section
      aria-labelledby="recovery-email-heading"
      data-testid="recovery-email-banner"
      className={`rounded-2xl border-[3px] border-black bg-[#FFFDF7] p-4 text-left shadow-[4px_4px_0px_0px_#000] sm:p-5 ${className}`}
    >
      <h2 id="recovery-email-heading" className="font-display text-lg font-black uppercase text-black">
        Add a recovery email
      </h2>
      <p className="mt-1 text-sm font-bold text-neutral-700">So you can reset your password if you forget it.</p>

      {isEditing ? (
        emailForm("Recovery email", "Send code")
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => setIsEditing(true)}
            className="min-h-11 font-display uppercase"
          >
            Add email →
          </Button>
          <button type="button" onClick={() => setDismissed(true)} className={`${linkButtonClass} text-sm`}>
            Not now
          </button>
        </div>
      )}
      {errorLine}
    </section>
  );
}
