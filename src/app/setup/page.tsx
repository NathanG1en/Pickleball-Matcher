"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createGroupAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

export default function SetupGroupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [setupToken, setSetupToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsPending(true);

    try {
      const res = await createGroupAction({
        name: name.trim(),
        pin: pin.trim(),
        setupToken: setupToken.trim(),
      });

      if (!res.ok) {
        setError(res.error);
        setIsPending(false);
        return;
      }

      router.push(`/g/${res.data.groupId}`);
    } catch {
      setError("An unexpected error occurred while creating the group.");
      setIsPending(false);
    }
  };

  return (
    <main className="min-h-screen p-4 sm:p-6 flex items-center justify-center bg-slate-950 text-slate-100">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
        <div className="mb-6 text-center">
          <p className="text-xs uppercase font-extrabold tracking-widest text-emerald-400 mb-1">
            Pickleball Matchmaker
          </p>
          <h1 className="text-2xl font-black text-white">Create Group</h1>
          <p className="text-sm text-slate-400 mt-1">
            Set up your recurring group and organizer PIN.
          </p>
        </div>

        {error && (
          <div role="alert" className="mb-6 p-4 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="group-name" className="block text-xs uppercase font-bold text-slate-400 mb-1.5">
              Group Name
            </label>
            <input
              id="group-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Tuesday Morning Doubles"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label htmlFor="organizer-pin" className="block text-xs uppercase font-bold text-slate-400 mb-1.5">
              Organizer PIN (4–12 digits)
            </label>
            <input
              id="organizer-pin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              required
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="••••"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 font-mono tracking-widest focus:outline-none focus:border-emerald-500"
            />
            <p className="text-xs text-slate-500 mt-1">
              You will use this PIN to start rounds and enter scores.
            </p>
          </div>

          <div>
            <label htmlFor="setup-token" className="block text-xs uppercase font-bold text-slate-400 mb-1.5">
              Setup Token
            </label>
            <input
              id="setup-token"
              type="password"
              required
              value={setupToken}
              onChange={(e) => setSetupToken(e.target.value)}
              placeholder="Secret operator setup token"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={isPending}
            className="w-full mt-2"
          >
            {isPending ? "Creating..." : "Create Group &amp; Start"}
          </Button>
        </form>
      </div>
    </main>
  );
}
