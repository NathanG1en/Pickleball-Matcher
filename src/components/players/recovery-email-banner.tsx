"use client";

import { useState } from "react";
import Link from "next/link";
import {
  resendVerificationEmailAction,
  updatePlayerEmailAction,
} from "@/app/actions/player-account";
import { Alert, Button, FormField, Input } from "@/components/ui";

export interface RecoveryEmailBannerProps {
  currentEmail?: string | null;
  isVerified?: boolean;
  className?: string;
}

export function RecoveryEmailBanner({
  currentEmail: initialEmail,
  isVerified: initialVerified = false,
  className = "",
}: RecoveryEmailBannerProps) {
  const [currentEmail, setCurrentEmail] = useState(initialEmail);
  const [isVerified, setIsVerified] = useState(initialVerified);
  const [isOpen, setIsOpen] = useState(false);
  const [emailInput, setEmailInput] = useState(initialEmail ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [verificationToken, setVerificationToken] = useState<string | null>(null);

  // If dismissed or user has verified email and banner is not explicitly opened
  if (dismissed || (currentEmail && isVerified && !isOpen)) {
    return null;
  }

  const handleSaveEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!emailInput.trim()) return;

    setPending(true);
    setError(null);
    setSuccessMessage(null);
    setVerificationToken(null);

    const result = await updatePlayerEmailAction({ email: emailInput.trim() });
    setPending(false);

    if (result.ok) {
      setCurrentEmail(result.data.email);
      setIsVerified(false);
      if (result.data.verificationToken) {
        setVerificationToken(result.data.verificationToken);
      }
      setSuccessMessage(
        `Recovery email updated to ${result.data.email}. A verification link has been prepared!`,
      );
      return;
    }

    setError(result.error);
  };

  const handleResend = async () => {
    setPending(true);
    setError(null);
    setSuccessMessage(null);

    const result = await resendVerificationEmailAction();
    setPending(false);

    if (result.ok) {
      if (result.data.verificationToken) {
        setVerificationToken(result.data.verificationToken);
      }
      setSuccessMessage("A fresh verification link has been sent to your email.");
      return;
    }

    setError(result.error);
  };

  // Case 1: User has an unverified email
  if (currentEmail && !isVerified) {
    return (
      <div
        className={`rounded-2xl border-[3px] border-black bg-[#FFF9E6] p-4 text-left shadow-[4px_4px_0px_0px_#000] sm:p-5 ${className}`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
              <p className="text-xs font-black uppercase tracking-wider text-amber-900">
                Action Required · Recovery Email Unverified
              </p>
            </div>
            <p className="mt-1 text-sm font-bold text-neutral-800">
              Please check <span className="font-black text-black">{currentEmail}</span> and verify your email address to protect your account.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pending}
              onClick={handleResend}
              className="text-xs font-bold"
            >
              {pending ? "Sending…" : "Resend Link"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsOpen((prev) => !prev)}
              className="text-xs font-bold"
            >
              {isOpen ? "Close" : "Change Email"}
            </Button>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="text-xs font-bold text-neutral-500 hover:text-black underline px-1"
            >
              Dismiss
            </button>
          </div>
        </div>

        {successMessage && (
          <Alert variant="success" size="sm" className="mt-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span>{successMessage}</span>
              <Link
                href={`/verify-email?${verificationToken ? `token=${verificationToken}&` : ""}email=${encodeURIComponent(currentEmail ?? "")}`}
                className="font-black text-black underline underline-offset-2"
              >
                Verify Now →
              </Link>
            </div>
          </Alert>
        )}

        {error && (
          <Alert variant="danger" size="sm" className="mt-3">
            {error}
          </Alert>
        )}

        {isOpen && (
          <form onSubmit={handleSaveEmail} className="mt-4 pt-4 border-t-2 border-dashed border-neutral-300 space-y-3">
            <FormField id="change-recovery-email" label="Update Recovery Email">
              <Input
                id="change-recovery-email"
                type="email"
                required
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="new-email@example.com"
              />
            </FormField>
            <div className="flex items-center gap-2">
              <Button type="submit" variant="primary" size="sm" disabled={pending || !emailInput.trim()}>
                {pending ? "Saving…" : "Update & Verify"}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>
    );
  }

  // Case 2: User has NO recovery email
  return (
    <div
      className={`rounded-2xl border-[3px] border-black bg-[#FFFDF7] p-4 text-left shadow-[4px_4px_0px_0px_#000] sm:p-5 ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#ccff00] border-2 border-black text-xs font-black">
              !
            </span>
            <h3 className="font-display text-base font-black uppercase text-black">
              Add Account Recovery Email
            </h3>
          </div>
          <p className="text-xs font-bold text-neutral-700 max-w-xl">
            You don&apos;t have a recovery email attached yet. Add an email address so you can reset your password if you ever forget it, or sign in with your email.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!isOpen ? (
            <>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => setIsOpen(true)}
                className="font-display text-xs uppercase"
              >
                Add Email
              </Button>
              <button
                type="button"
                onClick={() => setDismissed(true)}
                className="text-xs font-bold text-neutral-500 hover:text-black underline px-2 py-1"
              >
                Remind me later
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-xs font-bold text-neutral-500 hover:text-black underline"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {successMessage && (
        <Alert variant="success" size="sm" className="mt-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span>{successMessage}</span>
            <Link
              href={`/verify-email?${verificationToken ? `token=${verificationToken}&` : ""}email=${encodeURIComponent(currentEmail ?? "")}`}
              className="font-black text-black underline underline-offset-2"
            >
              Verify Now →
            </Link>
          </div>
        </Alert>
      )}

      {error && (
        <Alert variant="danger" size="sm" className="mt-3">
          {error}
        </Alert>
      )}

      {isOpen && (
        <form onSubmit={handleSaveEmail} className="mt-4 pt-4 border-t-2 border-dashed border-neutral-300 space-y-3">
          <FormField
            id="new-recovery-email"
            label="Recovery Email Address"
            hint="We'll send a verification link to confirm this email."
          >
            <Input
              id="new-recovery-email"
              type="email"
              required
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="you@example.com"
            />
          </FormField>
          <div className="flex items-center gap-2">
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={pending || !emailInput.trim()}
              className="font-display text-xs uppercase"
            >
              {pending ? "Saving…" : "Save & Verify"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
