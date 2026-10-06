"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

import { createPlayerAction, updatePlayerAction } from "@/app/actions/players";
import { PlayerRoster } from "@/components/players/player-roster";
import type { PlayerRecord } from "@/lib/domain/types";
import { createIdempotencyKey } from "@/lib/utils/idempotency";

export function PlayersClient({
  groupId,
  initialPlayers,
}: {
  groupId: string;
  initialPlayers: readonly PlayerRecord[];
}) {
  const router = useRouter();
  const [players, setPlayers] = useState<readonly PlayerRecord[]>(initialPlayers);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleAddPlayer = async (name: string, initialRating: number) => {
    setIsPending(true);
    setError(null);
    try {
      const res = await createPlayerAction({
        groupId,
        name,
        initialRating,
        idempotencyKey: createIdempotencyKey("p_add"),
      });
      if (res.ok) {
        setPlayers((prev) => [...prev, res.data]);
        router.refresh();
      } else {
        setError(res.error);
      }
    } catch {
      setError("Failed to add player.");
    } finally {
      setIsPending(false);
    }
  };

  const handleToggleActive = async (player: PlayerRecord) => {
    setIsPending(true);
    setError(null);
    try {
      const res = await updatePlayerAction({
        groupId,
        playerId: player.id,
        active: !player.active,
        idempotencyKey: createIdempotencyKey(`p_toggle_${player.id}`),
      });
      if (res.ok) {
        setPlayers((prev) =>
          prev.map((p) => (p.id === player.id ? { ...p, active: !p.active } : p)),
        );
        router.refresh();
      } else {
        setError(res.error);
      }
    } catch {
      setError("Failed to update player status.");
    } finally {
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

      <PlayerRoster
        groupId={groupId}
        players={players}
        isPending={isPending}
        onAddPlayer={handleAddPlayer}
        onToggleActive={handleToggleActive}
      />
    </div>
  );
}
