"use client";

import { useState } from "react";
import Link from "next/link";
import { resetPasswordAction } from "@/app/actions/player-account";
import { Alert, Button, FormField, Input, VisibilityToggle } from "@/components/ui";

export function ResetPasswordForm({ token }: { token?: string }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!token) {
    return (
      <div className="space-y-4 text-left">
        <Alert variant="danger" size="md">
          Missing password reset token. Please request a new reset link.
        </Alert>
        <div className="pt-2 text-center">
          <Link
            href="/forgot-password"
            className="inline-block rounded-xl border-2 border-black bg-[#ccff00] px-4 py-2 font-display text-sm font-black uppercase text-black hover:bg-[#b8e600]"
          >
            Request Reset Link →
          </Link>
        </div>
      </div>
    );
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 10) {
      setError("Password must be at least 10 characters.");
      return;
    }

    setPending(true);
    setError(null);

    const result = await resetPasswordAction({ token, password });
    setPending(false);

    if (result.ok) {
      setSuccess(true);
      return;
    }

    setError(result.error);
  };

  if (success) {
    return (
      <div className="space-y-4 text-left">
        <Alert variant="success" size="md">
          Your password has been successfully reset!
        </Alert>
        <div className="pt-2 text-center">
          <Link
            href="/player-login"
            className="inline-block rounded-xl border-2 border-black bg-[#ccff00] px-4 py-2 font-display text-sm font-black uppercase text-black shadow-[3px_3px_0px_0px_#000] hover:bg-[#b8e600]"
          >
            Sign In with New Password →
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

      <FormField id="reset-password-input" label="New Password" hint="At least 10 characters.">
        <div className="relative">
          <Input
            id="reset-password-input"
            required
            type={passwordVisible ? "text" : "password"}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pr-14"
          />
          <VisibilityToggle
            visible={passwordVisible}
            onToggle={() => setPasswordVisible((v) => !v)}
            label="new password"
          />
        </div>
      </FormField>

      <FormField id="reset-password-confirm" label="Confirm New Password">
        <Input
          id="reset-password-confirm"
          required
          type={passwordVisible ? "text" : "password"}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
      </FormField>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        disabled={pending || !password || !confirmPassword}
        className="w-full font-display text-lg uppercase"
      >
        {pending ? "Resetting Password…" : "Reset Password"}
      </Button>
    </form>
  );
}
