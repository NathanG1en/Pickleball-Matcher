"use client";

import { useState } from "react";
import Link from "next/link";
import { resetPasswordAction } from "@/app/actions/player-account";
import { Alert, Button, FormField, Input, OtpInput, VisibilityToggle, isCompleteOtp } from "@/components/ui";

export function ResetPasswordForm({ token, email }: { token?: string; email?: string }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [code, setCode] = useState(token || "");
  const [emailInput, setEmailInput] = useState(email || "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const effectiveToken = (token || code).trim();
    if (!effectiveToken) {
      setError("Reset code is required.");
      return;
    }
    if (!token && !isCompleteOtp(code)) {
      setError("Fill in all 6 digits of the reset code.");
      return;
    }
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

    const result = await resetPasswordAction({
      token: effectiveToken,
      password,
      ...(emailInput.trim() ? { email: emailInput.trim() } : {}),
    });
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

  if (!token) {
    return (
      <div className="space-y-4 text-left">
        <Alert variant="danger" size="md">
          Missing password reset token. Please request a new reset link.
        </Alert>

        {error && (
          <Alert variant="danger" size="md" className="text-center">
            {error}
          </Alert>
        )}

        <form onSubmit={submit} className="rounded-2xl border-2 border-black bg-white p-4 space-y-3 shadow-[3px_3px_0px_0px_#000]">
          <div className="space-y-1 text-center">
            <p className="text-xs font-black uppercase tracking-wider text-neutral-800 text-left sm:text-center">
              Enter your 6-digit reset code.
            </p>
            <div className="flex justify-center my-2">
              <OtpInput
                id="reset-code-input"
                value={code}
                onChange={setCode}
                disabled={pending}
              />
            </div>
          </div>
          {!email && (
            <FormField id="reset-email-input" label="Email Address">
              <Input
                id="reset-email-input"
                type="email"
                required
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="you@example.com"
              />
            </FormField>
          )}
          <FormField id="reset-new-password-otp" label="New Password" hint="At least 10 characters.">
            <div className="relative">
              <Input
                id="reset-new-password-otp"
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
          <FormField id="reset-confirm-password-otp" label="Confirm New Password">
            <Input
              id="reset-confirm-password-otp"
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
            disabled={pending || !code || !password || !confirmPassword}
            className="w-full font-display text-lg uppercase"
          >
            {pending ? "Resetting Password…" : "Reset Password"}
          </Button>
        </form>

        <div className="pt-2 text-center">
          <Link
            href="/forgot-password"
            className="inline-block rounded-xl border-2 border-black bg-[#FFFDF7] px-4 py-2 font-display text-sm font-black uppercase text-black hover:bg-neutral-100"
          >
            Request Reset Link →
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
