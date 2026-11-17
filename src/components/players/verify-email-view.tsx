"use client";

import { useState } from "react";
import Link from "next/link";
import { verifyEmailAction } from "@/app/actions/player-account";

export function VerifyEmailView({ token }: { token?: string }) {
  const [pending, setPending] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!token) {
    return (
      <div className="space-y-4 text-left">
        <div
          role="alert"
          className="rounded-xl border-2 border-red-500 bg-red-100 p-3 text-xs font-bold text-red-900"
        >
          Missing verification token. Please check your verification link.
        </div>
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

  const handleVerify = async () => {
    setPending(true);
    setError(null);
    const result = await verifyEmailAction({ token });
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
        onClick={handleVerify}
        data-testid="confirm-verify-email-button"
        className="w-full rounded-xl border-2 border-black bg-[#ccff00] px-4 py-3 font-display text-base font-black uppercase text-black shadow-[3px_3px_0px_0px_#000] hover:bg-[#b8eb00] active:translate-x-0.5 active:translate-y-0.5 cursor-pointer disabled:opacity-60"
      >
        {pending ? "Verifying…" : "Confirm Verification"}
      </button>
    </div>
  );
}

