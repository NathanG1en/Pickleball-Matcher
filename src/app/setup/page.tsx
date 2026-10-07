"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred while creating the group.");
      setIsPending(false);
    }
  };

  return (
    <main className="min-h-screen p-4 sm:p-6 flex items-center justify-center">
      <div className="relative w-full max-w-md bg-white border-[3px] border-black rounded-3xl p-6 sm:p-8 shadow-[8px_8px_0px_0px_#000] text-black">
        <Link
          href="/"
          aria-label="Close group creation and return home"
          className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full border-2 border-black bg-white text-xl font-black leading-none hover:bg-[#fde047]"
        >
          ×
        </Link>
        <div className="mb-6 text-center space-y-2">
          <span className="inline-block px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider text-black bg-[#fde047] border-2 border-black shadow-[2px_2px_0px_0px_#000]">
            Pickleball Matchmaker
          </span>
          <h1 className="font-display text-4xl font-black uppercase tracking-tight text-black">
            Create Group
          </h1>
          <p className="text-sm font-bold text-neutral-700">
            Set up your recurring group and organizer PIN. Group names are case-sensitive and must be unique.
          </p>
        </div>

        {error && (
          <div role="alert" className="mb-6 p-4 rounded-xl bg-[#ff6b6b] border-2 border-black shadow-[3px_3px_0px_0px_#000] text-black font-black text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="group-name" className="block text-xs uppercase font-black tracking-wider text-black mb-1.5">
              Group Name
            </label>
            <input
              id="group-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Tuesday Morning Doubles"
              className="w-full bg-white border-2 border-black rounded-xl px-4 py-3 text-black font-bold placeholder-neutral-400 shadow-[3px_3px_0px_0px_#000] focus:shadow-[5px_5px_0px_0px_#000] focus:outline-none transition-shadow"
            />
          </div>

          <div>
            <label htmlFor="organizer-pin" className="block text-xs uppercase font-black tracking-wider text-black mb-1.5">
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
              className="w-full bg-white border-2 border-black rounded-xl px-4 py-3 text-black font-mono font-bold placeholder-neutral-400 tracking-widest shadow-[3px_3px_0px_0px_#000] focus:shadow-[5px_5px_0px_0px_#000] focus:outline-none transition-shadow"
            />
            <p className="text-xs font-bold text-neutral-600 mt-1.5">
              You will use this PIN to start rounds and enter scores.
            </p>
          </div>

          <div>
            <label htmlFor="setup-token" className="block text-xs uppercase font-black tracking-wider text-black mb-1.5">
              Setup Token
            </label>
            <input
              id="setup-token"
              type="password"
              required
              value={setupToken}
              onChange={(e) => setSetupToken(e.target.value)}
              placeholder="Secret operator setup token"
              className="w-full bg-white border-2 border-black rounded-xl px-4 py-3 text-black font-bold placeholder-neutral-400 shadow-[3px_3px_0px_0px_#000] focus:shadow-[5px_5px_0px_0px_#000] focus:outline-none transition-shadow"
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={isPending}
            className="w-full mt-3 font-display text-lg tracking-wide uppercase"
          >
            {isPending ? "Creating..." : "Create Group & Start"}
          </Button>
        </form>
      </div>
    </main>
  );
}
