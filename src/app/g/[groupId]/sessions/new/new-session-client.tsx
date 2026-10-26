"use client";

import type { StayTogetherPair } from "@/lib/matchmaking/types";
import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createPlayerAction } from "@/app/actions/players";
import { startSessionAction } from "@/app/actions/sessions";
import { startOpenPlaySessionAction } from "@/app/actions/open-play";
import {
  AttendanceManager,
  type AttendancePlayer,
} from "@/components/attendance/attendance-manager";
import { createIdempotencyKey } from "@/lib/utils/idempotency";

export type SessionFormat = "normal" | "open_play";

export function NewSessionClient({
  groupId,
  initialPlayers,
  initialType,
}: {
  groupId: string;
  initialPlayers: readonly AttendancePlayer[];
  initialType?: SessionFormat;
}) {
  const router = useRouter();
  const [selectedFormat, setSelectedFormat] = useState<SessionFormat | null>(
    initialType ?? null
  );
  const [players, setPlayers] = useState<readonly AttendancePlayer[]>(initialPlayers);
  const [openPlayName, setOpenPlayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleSelectFormat = (format: SessionFormat | null) => {
    setSelectedFormat(format);
    setError(null);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (format) {
        url.searchParams.set("type", format);
      } else {
        url.searchParams.delete("type");
      }
      window.history.replaceState(null, "", url.toString());
    }
  };

  const handleAddGuest = async (name: string, rating: number = 3.5) => {
    try {
      const res = await createPlayerAction({
        groupId,
        name,
        initialRating: rating,
        idempotencyKey: createIdempotencyKey("guest"),
      });
      if (res.ok) {
        setPlayers((prev) => [...prev, res.data]);
      } else {
        setError(res.error);
      }
    } catch {
      setError("Failed to add player.");
    }
  };

  const handleStartNormalSession = async (data: {
    courtCount: number;
    courtPlayerCounts: (2 | 3 | 4)[];
    selectedPlayerIds: string[];
    stayTogetherPairs: readonly StayTogetherPair[];
  }) => {
    setError(null);
    setIsPending(true);

    try {
      const res = await startSessionAction({
        groupId,
        courtCount: data.courtCount,
        courtPlayerCounts: data.courtPlayerCounts,
        playerIds: data.selectedPlayerIds,
        stayTogetherPairs: data.stayTogetherPairs,
        idempotencyKey: createIdempotencyKey("session"),
      });

      if (!res.ok) {
        setError(res.error);
        setIsPending(false);
        return;
      }

      router.replace(`/g/${groupId}/sessions/${res.data.id}`);
    } catch {
      setError("An unexpected error occurred while starting the session.");
      setIsPending(false);
    }
  };

  const handleStartOpenPlay = async () => {
    setError(null);
    setIsPending(true);

    try {
      const res = await startOpenPlaySessionAction({
        groupId,
        name: openPlayName.trim() || undefined,
      });

      if (!res.ok) {
        setError(res.error);
        setIsPending(false);
        return;
      }

      router.replace(`/g/${groupId}/sessions/${res.data.id}`);
    } catch {
      setError("An unexpected error occurred while starting open play.");
      setIsPending(false);
    }
  };

  if (!selectedFormat) {
    return (
      <main className="min-h-screen p-4 sm:p-6 max-w-xl mx-auto space-y-6 text-black">
        <div className="flex items-center justify-between">
          <Link
            href={`/g/${groupId}`}
            className="px-3 py-1.5 rounded-xl bg-white border-2 border-black font-black uppercase text-xs text-black shadow-[2px_2px_0px_0px_#000] hover:bg-neutral-50 active:translate-x-0.5 active:translate-y-0.5 transition-transform"
          >
            ← Back to Group
          </Link>
          <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider text-black bg-[#ccff00] border-2 border-black shadow-[2px_2px_0px_0px_#000]">
            Step 1 of 2
          </span>
        </div>

        <header>
          <h1 className="font-display text-3xl sm:text-4xl font-black uppercase tracking-tight text-black">
            Choose Session Format
          </h1>
          <p className="text-sm font-bold text-neutral-700 mt-1">
            Select how you want to organize matches today.
          </p>
        </header>

        {error && (
          <div role="alert" className="p-4 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {/* Card 1: Normal Session */}
          <div
            className="bg-white border-[3px] border-black rounded-3xl p-6 shadow-[6px_6px_0px_0px_#000] space-y-4 transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider text-black bg-neutral-100 border-2 border-black shadow-[2px_2px_0px_0px_#000]">
                Predetermined Matchups
              </span>
              <span className="text-xs font-black uppercase tracking-wider text-neutral-600">
                Structured
              </span>
            </div>

            <div>
              <h2 className="font-display text-2xl font-black uppercase text-black">
                Normal Session
              </h2>
              <p className="text-sm font-bold text-neutral-700 mt-1 leading-snug">
                Predetermined matchups generated based on player skill ratings, fair sit-out distribution, and court rotations.
              </p>
            </div>

            <ul className="text-xs font-bold text-neutral-800 space-y-1.5 bg-neutral-50 p-3.5 rounded-2xl border-2 border-black/10">
              <li className="flex items-center gap-2">
                <span className="text-[#65a30d] font-black">✓</span> Algorithmic partner &amp; opponent pairings
              </li>
              <li className="flex items-center gap-2">
                <span className="text-[#65a30d] font-black">✓</span> Balanced court assignments &amp; sit-out rotation
              </li>
              <li className="flex items-center gap-2">
                <span className="text-[#65a30d] font-black">✓</span> Synchronized rounds with official score submission
              </li>
            </ul>

            <button
              type="button"
              data-testid="select-normal-session-button"
              onClick={() => handleSelectFormat("normal")}
              className="w-full py-3.5 px-4 rounded-xl bg-black hover:bg-neutral-800 text-white font-display text-base font-black uppercase tracking-wider shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] transition-transform active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
            >
              Select Normal Session →
            </button>
          </div>

          {/* Card 2: Open Play Session */}
          <div
            className="bg-white border-[3px] border-black rounded-3xl p-6 shadow-[6px_6px_0px_0px_#000] space-y-4 transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider text-black bg-[#ccff00] border-2 border-black shadow-[2px_2px_0px_0px_#000]">
                Flexible Games
              </span>
              <span className="text-xs font-black uppercase tracking-wider text-neutral-600">
                Casual &amp; Drop-in
              </span>
            </div>

            <div>
              <h2 className="font-display text-2xl font-black uppercase text-black">
                Open Play
              </h2>
              <p className="text-sm font-bold text-neutral-700 mt-1 leading-snug">
                Flexible format where players can leave, join, and upload their own games as courts open up.
              </p>
            </div>

            <ul className="text-xs font-bold text-neutral-800 space-y-1.5 bg-neutral-50 p-3.5 rounded-2xl border-2 border-black/10">
              <li className="flex items-center gap-2">
                <span className="text-[#65a30d] font-black">✓</span> Players can join, leave, or re-enter anytime
              </li>
              <li className="flex items-center gap-2">
                <span className="text-[#65a30d] font-black">✓</span> Self-service match submission for 1v1 singles or 2v2 doubles
              </li>
              <li className="flex items-center gap-2">
                <span className="text-[#65a30d] font-black">✓</span> Continuous open play with real-time rating updates
              </li>
            </ul>

            <button
              type="button"
              data-testid="select-open-play-button"
              onClick={() => handleSelectFormat("open_play")}
              className="w-full py-3.5 px-4 rounded-xl bg-[#ccff00] hover:bg-[#b8eb00] text-black border-2 border-black font-display text-base font-black uppercase tracking-wider shadow-[4px_4px_0px_0px_#000] transition-transform active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
            >
              Select Open Play →
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (selectedFormat === "normal") {
    return (
      <main className="min-h-screen p-4 sm:p-6 max-w-xl mx-auto space-y-6 text-black">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => handleSelectFormat(null)}
            className="px-3 py-1.5 rounded-xl bg-white border-2 border-black font-black uppercase text-xs text-black shadow-[2px_2px_0px_0px_#000] hover:bg-neutral-50 active:translate-x-0.5 active:translate-y-0.5 transition-transform cursor-pointer"
          >
            ← Change Format
          </button>
          <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider text-black bg-[#ccff00] border-2 border-black shadow-[2px_2px_0px_0px_#000]">
            Step 2 of 2
          </span>
        </div>

        <header>
          <h1 className="font-display text-3xl sm:text-4xl font-black uppercase tracking-tight text-black">
            Start Matchmaking
          </h1>
          <p className="text-sm font-bold text-neutral-700 mt-1">
            Pick available courts and who showed up to play.
          </p>
        </header>

        <div className="space-y-4">
          {error && (
            <div role="alert" className="p-4 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-sm">
              {error}
            </div>
          )}

          <AttendanceManager
            groupId={groupId}
            players={players}
            isPending={isPending}
            onSubmit={handleStartNormalSession}
            onAddGuest={handleAddGuest}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-xl mx-auto space-y-6 text-black">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => handleSelectFormat(null)}
          className="px-3 py-1.5 rounded-xl bg-white border-2 border-black font-black uppercase text-xs text-black shadow-[2px_2px_0px_0px_#000] hover:bg-neutral-50 active:translate-x-0.5 active:translate-y-0.5 transition-transform cursor-pointer"
        >
          ← Change Format
        </button>
        <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider text-black bg-[#ccff00] border-2 border-black shadow-[2px_2px_0px_0px_#000]">
          Step 2 of 2
        </span>
      </div>

      <header>
        <h1 className="font-display text-3xl sm:text-4xl font-black uppercase tracking-tight text-black">
          Open Play Setup
        </h1>
        <p className="text-sm font-bold text-neutral-700 mt-1">
          Flexible games where players can join, leave, and upload matches anytime.
        </p>
      </header>

      <div className="space-y-4">
        {error && (
          <div role="alert" className="p-4 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-sm">
            {error}
          </div>
        )}

        <div className="bg-white border-[3px] border-black rounded-3xl p-6 shadow-[6px_6px_0px_0px_#000] space-y-5">
          <div>
            <label htmlFor="open-play-name-input" className="block text-xs font-black uppercase tracking-wider text-black mb-1.5">
              Session Name (Optional)
            </label>
            <input
              id="open-play-name-input"
              type="text"
              value={openPlayName}
              onChange={(e) => setOpenPlayName(e.target.value)}
              placeholder="e.g. Wednesday Night Open Play"
              maxLength={100}
              className="w-full px-4 py-3 rounded-xl border-2 border-black font-bold text-sm text-black placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#ccff00]"
            />
          </div>

          <div className="space-y-3 p-4 bg-neutral-50 rounded-2xl border-2 border-black/10">
            <h3 className="text-xs font-black uppercase tracking-wider text-black">
              How Open Play Works
            </h3>
            <ul className="text-xs font-bold text-neutral-800 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-[#65a30d] font-black">1.</span>
                <span><strong>Drop-in Attendance:</strong> Players can check themselves in upon arrival and check out whenever they leave.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#65a30d] font-black">2.</span>
                <span><strong>Self-Reported Matches:</strong> Checked-in players choose 1v1 singles or 2v2 doubles and submit their own scores.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#65a30d] font-black">3.</span>
                <span><strong>Live Ratings:</strong> Every completed match instantly counts toward group standings and ratings.</span>
              </li>
            </ul>
          </div>

          <button
            type="button"
            disabled={isPending}
            data-testid="start-open-play-button"
            onClick={handleStartOpenPlay}
            className="w-full py-4 px-6 rounded-xl bg-[#ccff00] hover:bg-[#b8eb00] text-black border-2 border-black font-display text-lg font-black uppercase tracking-wider shadow-[4px_4px_0px_0px_#000] transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 cursor-pointer disabled:opacity-60"
          >
            {isPending ? "Starting Open Play..." : "Start Open Play"}
          </button>
        </div>
      </div>
    </main>
  );
}
