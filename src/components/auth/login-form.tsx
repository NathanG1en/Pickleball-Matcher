"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { organizerLoginAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

export function LoginForm({ initialGroupName = "" }: { initialGroupName?: string }) {
  const router = useRouter();
  const [groupName, setGroupName] = useState(initialGroupName);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsPending(true);

    try {
      const res = await organizerLoginAction({
        groupName: groupName.trim(),
        pin: pin.trim(),
      });

      if (!res.ok) {
        setError(res.error);
        setIsPending(false);
        return;
      }

      router.push(`/g/${res.data.groupId}`);
    } catch {
      setError("Unable to sign in. Please try again.");
      setIsPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-left">
      {error && (
        <div role="alert" className="p-3 rounded-xl bg-[#ff6b6b] border-2 border-black shadow-[3px_3px_0px_0px_#000] text-black font-black text-xs text-center">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="login-group-id" className="block text-xs uppercase font-black tracking-wider text-black mb-1.5">
          Group Name
        </label>
        <input
          id="login-group-name"
          type="text"
          required
          autoComplete="off"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          placeholder="Enter your group name"
          className="w-full bg-white border-2 border-black rounded-xl px-4 py-3 text-black font-bold placeholder-neutral-400 shadow-[3px_3px_0px_0px_#000] focus:shadow-[5px_5px_0px_0px_#000] focus:outline-none transition-shadow"
        />
      </div>

      <div>
        <label htmlFor="login-pin" className="block text-xs uppercase font-black tracking-wider text-black mb-1.5">
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
          className="w-full bg-white border-2 border-black rounded-xl px-4 py-3 text-black text-center text-3xl font-mono font-bold tracking-widest shadow-[3px_3px_0px_0px_#000] focus:shadow-[5px_5px_0px_0px_#000] focus:outline-none transition-shadow"
        />
      </div>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        disabled={isPending || pin.length < 4 || !groupName.trim()}
        className="w-full mt-3 font-display text-lg tracking-wide uppercase"
      >
        {isPending ? "Signing In..." : "Unlock"}
      </Button>
    </form>
  );
}
