"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  addGroupOrganizerAction,
  addGroupPlayerByUsernameAction,
  removeGroupOrganizerAction,
} from "@/app/actions/group-organizers";
import type { GroupOrganizerRecord, PlayerRecord } from "@/lib/domain/types";

export function GroupOrganizersPanel({
  groupId,
  players,
  organizers,
  isHost,
}: {
  groupId: string;
  players: readonly PlayerRecord[];
  organizers: readonly GroupOrganizerRecord[];
  isHost: boolean;
}) {
  const router = useRouter();
  const [pendingPlayerId, setPendingPlayerId] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [lookupPending, setLookupPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const addPlayerByUsername = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLookupPending(true);
    setMessage(null);
    const result = await addGroupPlayerByUsernameAction({ groupId, username });
    setMessage(result.ok ? "Player added to the roster." : result.error ?? "Unable to find that player.");
    if (result.ok) {
      setUsername("");
      router.refresh();
    }
    setLookupPending(false);
  };

  const makeOrganizer = async (playerId: string) => {
    setPendingPlayerId(playerId);
    setMessage(null);
    const result = await addGroupOrganizerAction({ groupId, playerId });
    setMessage(result.ok ? "Player is now a group organizer." : result.error ?? "Unable to add organizer.");
    if (result.ok) router.refresh();
    setPendingPlayerId(null);
  };

  const removeOrganizer = async (playerId: string) => {
    setPendingPlayerId(playerId);
    setMessage(null);
    const result = await removeGroupOrganizerAction({ groupId, playerId });
    setMessage(result.ok ? "Player is no longer a group organizer." : result.error ?? "Unable to remove organizer.");
    if (result.ok) router.refresh();
    setPendingPlayerId(null);
  };

  return (
    <section className="space-y-3 rounded-2xl border-2 border-black bg-[#fef08a] p-4 shadow-[3px_3px_0px_0px_#000]">
      <div>
        <h2 className="font-display text-xl font-black uppercase">Roster ({players.length})</h2>
        <p className="text-xs font-semibold text-neutral-700">Players and group organizers.</p>
      </div>
      {isHost && (
        <form onSubmit={addPlayerByUsername} className="flex gap-2">
          <label htmlFor="roster-player-username" className="sr-only">Look up player by username</label>
          <input
            id="roster-player-username"
            required
            minLength={3}
            maxLength={24}
            pattern="[A-Za-z0-9_]+"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Find player by username"
            className="min-w-0 flex-1 rounded-lg border-2 border-black bg-white px-3 py-2 text-sm font-bold"
          />
          <button disabled={lookupPending} className="rounded-lg border-2 border-black bg-black px-3 py-2 text-xs font-black uppercase text-white disabled:opacity-60">
            {lookupPending ? "Adding…" : "Find & Add"}
          </button>
        </form>
      )}
      {players.length === 0 ? (
        <p className="rounded-lg border border-black bg-white px-3 py-3 text-sm font-bold text-neutral-700">No players on the roster yet.</p>
      ) : (
        <ul className="divide-y-2 divide-neutral-200 rounded-xl border-2 border-black bg-white px-3">
          {players.map((player) => {
            const organizer = player.accountId ? organizers.find(({ accountId }) => accountId === player.accountId) : undefined;
            const playerUsername = player.username || organizer?.username;
            return (
              <li key={player.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-black">
                      {player.name}
                      {playerUsername ? ` (@${playerUsername})` : ""}
                    </span>
                    {organizer && (
                      <span
                        className={`rounded-full border border-black px-2 py-1 text-[9px] font-black uppercase ${
                          organizer.isHost ? "bg-[#fde047]" : "bg-[#e0f2fe]"
                        }`}
                      >
                        {organizer.isHost ? "Host" : "Organizer"}
                      </span>
                    )}
                  </div>
                  <span className="block text-xs font-bold text-neutral-600">
                    Rating: {Math.round(player.rating)} · {player.ratedGamesPlayed} games · {player.active ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {isHost && (
                    <details className="relative">
                      <summary aria-label={`Options for ${player.name}`} className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg border-2 border-black bg-white text-xl font-black leading-none shadow-[2px_2px_0px_0px_#000] hover:bg-neutral-100 [&::-webkit-details-marker]:hidden">···</summary>
                      <div className="absolute right-0 top-10 z-20 min-w-48 rounded-xl border-2 border-black bg-white p-1.5 shadow-[3px_3px_0px_0px_#000]">
                        {organizer?.isHost ? (
                          <button
                            type="button"
                            disabled
                            className="w-full rounded-lg px-3 py-2 text-left text-xs font-black uppercase disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Group host
                          </button>
                        ) : organizer ? (
                          <button
                            type="button"
                            disabled={pendingPlayerId === player.id}
                            onClick={() => void removeOrganizer(player.id)}
                            className="w-full rounded-lg px-3 py-2 text-left text-xs font-black uppercase text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {pendingPlayerId === player.id ? "Removing…" : "Remove group organizer"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={!player.accountId || pendingPlayerId === player.id}
                            onClick={() => void makeOrganizer(player.id)}
                            title={!player.accountId ? "This player needs a linked account to become an organizer." : undefined}
                            className="w-full rounded-lg px-3 py-2 text-left text-xs font-black uppercase hover:bg-[#ccff00] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {pendingPlayerId === player.id ? "Adding…" : "Make a group organizer"}
                          </button>
                        )}
                      </div>
                    </details>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {message && <p role="status" className="text-xs font-bold">{message}</p>}
    </section>
  );
}
