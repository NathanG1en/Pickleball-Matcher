"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { organizerLoginAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

export function LoginForm({ groupId }: { groupId: string }) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsPending(true);

    try {
      const res = await organizerLoginAction({
        groupId,
        pin: pin.trim(),
      });

      if (!res.ok) {
        setError(res.error);
        setIsPending(false);
        return;
      }

      router.push(`/g/${groupId}`);
    } catch {
      setError("Unable to sign in. Please try again.");
      setIsPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-left">
      {error && (
        <div role="alert" className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs text-center">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="login-pin" className="block text-xs uppercase font-bold text-slate-400 mb-1.5">
          Organizer PIN
        </label>
        <input
          id="login-pin"
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          required
          autoFocus
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="••••"
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-center text-2xl font-mono tracking-widest focus:outline-none focus:border-emerald-500"
        />
      </div>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        disabled={isPending || pin.length < 4}
        className="w-full mt-2"
      >
        {isPending ? "Signing In..." : "Unlock"}
      </Button>
    </form>
  );
}
