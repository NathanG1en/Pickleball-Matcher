"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

import { createPlayerAction, deletePlayerAction } from "@/app/actions/players";
import { PlayerSearchDrawer } from "@/components/groups/player-search-drawer";
import { PlayerRoster } from "@/components/players/player-roster";
import type { PlayerRecord } from "@/lib/domain/types";
import { createIdempotencyKey } from "@/lib/utils/idempotency";

export function PlayersClient({
  groupId,
  initialPlayers,
  canManage = true,
}: {
  groupId: string;
  initialPlayers: readonly PlayerRecord[];
  canManage?: boolean;
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

  const handleDeletePlayer = async (player: PlayerRecord) => {
    setIsPending(true);
    setError(null);
    try {
      const res = await deletePlayerAction({
        groupId,
        playerId: player.id,
        idempotencyKey: createIdempotencyKey(`p_del_${player.id}`),
      });
      if (res.ok) {
        setPlayers((prev) => prev.filter((p) => p.id !== player.id));
        router.refresh();
      } else {
        setError(res.error);
      }
    } catch {
      setError("Failed to delete player.");
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

      <PlayerSearchDrawer
        groupId={groupId}
        onPlayerAdded={(newP) => {
          router.refresh();
        }}
      />

      <PlayerRoster
        groupId={groupId}
        players={players}
        isPending={isPending}
        onAddPlayer={canManage ? handleAddPlayer : undefined}
        onDeletePlayer={canManage ? handleDeletePlayer : undefined}
        canManage={canManage}
      />
    </div>
  );
}
