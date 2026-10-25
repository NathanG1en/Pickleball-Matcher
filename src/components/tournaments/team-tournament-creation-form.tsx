"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { PlayerRecord } from "@/lib/domain/types";
import { createTeamTournamentAction } from "@/app/actions/tournaments";
import { createPlayerAction } from "@/app/actions/players";
import { autoBalanceTeams } from "@/lib/tournament/team-tournament";
import { formatDupr } from "@/lib/domain/rating-display";
import { createIdempotencyKey } from "@/lib/utils/idempotency";
import { RatingSlider } from "@/components/ui/rating-slider";

interface TeamTournamentCreationFormProps {
  readonly groupId: string;
  readonly groupName: string;
  readonly initialPlayers: readonly PlayerRecord[];
}

interface FormTeamState {
  name: string;
  color: string;
  pairIndices: number[]; // indices into formedPairs
  soloPlayerIds: string[];
}

export function TeamTournamentCreationForm({
  groupId,
  groupName,
  initialPlayers,
}: TeamTournamentCreationFormProps) {
  const router = useRouter();
  const [players, setPlayers] = useState<readonly PlayerRecord[]>(initialPlayers);
  const [name, setName] = useState<string>(`${groupName} Team Clash`);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<string>>(
    new Set(initialPlayers.map((p) => p.id))
  );

  // Formed doubles pairs: array of [player1Id, player2Id]
  const [formedPairs, setFormedPairs] = useState<[string, string][]>([]);
  const [selectedP1, setSelectedP1] = useState<string>("");
  const [selectedP2, setSelectedP2] = useState<string>("");

  // Team configurations
  const [teams, setTeams] = useState<FormTeamState[]>([
    { name: "Team Fire 🔥", color: "#ef4444", pairIndices: [], soloPlayerIds: [] },
    { name: "Team Ice ❄️", color: "#3b82f6", pairIndices: [], soloPlayerIds: [] },
  ]);

  // Guest creation
  const [guestName, setGuestName] = useState<string>("");
  const [guestGender, setGuestGender] = useState<"male" | "female">("male");
  const [guestRating, setGuestRating] = useState<number>(3.5);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const playerMap = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  const sortedPlayers = useMemo(
    () => [...players].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })),
    [players]
  );

  const selectedPlayersList = useMemo(
    () => sortedPlayers.filter((p) => selectedPlayerIds.has(p.id)),
    [sortedPlayers, selectedPlayerIds]
  );

  // Set of players already in a formed pair
  const pairedPlayerIds = useMemo(() => {
    const set = new Set<string>();
    for (const [p1, p2] of formedPairs) {
      set.add(p1);
      set.add(p2);
    }
    return set;
  }, [formedPairs]);

  // Players eligible to be formed into a new pair (must be selected and not yet paired)
  const unpairedSelectedPlayers = useMemo(
    () => selectedPlayersList.filter((p) => !pairedPlayerIds.has(p.id)),
    [selectedPlayersList, pairedPlayerIds]
  );

  const togglePlayer = (id: string) => {
    setSelectedPlayerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        // Remove from pairs if currently paired
        setFormedPairs((currPairs) =>
          currPairs.filter(([p1, p2]) => p1 !== id && p2 !== id)
        );
        // Remove from team soloPlayerIds
        setTeams((currTeams) =>
          currTeams.map((t) => ({
            ...t,
            soloPlayerIds: t.soloPlayerIds.filter((pId) => pId !== id),
          }))
        );
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAllPlayers = () => {
    setSelectedPlayerIds(new Set(players.map((p) => p.id)));
  };

  const clearAllPlayers = () => {
    setSelectedPlayerIds(new Set());
    setFormedPairs([]);
    setTeams((currTeams) =>
      currTeams.map((t) => ({
        ...t,
        pairIndices: [],
        soloPlayerIds: [],
      }))
    );
  };

  const handleAddGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) return;

    try {
      const res = await createPlayerAction({
        groupId,
        name: guestName.trim(),
        gender: guestGender,
        initialRating: guestRating,
        idempotencyKey: createIdempotencyKey("guest"),
      });

      if (res.ok) {
        const newPlayer: PlayerRecord = {
          ...res.data,
          gender: guestGender,
        };
        setPlayers((prev) => [...prev, newPlayer]);
        setSelectedPlayerIds((prev) => new Set([...prev, newPlayer.id]));
        setGuestName("");
        setGuestRating(3.5);
      } else {
        setError(res.error);
      }
    } catch {
      setError("Failed to add player.");
    }
  };

  // Pair up two players
  const handleCreatePair = () => {
    if (!selectedP1 || !selectedP2 || selectedP1 === selectedP2) {
      setError("Select two different players to form a doubles pair.");
      return;
    }
    setError(null);
    setFormedPairs((prev) => [...prev, [selectedP1, selectedP2]]);
    setSelectedP1("");
    setSelectedP2("");
  };

  const handleRemovePair = (index: number) => {
    setFormedPairs((prev) => prev.filter((_, i) => i !== index));
  };

  // Auto-pair remaining solo players
  const handleAutoPairRemaining = () => {
    setError(null);
    const sortedUnpaired = [...unpairedSelectedPlayers].sort(
      (a, b) => b.rating - a.rating
    );
    const newPairs: [string, string][] = [];
    for (let i = 0; i < sortedUnpaired.length - 1; i += 2) {
      const p1 = sortedUnpaired[i]!;
      const p2 = sortedUnpaired[i + 1]!;
      newPairs.push([p1.id, p2.id]);
    }
    setFormedPairs((prev) => [...prev, ...newPairs]);
  };

  // Run auto balance algorithm
  const handleAutoBalance = () => {
    setError(null);
    const result = autoBalanceTeams(selectedPlayersList, formedPairs, teams.length);
    const newTeams: FormTeamState[] = result.teams.map((t, idx) => {
      // Find pair indices in formedPairs
      const pairIndices: number[] = [];
      for (const pairId of t.pairIds) {
        const pairObj = result.pairs.find((p) => p.id === pairId);
        if (pairObj) {
          const foundIdx = formedPairs.findIndex(
            ([p1, p2]) =>
              (p1 === pairObj.player1Id && p2 === pairObj.player2Id) ||
              (p1 === pairObj.player2Id && p2 === pairObj.player1Id)
          );
          if (foundIdx !== -1 && !pairIndices.includes(foundIdx)) {
            pairIndices.push(foundIdx);
          }
        }
      }

      return {
        name: teams[idx]?.name || t.name,
        color: teams[idx]?.color || t.color,
        pairIndices,
        soloPlayerIds: [...t.soloPlayerIds],
      };
    });

    setTeams(newTeams);
  };

  // Move a pair to another team
  const movePairToTeam = (pairIdx: number, targetTeamIdx: number) => {
    setTeams((prev) =>
      prev.map((team, idx) => {
        if (idx === targetTeamIdx) {
          if (!team.pairIndices.includes(pairIdx)) {
            return { ...team, pairIndices: [...team.pairIndices, pairIdx] };
          }
          return team;
        }
        return {
          ...team,
          pairIndices: team.pairIndices.filter((i) => i !== pairIdx),
        };
      })
    );
  };

  // Move a solo player to another team
  const moveSoloToTeam = (playerId: string, targetTeamIdx: number) => {
    setTeams((prev) =>
      prev.map((team, idx) => {
        if (idx === targetTeamIdx) {
          if (!team.soloPlayerIds.includes(playerId)) {
            return { ...team, soloPlayerIds: [...team.soloPlayerIds, playerId] };
          }
          return team;
        }
        return {
          ...team,
          soloPlayerIds: team.soloPlayerIds.filter((id) => id !== playerId),
        };
      })
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Please enter a tournament name.");
      return;
    }

    if (selectedPlayerIds.size < 2) {
      setError("Please select at least 2 players.");
      return;
    }

    // Ensure all players are placed in teams; if not assigned, run auto-balance first
    const assignedPlayerCount = teams.reduce((acc, t) => {
      let count = t.soloPlayerIds.length;
      for (const pIdx of t.pairIndices) {
        if (formedPairs[pIdx]) count += 2;
      }
      return acc + count;
    }, 0);

    let effectiveTeams = teams;
    if (assignedPlayerCount === 0 || assignedPlayerCount !== selectedPlayerIds.size) {
      const balanced = autoBalanceTeams(selectedPlayersList, formedPairs, teams.length);
      effectiveTeams = balanced.teams.map((t, idx) => {
        const pairIndices: number[] = [];
        for (const pairId of t.pairIds) {
          const pairObj = balanced.pairs.find((p) => p.id === pairId);
          if (pairObj) {
            const foundIdx = formedPairs.findIndex(
              ([p1, p2]) =>
                (p1 === pairObj.player1Id && p2 === pairObj.player2Id) ||
                (p1 === pairObj.player2Id && p2 === pairObj.player1Id)
            );
            if (foundIdx !== -1 && !pairIndices.includes(foundIdx)) {
              pairIndices.push(foundIdx);
            }
          }
        }
        return {
          name: teams[idx]?.name || t.name,
          color: teams[idx]?.color || t.color,
          pairIndices,
          soloPlayerIds: [...t.soloPlayerIds],
        };
      });
      setTeams(effectiveTeams);
    }

    setIsSubmitting(true);
    try {
      const payloadTeams = effectiveTeams.map((t) => ({
        name: t.name.trim(),
        color: t.color,
        pairPlayerIds: t.pairIndices
          .map((idx) => formedPairs[idx])
          .filter((p): p is [string, string] => Boolean(p)),
        soloPlayerIds: t.soloPlayerIds,
      }));

      const res = await createTeamTournamentAction({
        groupId,
        name: name.trim(),
        teams: payloadTeams,
        scoringType: "games_won",
      });

      if (!res.ok) {
        setError(res.error);
        setIsSubmitting(false);
        return;
      }

      router.replace(`/g/${groupId}/tournaments/${res.data.id}`);
    } catch {
      setError("An unexpected error occurred while creating the team tournament.");
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div role="alert" className="p-4 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-sm font-bold">
          {error}
        </div>
      )}

      {/* Tournament Details */}
      <section className="bg-white border-2 border-black rounded-2xl p-4 sm:p-5 shadow-[4px_4px_0px_0px_#000] space-y-4">
        <h2 className="font-display text-lg font-black uppercase text-black">
          Team Tournament Details
        </h2>
        <div>
          <label htmlFor="team-tournament-name" className="block text-xs font-black uppercase tracking-wider text-black mb-1.5">
            Tournament Name
          </label>
          <input
            id="team-tournament-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 bg-neutral-50 border-2 border-black rounded-xl font-bold text-sm text-black focus:outline-none focus:ring-2 focus:ring-[#ccff00]"
            placeholder="e.g. Saturday Team Showdown"
          />
        </div>
      </section>

      {/* Attending Players */}
      <section className="bg-white border-2 border-black rounded-2xl p-4 sm:p-5 shadow-[4px_4px_0px_0px_#000] space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-black uppercase text-black">
              Who is Playing Today?
            </h2>
            <p className="text-xs font-bold text-neutral-600">
              {selectedPlayerIds.size} players selected
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={selectAllPlayers}
              className="text-xs font-black uppercase text-[#65a30d] hover:underline"
            >
              Select All
            </button>
            <span className="text-xs text-neutral-400">·</span>
            <button
              type="button"
              onClick={clearAllPlayers}
              className="text-xs font-black uppercase text-neutral-500 hover:underline"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1">
          {sortedPlayers.map((player) => {
            const isSelected = selectedPlayerIds.has(player.id);
            return (
              <button
                key={player.id}
                type="button"
                onClick={() => togglePlayer(player.id)}
                aria-label={isSelected ? `Remove ${player.name} from selection` : `Select ${player.name}`}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 border-black text-xs font-black tracking-wide transition-transform cursor-pointer ${
                  isSelected
                    ? "bg-[#ccff00] text-black shadow-[2px_2px_0px_0px_#000]"
                    : "bg-neutral-100 text-neutral-400 opacity-60 hover:opacity-90"
                }`}
              >
                <span>{player.name} ({formatDupr(player.rating)})</span>
                {isSelected && (
                  <span
                    className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-black/15 hover:bg-black/30 text-black text-[10px] font-black leading-none ml-0.5"
                    aria-hidden="true"
                  >
                    ✕
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Add Guest Form */}
        <div className="pt-3 border-t-2 border-dashed border-neutral-200">
          <div className="flex gap-2">
            <input
              type="text"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Add guest player name..."
              className="flex-1 px-3 py-2 bg-neutral-50 border-2 border-black rounded-xl text-xs font-bold text-black focus:outline-none focus:ring-2 focus:ring-[#ccff00]"
            />
            <Button
              type="button"
              onClick={(e) => void handleAddGuest(e)}
              disabled={!guestName.trim()}
              className="text-xs font-black"
            >
              Add Guest
            </Button>
          </div>
          {guestName.trim() && (
            <div className="mt-3 p-3 bg-neutral-50 border-2 border-black rounded-xl space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-xs font-black uppercase text-black">Gender:</span>
                <label className="text-xs font-bold flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name="guestGender"
                    checked={guestGender === "male"}
                    onChange={() => setGuestGender("male")}
                  />
                  Male
                </label>
                <label className="text-xs font-bold flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name="guestGender"
                    checked={guestGender === "female"}
                    onChange={() => setGuestGender("female")}
                  />
                  Female
                </label>
              </div>
              <RatingSlider
                label="Guest Starting Rating"
                value={guestRating}
                onChange={setGuestRating}
              />
            </div>
          )}
        </div>
      </section>

      {/* Pre-Formed Doubles Partners (Lock Pairs) */}
      <section className="bg-white border-2 border-black rounded-2xl p-4 sm:p-5 shadow-[4px_4px_0px_0px_#000] space-y-4">
        <div>
          <h2 className="font-display text-lg font-black uppercase text-black flex items-center gap-2">
            <span>🤝 Pre-Formed Doubles Pairs</span>
          </h2>
          <p className="text-xs font-bold text-neutral-600 mt-0.5">
            Lock partners who showed up together as a unit. They will stay on the same team.
          </p>
        </div>

        {/* Existing formed pairs */}
        {formedPairs.length > 0 && (
          <div className="space-y-2" data-testid="formed-pairs-list">
            {formedPairs.map(([p1Id, p2Id], idx) => {
              const p1 = playerMap.get(p1Id);
              const p2 = playerMap.get(p2Id);
              const combinedDupr = ((p1?.rating ?? 1000) + (p2?.rating ?? 1000)) / 2;
              return (
                <div
                  key={`pair-${p1Id}-${p2Id}`}
                  className="flex items-center justify-between p-3 bg-neutral-50 border-2 border-black rounded-xl text-xs font-bold shadow-[2px_2px_0px_0px_#000]"
                >
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-[#ccff00] text-black font-black uppercase text-[10px] border border-black">
                      Pair #{idx + 1}
                    </span>
                    <span className="font-black text-black">
                      {p1?.name ?? "Unknown"} &amp; {p2?.name ?? "Unknown"}
                    </span>
                    <span className="text-neutral-500 font-bold">
                      · Avg: {formatDupr(combinedDupr)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemovePair(idx)}
                    className="text-rose-600 hover:text-rose-800 font-black uppercase text-xs cursor-pointer"
                  >
                    Unlink
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Pair creator form */}
        <div className="p-3 bg-neutral-50 border-2 border-black rounded-xl space-y-3">
          <span className="block text-xs font-black uppercase text-neutral-700">
            Link Two Players as Doubles Partners
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <select
              value={selectedP1}
              onChange={(e) => setSelectedP1(e.target.value)}
              className="px-3 py-2 bg-white border-2 border-black rounded-xl text-xs font-bold text-black"
            >
              <option value="">Select Partner 1...</option>
              {unpairedSelectedPlayers
                .filter((p) => p.id !== selectedP2)
                .map((p) => (
                  <option key={`p1-${p.id}`} value={p.id}>
                    {p.name} ({formatDupr(p.rating)})
                  </option>
                ))}
            </select>
            <select
              value={selectedP2}
              onChange={(e) => setSelectedP2(e.target.value)}
              className="px-3 py-2 bg-white border-2 border-black rounded-xl text-xs font-bold text-black"
            >
              <option value="">Select Partner 2...</option>
              {unpairedSelectedPlayers
                .filter((p) => p.id !== selectedP1)
                .map((p) => (
                  <option key={`p2-${p.id}`} value={p.id}>
                    {p.name} ({formatDupr(p.rating)})
                  </option>
                ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={handleCreatePair}
              disabled={!selectedP1 || !selectedP2 || selectedP1 === selectedP2}
              className="px-3.5 py-1.5 rounded-xl bg-black hover:bg-neutral-800 disabled:opacity-40 text-white font-black text-xs uppercase cursor-pointer"
            >
              + Lock Partner Pair
            </button>
            {unpairedSelectedPlayers.length >= 2 && (
              <button
                type="button"
                onClick={handleAutoPairRemaining}
                className="px-3.5 py-1.5 rounded-xl bg-white border-2 border-black hover:bg-neutral-100 text-black font-black text-xs uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
              >
                Auto-Pair Remaining Free Agents
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Team Roster Setup & Auto-Balancing */}
      <section className="bg-white border-2 border-black rounded-2xl p-4 sm:p-5 shadow-[4px_4px_0px_0px_#000] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-black uppercase text-black">
              Team Rosters
            </h2>
            <p className="text-xs font-bold text-neutral-600">
              Balanced based on combined ratings and pairs.
            </p>
          </div>
          <button
            type="button"
            data-testid="auto-balance-teams-button"
            onClick={handleAutoBalance}
            className="px-3.5 py-2 rounded-xl bg-[#ccff00] hover:bg-[#b8eb00] text-black border-2 border-black font-display font-black text-xs uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
          >
            ⚡ Auto-Balance Teams
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {teams.map((team, teamIdx) => {
            const otherTeamIdx = teamIdx === 0 ? 1 : 0;
            // Calculate team average DUPR
            let totalRating = 0;
            let totalCount = 0;
            for (const pIdx of team.pairIndices) {
              const pair = formedPairs[pIdx];
              if (pair) {
                totalRating += (playerMap.get(pair[0])?.rating ?? 1000) +
                               (playerMap.get(pair[1])?.rating ?? 1000);
                totalCount += 2;
              }
            }
            for (const soloId of team.soloPlayerIds) {
              totalRating += playerMap.get(soloId)?.rating ?? 1000;
              totalCount += 1;
            }
            const avgDupr = totalCount > 0 ? totalRating / totalCount : 0;

            return (
              <div
                key={`team-${teamIdx}`}
                className="p-4 bg-neutral-50 border-2 border-black rounded-2xl space-y-3 shadow-[3px_3px_0px_0px_#000]"
              >
                <div className="flex items-center justify-between">
                  <input
                    type="text"
                    value={team.name}
                    onChange={(e) => {
                      const val = e.target.value;
                      setTeams((prev) =>
                        prev.map((t, i) => (i === teamIdx ? { ...t, name: val } : t))
                      );
                    }}
                    className="font-display font-black text-base uppercase bg-transparent border-b-2 border-neutral-300 focus:border-black focus:outline-none"
                  />
                  <span className="text-xs font-black uppercase text-neutral-600">
                    Avg: {totalCount > 0 ? formatDupr(avgDupr) : "—"}
                  </span>
                </div>

                <div className="space-y-1.5 min-h-[60px]">
                  {/* Team Pairs */}
                  {team.pairIndices.map((pIdx) => {
                    const pair = formedPairs[pIdx];
                    if (!pair) return null;
                    const p1 = playerMap.get(pair[0]);
                    const p2 = playerMap.get(pair[1]);
                    return (
                      <div
                        key={`t-pair-${pIdx}`}
                        className="flex items-center justify-between p-2 bg-white border border-black rounded-lg text-xs font-bold"
                      >
                        <span>
                          🤝 {p1?.name} &amp; {p2?.name}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => movePairToTeam(pIdx, otherTeamIdx)}
                            className="text-[10px] font-black uppercase text-neutral-500 hover:text-black cursor-pointer"
                          >
                            ⇄ Move
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemovePair(pIdx)}
                            title="Unlink pair"
                            aria-label={`Unlink ${p1?.name} & ${p2?.name}`}
                            className="text-xs font-black text-neutral-400 hover:text-rose-600 px-1 cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Team Solos */}
                  {team.soloPlayerIds.map((soloId) => {
                    const p = playerMap.get(soloId);
                    return (
                      <div
                        key={`t-solo-${soloId}`}
                        className="flex items-center justify-between p-2 bg-white border border-black rounded-lg text-xs font-bold"
                      >
                        <span>👤 {p?.name}</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => moveSoloToTeam(soloId, otherTeamIdx)}
                            className="text-[10px] font-black uppercase text-neutral-500 hover:text-black cursor-pointer"
                          >
                            ⇄ Move
                          </button>
                          <button
                            type="button"
                            onClick={() => togglePlayer(soloId)}
                            title="Remove from selection"
                            aria-label={`Remove ${p?.name} from selection`}
                            className="text-xs font-black text-neutral-400 hover:text-rose-600 px-1 cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {team.pairIndices.length === 0 && team.soloPlayerIds.length === 0 && (
                    <p className="text-xs font-bold text-neutral-400 italic text-center py-4">
                      Click &ldquo;Auto-Balance Teams&rdquo; to populate
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Submit Action */}
      <div className="pt-2">
        <button
          type="submit"
          data-testid="create-team-tournament-button"
          disabled={isSubmitting || selectedPlayerIds.size < 2}
          className="w-full py-4 px-6 rounded-2xl bg-black hover:bg-neutral-800 disabled:opacity-50 text-white font-display text-lg font-black uppercase tracking-wider shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] transition-transform active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
        >
          {isSubmitting ? "Generating Match Lines..." : "Create Team Tournament →"}
        </button>
      </div>
    </form>
  );
}
