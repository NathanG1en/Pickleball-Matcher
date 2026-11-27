"use client";

import { useState } from "react";
import Link from "next/link";
import {
  resendVerificationEmailAction,
  updatePlayerEmailAction,
} from "@/app/actions/player-account";
import { Button, FormField, Input } from "@/components/ui";
import { MailIcon, MailWarningIcon } from "@/components/ui/icons";

export interface RecoveryEmailBannerProps {
  currentEmail?: string | null;
  isVerified?: boolean;
  className?: string;
}

const linkButtonClass =
  "inline-flex min-h-11 items-center font-black text-black underline decoration-2 underline-offset-4 hover:decoration-[#ccff00] disabled:opacity-60";

const actionButtonClass =
  "inline-flex min-h-11 shrink-0 items-center rounded-xl border-2 border-black bg-[#ccff00] px-4 text-sm font-bold text-black shadow-[2px_2px_0px_0px_#000] transition-transform hover:-translate-y-0.5 active:translate-y-0.5";

/**
 * One compact strip. Desktop: icon, title and detail, small links under them, the action on the
 * right. Phone: icon beside the title and detail, then one row with the links and the action, so
 * a long email never gets squeezed next to the button.
 */
function Strip({
  icon,
  tone,
  title,
  detail,
  links,
  action,
  children,
  className,
}: {
  icon: React.ReactNode;
  tone: "attention" | "neutral";
  title: string;
  detail: React.ReactNode;
  links: React.ReactNode;
  action: React.ReactNode;
  children?: React.ReactNode;
  className: string;
}) {
  return (
    <section
      aria-labelledby="recovery-email-heading"
      data-testid="recovery-email-banner"
      className={`rounded-2xl border-[3px] border-black p-3 text-left shadow-[4px_4px_0px_0px_#000] sm:p-4 ${
        tone === "attention" ? "bg-[#FFF9E6]" : "bg-[#FFFDF7]"
      } ${className}`}
    >
      <div className="grid grid-cols-[2.75rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1 sm:grid-cols-[2.75rem_minmax(0,1fr)_auto] sm:gap-x-4">
        <span
          aria-hidden="true"
          className={`flex h-11 w-11 items-center justify-center rounded-xl border-2 border-black text-black sm:row-span-2 ${
            tone === "attention" ? "bg-[#fde047]" : "bg-[#ccff00]"
          }`}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <h2 id="recovery-email-heading" className="font-display text-base font-black uppercase leading-tight text-black sm:text-lg">
            {title}
          </h2>
          <p className="text-sm font-bold text-neutral-700 [overflow-wrap:anywhere]">{detail}</p>
        </div>
        {/* On a phone this is its own row under the icon and text; from sm up its two children
            join the grid: the links under the text, the action in the right-hand column. */}
        <div className="col-span-2 flex items-center justify-between gap-3 sm:contents">
          <div className="flex flex-wrap items-center gap-x-2 text-sm font-bold text-neutral-700 sm:col-start-2 sm:row-start-2 sm:-mt-2">
            {links}
          </div>
          <div className="sm:col-start-3 sm:row-span-2 sm:row-start-1">{action}</div>
        </div>
      </div>
      {children}
    </section>
  );
}

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
        <Button type="submit" variant="primary" size="sm" disabled={pending !== null || !emailInput.trim()} className="min-h-11">
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
      <Strip
        tone="attention"
        icon={<MailWarningIcon className="h-5 w-5" />}
        title="Recovery email not verified"
        detail={currentEmail}
        className={className}
        links={
          isEditing ? null : (
            <p aria-live="polite" className="flex items-center gap-x-2">
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
          )
        }
        action={
          isEditing ? null : (
            <Link
              href={`/verify-email?email=${encodeURIComponent(currentEmail)}`}
              data-testid="recovery-email-enter-code"
              className={actionButtonClass}
            >
              Enter code →
            </Link>
          )
        }
      >
        {isEditing && emailForm("New recovery email", "Send code")}
        {errorLine}
      </Strip>
    );
  }

  // No recovery email yet.
  return (
    <Strip
      tone="neutral"
      icon={<MailIcon className="h-5 w-5" />}
      title="Add a recovery email"
      detail="So you can reset your password if you forget it."
      className={className}
      links={
        isEditing ? null : (
          <button type="button" onClick={() => setDismissed(true)} className={linkButtonClass}>
            Not now
          </button>
        )
      }
      action={
        isEditing ? null : (
          <button type="button" onClick={() => setIsEditing(true)} className={actionButtonClass}>
            Add email →
          </button>
        )
      }
    >
      {isEditing && emailForm("Recovery email", "Send code")}
      {errorLine}
    </Strip>
  );
}
