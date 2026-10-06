"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

import { createPlayerAction } from "@/app/actions/players";
import { startSessionAction } from "@/app/actions/sessions";
import {
  AttendanceManager,
  type AttendancePlayer,
} from "@/components/attendance/attendance-manager";
import { createIdempotencyKey } from "@/lib/utils/idempotency";

export function NewSessionClient({
  groupId,
  initialPlayers,
}: {
  groupId: string;
  initialPlayers: readonly AttendancePlayer[];
}) {
  const router = useRouter();
  const [players, setPlayers] = useState<readonly AttendancePlayer[]>(initialPlayers);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleAddGuest = async (name: string) => {
    try {
      const res = await createPlayerAction({
        groupId,
        name,
        initialRating: 1000,
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

  const handleStartSession = async (data: {
    courtCount: number;
    selectedPlayerIds: string[];
  }) => {
    setError(null);
    setIsPending(true);

    try {
      const res = await startSessionAction({
        groupId,
        courtCount: data.courtCount,
        playerIds: data.selectedPlayerIds,
        idempotencyKey: createIdempotencyKey("session"),
      });

      if (!res.ok) {
        setError(res.error);
        setIsPending(false);
        return;
      }

      router.push(`/g/${groupId}/sessions/${res.data.id}`);
    } catch {
      setError("An unexpected error occurred while starting the session.");
      setIsPending(false);
    }
  };

  return (
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
        onSubmit={handleStartSession}
        onAddGuest={handleAddGuest}
      />
    </div>
  );
}
