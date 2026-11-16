"use client";

import { useState } from "react";
import Link from "next/link";
import { verifyEmailAction } from "@/app/actions/player-account";
import { Alert, Button } from "@/components/ui";

export function VerifyEmailView({ token }: { token?: string }) {
  const [pending, setPending] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!token) {
    return (
      <div className="space-y-4 text-left">
        <Alert variant="danger" size="md">
          Missing verification token. Please check the link or request a new one.
        </Alert>
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
        <Alert variant="success" size="md">
          {verifiedEmail} has been verified successfully!
        </Alert>
        <p className="text-sm font-medium text-neutral-700">
          Your account is now protected with recovery. You can reset your password anytime using this email.
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
        <Alert variant="danger" size="md">
          {error}
        </Alert>
      )}

      <p className="text-sm font-medium text-neutral-700">
        Click the button below to confirm your recovery email address.
      </p>

      <Button
        type="button"
        variant="primary"
        size="lg"
        disabled={pending}
        onClick={handleVerify}
        className="w-full font-display text-lg uppercase"
      >
        {pending ? "Verifying…" : "Confirm Verification"}
      </Button>
    </div>
  );
}

