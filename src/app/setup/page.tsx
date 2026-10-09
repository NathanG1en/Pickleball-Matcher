"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createGroupAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { VisibilityToggle } from "@/components/ui/visibility-toggle";
import { saveRecentGroup } from "@/lib/storage/recent-groups";

export default function SetupGroupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [setupToken, setSetupToken] = useState("");
  const [pinVisible, setPinVisible] = useState(false);
  const [setupTokenVisible, setSetupTokenVisible] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setIsPending(true);

    try {
      const res = await createGroupAction({
        name: name.trim(),
        pin: pin.trim(),
        setupToken: setupToken.trim(),
        isPublic,
      });

      if (!res.ok) {
        setError(res.error);
        setFieldErrors(res.fieldErrors ?? {});
        setIsPending(false);
        return;
      }

      saveRecentGroup({ id: res.data.groupId, name: res.data.name });
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
          <div role="alert" className="mb-6 rounded-xl border-2 border-red-600 bg-red-50 p-4 text-sm font-black text-red-700 shadow-[3px_3px_0px_0px_#000]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
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
              aria-invalid={Boolean(fieldErrors.name?.length)}
              aria-describedby={fieldErrors.name?.length ? "group-name-error" : undefined}
              className={`w-full rounded-xl border-2 px-4 py-3 font-bold text-black placeholder-neutral-400 shadow-[3px_3px_0px_0px_#000] focus:shadow-[5px_5px_0px_0px_#000] focus:outline-none transition-shadow ${fieldErrors.name?.length ? "border-red-600 bg-red-50" : "border-black bg-white"}`}
            />
            {fieldErrors.name?.[0] && <p id="group-name-error" className="mt-1 text-xs font-bold text-red-700">{fieldErrors.name[0]}</p>}
          </div>

          <div>
            <label htmlFor="organizer-pin" className="block text-xs uppercase font-black tracking-wider text-black mb-1.5">
              Organizer PIN (4–12 digits)
            </label>
            <div className="relative">
              <input
                id="organizer-pin"
                type={pinVisible ? "text" : "password"}
                inputMode="numeric"
                pattern="[0-9]*"
                required
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••"
                aria-invalid={Boolean(fieldErrors.pin?.length)}
                aria-describedby={fieldErrors.pin?.length ? "organizer-pin-error" : undefined}
                className={`w-full rounded-xl border-2 px-4 py-3 pr-14 font-mono font-bold tracking-widest text-black placeholder-neutral-400 shadow-[3px_3px_0px_0px_#000] focus:shadow-[5px_5px_0px_0px_#000] focus:outline-none transition-shadow ${fieldErrors.pin?.length ? "border-red-600 bg-red-50" : "border-black bg-white"}`}
              />
              <VisibilityToggle visible={pinVisible} onToggle={() => setPinVisible((visible) => !visible)} label="organizer PIN" />
            </div>
            {fieldErrors.pin?.[0] && <p id="organizer-pin-error" className="mt-1 text-xs font-bold text-red-700">{fieldErrors.pin[0]}</p>}
            <p className="text-xs font-bold text-neutral-600 mt-1.5">
              You will use this PIN to start rounds and enter scores.
            </p>
          </div>

          <div>
            <label className="flex items-start gap-3 rounded-xl border-2 border-black bg-neutral-50 p-4 text-sm font-bold text-black">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(event) => setIsPublic(event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-black"
              />
              <span>
                Make this group public so players can find and join it.
                <span className="block text-xs font-medium text-neutral-600 mt-1">
                  Private groups can still be opened with their group link.
                </span>
              </span>
            </label>
          </div>

          <div>
            <label htmlFor="setup-token" className="block text-xs uppercase font-black tracking-wider text-black mb-1.5">
              Setup Token
            </label>
            <div className="relative">
              <input
                id="setup-token"
                type={setupTokenVisible ? "text" : "password"}
                required
                value={setupToken}
                onChange={(e) => setSetupToken(e.target.value)}
                placeholder="Secret operator setup token"
                aria-invalid={Boolean(fieldErrors.setupToken?.length)}
                aria-describedby={fieldErrors.setupToken?.length ? "setup-token-error" : undefined}
                className={`w-full rounded-xl border-2 px-4 py-3 pr-14 font-bold text-black placeholder-neutral-400 shadow-[3px_3px_0px_0px_#000] focus:shadow-[5px_5px_0px_0px_#000] focus:outline-none transition-shadow ${fieldErrors.setupToken?.length ? "border-red-600 bg-red-50" : "border-black bg-white"}`}
              />
              <VisibilityToggle visible={setupTokenVisible} onToggle={() => setSetupTokenVisible((visible) => !visible)} label="setup token" />
            </div>
            {fieldErrors.setupToken?.[0] && <p id="setup-token-error" className="mt-1 text-xs font-bold text-red-700">{fieldErrors.setupToken[0]}</p>}
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
