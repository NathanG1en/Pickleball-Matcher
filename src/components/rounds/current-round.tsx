"use client";

import React, { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface RoundCourtData {
  readonly courtNumber: number;
  readonly team1: readonly string[];
  readonly team2: readonly string[];
}

export interface CurrentRoundViewProps {
  readonly round: {
    readonly id: string;
    readonly roundNumber: number;
    readonly status: "proposed" | "started" | "completed";
    readonly seed: number;
  };
  readonly courts: readonly RoundCourtData[];
  readonly sittingPlayerIds: readonly string[];
  readonly playerNames: Record<string, string>;
  readonly canRegenerate?: boolean;
  readonly isPending?: boolean;
  readonly onStartRound?: (customProposal?: {
    courts: readonly RoundCourtData[];
    sitting: readonly string[];
  }) => void;
  readonly onRegenerate?: () => void;
  readonly onEnterResults?: () => void;
}

export function CurrentRoundView({
  round,
  courts,
  sittingPlayerIds,
  playerNames,
  canRegenerate = false,
  isPending = false,
  onStartRound,
  onRegenerate,
  onEnterResults,
}: CurrentRoundViewProps) {
  // Local editable state for manual lineup modifications
  const [localCourts, setLocalCourts] = useState<RoundCourtData[]>(() =>
    courts.map((c) => ({
      courtNumber: c.courtNumber,
      team1: [...c.team1],
      team2: [...c.team2],
    }))
  );
  const [localSitting, setLocalSitting] = useState<string[]>(() => [...sittingPlayerIds]);
  const [prevProps, setPrevProps] = useState({ courts, sittingPlayerIds });

  // Sync state if props change (e.g. after regeneration)
  if (prevProps.courts !== courts || prevProps.sittingPlayerIds !== sittingPlayerIds) {
    setPrevProps({ courts, sittingPlayerIds });
    setLocalCourts(
      courts.map((c) => ({
        courtNumber: c.courtNumber,
        team1: [...c.team1],
        team2: [...c.team2],
      }))
    );
    setLocalSitting([...sittingPlayerIds]);
  }

  // Friction and interaction state
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [showConfirmStart, setShowConfirmStart] = useState(false);
  const [acknowledgedOverride, setAcknowledgedOverride] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [draggedPlayerId, setDraggedPlayerId] = useState<string | null>(null);
  const [activeDropZone, setActiveDropZone] = useState<string | null>(null);

  const nameFor = (id: string) => playerNames[id] ?? id;

  // Check if current lineup differs from the algorithm's recommendation
  const hasModifications = useMemo(() => {
    if (localCourts.length !== courts.length) return true;
    for (let i = 0; i < courts.length; i++) {
      const orig = courts[i];
      const curr = localCourts[i];
      if (!curr) return true;
      if (orig.courtNumber !== curr.courtNumber) return true;
      if (orig.team1.join(",") !== curr.team1.join(",")) return true;
      if (orig.team2.join(",") !== curr.team2.join(",")) return true;
    }
    const origSit = sittingPlayerIds.slice().sort().join(",");
    const currSit = localSitting.slice().sort().join(",");
    return origSit !== currSit;
  }, [localCourts, localSitting, courts, sittingPlayerIds]);

  // Count how many players are in different positions
  const modificationCount = useMemo(() => {
    let diff = 0;
    // Compare sitting
    const origSitSet = new Set(sittingPlayerIds);
    for (const id of localSitting) {
      if (!origSitSet.has(id)) diff += 1;
    }
    // Compare courts
    localCourts.forEach((curr, idx) => {
      const orig = courts[idx];
      if (!orig) {
        diff += curr.team1.length + curr.team2.length;
        return;
      }
      const origT1 = new Set(orig.team1);
      const origT2 = new Set(orig.team2);
      curr.team1.forEach((id) => {
        if (!origT1.has(id)) diff += 1;
      });
      curr.team2.forEach((id) => {
        if (!origT2.has(id)) diff += 1;
      });
    });
    return diff;
  }, [localCourts, localSitting, courts, sittingPlayerIds]);

  // Valid play is 1v1, 2v2, or 2v1. A single unassigned player belongs in sitting.
  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    for (const c of localCourts) {
      const total = c.team1.length + c.team2.length;
      if (total === 0) continue; // Inactive court
      const valid = (c.team1.length === 1 && c.team2.length === 1) ||
        (c.team1.length === 2 && c.team2.length === 2) ||
        (c.team1.length === 2 && c.team2.length === 1) ||
        (c.team1.length === 1 && c.team2.length === 2);
      if (!valid) {
        errors.push(`Court ${c.courtNumber} must be 1v1, 2v2, or 2v1.`);
      }
    }
    return errors;
  }, [localCourts]);

  const isValidLineup = validationErrors.length === 0;

  // Core swap logic
  const swapPlayers = (idA: string, idB: string) => {
    if (idA === idB) return;

    setLocalCourts((prevCourts) => {
      let courtAInfo: { cIdx: number; team: "team1" | "team2"; pIdx: number } | null = null;
      let courtBInfo: { cIdx: number; team: "team1" | "team2"; pIdx: number } | null = null;

      prevCourts.forEach((c, cIdx) => {
        const t1A = c.team1.indexOf(idA);
        if (t1A !== -1) courtAInfo = { cIdx, team: "team1", pIdx: t1A };
        const t2A = c.team2.indexOf(idA);
        if (t2A !== -1) courtAInfo = { cIdx, team: "team2", pIdx: t2A };

        const t1B = c.team1.indexOf(idB);
        if (t1B !== -1) courtBInfo = { cIdx, team: "team1", pIdx: t1B };
        const t2B = c.team2.indexOf(idB);
        if (t2B !== -1) courtBInfo = { cIdx, team: "team2", pIdx: t2B };
      });

      const isASitting = localSitting.includes(idA);
      const isBSitting = localSitting.includes(idB);

      // Case 1: Both on courts
      if (courtAInfo && courtBInfo) {
        return prevCourts.map((c, cIdx) => {
          const t1 = [...c.team1];
          const t2 = [...c.team2];
          if (courtAInfo!.cIdx === cIdx) {
            if (courtAInfo!.team === "team1") t1[courtAInfo!.pIdx] = idB;
            else t2[courtAInfo!.pIdx] = idB;
          }
          if (courtBInfo!.cIdx === cIdx) {
            if (courtBInfo!.team === "team1") t1[courtBInfo!.pIdx] = idA;
            else t2[courtBInfo!.pIdx] = idA;
          }
          return { ...c, team1: t1, team2: t2 };
        });
      }

      // Case 2: A on court, B is sitting
      if (courtAInfo && isBSitting) {
        setLocalSitting((prevSitting) =>
          prevSitting.map((sId) => (sId === idB ? idA : sId))
        );
        return prevCourts.map((c, cIdx) => {
          if (courtAInfo!.cIdx !== cIdx) return c;
          const t1 = [...c.team1];
          const t2 = [...c.team2];
          if (courtAInfo!.team === "team1") t1[courtAInfo!.pIdx] = idB;
          else t2[courtAInfo!.pIdx] = idB;
          return { ...c, team1: t1, team2: t2 };
        });
      }

      // Case 3: B on court, A is sitting
      if (courtBInfo && isASitting) {
        setLocalSitting((prevSitting) =>
          prevSitting.map((sId) => (sId === idA ? idB : sId))
        );
        return prevCourts.map((c, cIdx) => {
          if (courtBInfo!.cIdx !== cIdx) return c;
          const t1 = [...c.team1];
          const t2 = [...c.team2];
          if (courtBInfo!.team === "team1") t1[courtBInfo!.pIdx] = idA;
          else t2[courtBInfo!.pIdx] = idA;
          return { ...c, team1: t1, team2: t2 };
        });
      }

      // Case 4: Both sitting
      if (isASitting && isBSitting) {
        setLocalSitting((prevSitting) => {
          const next = [...prevSitting];
          const idxA = next.indexOf(idA);
          const idxB = next.indexOf(idB);
          next[idxA] = idB;
          next[idxB] = idA;
          return next;
        });
        return prevCourts;
      }

      return prevCourts;
    });
  };

  // Move a player to sitting pool
  const moveToSitting = (playerId: string) => {
    if (localSitting.includes(playerId)) return;
    setLocalCourts((prevCourts) =>
      prevCourts.map((c) => ({
        ...c,
        team1: c.team1.filter((id) => id !== playerId),
        team2: c.team2.filter((id) => id !== playerId),
      }))
    );
    setLocalSitting((prevSitting) => [...prevSitting, playerId]);
  };

  // Move player to an open team slot (e.g. turning singles into doubles)
  const moveToTeam = (playerId: string, courtNumber: number, teamNum: 1 | 2) => {
    setLocalSitting((prevSitting) => prevSitting.filter((id) => id !== playerId));
    setLocalCourts((prevCourts) =>
      prevCourts.map((c) => {
        const cleanT1 = c.team1.filter((id) => id !== playerId);
        const cleanT2 = c.team2.filter((id) => id !== playerId);

        if (c.courtNumber === courtNumber) {
          if (teamNum === 1 && cleanT1.length < 2) {
            return { ...c, team1: [...cleanT1, playerId], team2: cleanT2 };
          }
          if (teamNum === 2 && cleanT2.length < 2) {
            return { ...c, team1: cleanT1, team2: [...cleanT2, playerId] };
          }
        }
        return { ...c, team1: cleanT1, team2: cleanT2 };
      })
    );
  };

  // Tap-to-swap click handler
  const handlePlayerClick = (playerId: string) => {
    if (!isUnlocked) return;
    if (!selectedPlayerId) {
      setSelectedPlayerId(playerId);
    } else if (selectedPlayerId === playerId) {
      setSelectedPlayerId(null);
    } else {
      swapPlayers(selectedPlayerId, playerId);
      setSelectedPlayerId(null);
    }
  };

  const handleResetToAlgorithm = () => {
    setLocalCourts(
      courts.map((c) => ({
        courtNumber: c.courtNumber,
        team1: [...c.team1],
        team2: [...c.team2],
      }))
    );
    setLocalSitting([...sittingPlayerIds]);
    setSelectedPlayerId(null);
    setAcknowledgedOverride(false);
  };

  const handleStartConfirm = () => {
    setShowConfirmStart(false);
    if (onStartRound) {
      if (hasModifications) {
        onStartRound({
          courts: localCourts.filter((c) => c.team1.length > 0 && c.team2.length > 0),
          sitting: localSitting,
        });
      } else {
        onStartRound();
      }
    }
  };

  return (
    <div className="current-round-view space-y-6 pb-28 text-black">
      {/* Round Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-black uppercase tracking-tight text-black">
            Round {round.roundNumber}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {round.status === "proposed" && (
            <>
              {isUnlocked ? (
                <button
                  type="button"
                  onClick={() => setIsUnlocked(false)}
                  className="px-3 py-1 rounded-xl bg-white border-2 border-black font-black uppercase text-xs text-black shadow-[2px_2px_0px_0px_#000] hover:bg-neutral-50 active:translate-x-0.5 active:translate-y-0.5"
                >
                  🔒 Lock Lineup
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowUnlockModal(true)}
                  className="px-3 py-1 rounded-xl bg-[#ccff00] border-2 border-black font-black uppercase text-xs text-black shadow-[2px_2px_0px_0px_#000] hover:bg-[#b8eb00] active:translate-x-0.5 active:translate-y-0.5"
                >
                  ✏️ Customize Lineup
                </button>
              )}
            </>
          )}
          {round.status === "started" && <Badge variant="success">In Progress</Badge>}
          {round.status === "completed" && <Badge variant="default">Completed</Badge>}
        </div>
      </div>

      {/* Manual Override Status Banner */}
      {round.status === "proposed" && isUnlocked && (
        <div className="p-4 bg-amber-100 border-[3px] border-black rounded-2xl shadow-[4px_4px_0px_0px_#000] space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">⚡</span>
              <div>
                <h4 className="font-display text-sm font-black uppercase tracking-wide text-black">
                  Manual Adjustments Mode Active
                </h4>
                <p className="text-xs font-bold text-neutral-800">
                  Drag and drop or tap player names to swap them between courts or the sitting pool.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {hasModifications && (
                <button
                  type="button"
                  onClick={handleResetToAlgorithm}
                  className="px-2.5 py-1 rounded-lg bg-white border-2 border-black text-xs font-black uppercase hover:bg-neutral-100 shadow-[2px_2px_0px_0px_#000]"
                >
                  ↺ Reset to Algorithm
                </button>
              )}
            </div>
          </div>

          {hasModifications && (
            <div className="inline-block px-2.5 py-1 rounded-lg bg-amber-300 border-2 border-black text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000]">
              ⚠️ {modificationCount} manual position {modificationCount === 1 ? "change" : "changes"} active
            </div>
          )}
        </div>
      )}

      {/* Selected Player Floating Bar (Tap-to-Swap helper) */}
      {selectedPlayerId && (
        <div className="sticky top-4 z-30 p-3 bg-[#ccff00] border-[3px] border-black rounded-2xl shadow-[4px_4px_0px_0px_#000] flex items-center justify-between gap-3 animate-pulse">
          <div className="flex items-center gap-2">
            <span className="text-base font-black uppercase">🎯 Selected:</span>
            <span className="px-2 py-0.5 rounded-lg bg-white border-2 border-black font-black text-sm">
              {nameFor(selectedPlayerId)}
            </span>
            <span className="text-xs font-bold text-neutral-800 hidden sm:inline">
              Tap another player to swap, or tap an open slot / sitting pool.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedPlayerId(null)}
            className="px-2.5 py-1 rounded-lg bg-white border-2 border-black text-xs font-black uppercase hover:bg-neutral-100 shadow-[2px_2px_0px_0px_#000]"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Unbalanced Court Validation Error */}
      {!isValidLineup && (
        <div role="alert" className="p-4 bg-[#ff6b6b] border-[3px] border-black rounded-2xl shadow-[4px_4px_0px_0px_#000] text-black">
          <h4 className="font-display font-black uppercase text-sm mb-1">
            ⚠️ Unbalanced Matchups Detected
          </h4>
          <ul className="text-xs font-bold list-disc list-inside space-y-0.5">
            {validationErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Courts Presentation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {localCourts.map((court) => {
          const totalPlayers = court.team1.length + court.team2.length;
          const isSingles = court.team1.length === 1 && court.team2.length === 1;
          const isTeamVsOne = totalPlayers === 3;
          const isUnbalanced = totalPlayers > 0 && !isSingles && totalPlayers !== 4 && !isTeamVsOne;
          const isEmpty = totalPlayers === 0;

          return (
            <div
              key={court.courtNumber}
              className={`court-card bg-white border-[3px] border-black rounded-2xl p-5 shadow-[6px_6px_0px_0px_#000] text-black transition-all ${
                isUnbalanced ? "ring-4 ring-[#ff6b6b]" : ""
              }`}
            >
              <div className="flex items-center justify-between mb-4 border-b-2 border-neutral-100 pb-3">
                <span className="font-display text-2xl font-black uppercase text-black">
                  Court {court.courtNumber}
                </span>
                <span
                  className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider text-black border-2 border-black shadow-[2px_2px_0px_0px_#000] ${
                    isUnbalanced
                      ? "bg-[#ff6b6b]"
                    : isSingles || isTeamVsOne
                      ? "bg-[#ccff00]"
                      : isEmpty
                      ? "bg-neutral-200"
                      : "bg-[#ccff00]"
                  }`}
                >
                  {isUnbalanced
                    ? `Unbalanced (${court.team1.length} vs ${court.team2.length})`
                    : isTeamVsOne
                    ? "2v1 · Scored, unrated"
                    : isSingles
                    ? "Singles • Unrated"
                    : isEmpty
                    ? "Inactive Court"
                    : "Doubles Match"}
                </span>
              </div>

              <div className="space-y-3">
                {/* Team 1 */}
                <div
                  className={`p-3 bg-[#e0f2fe] rounded-xl border-2 border-black shadow-[3px_3px_0px_0px_#000] transition-colors ${
                    activeDropZone === `court-${court.courtNumber}-t1` ? "bg-sky-200 ring-2 ring-black" : ""
                  }`}
                  onDragOver={(e) => {
                    if (!isUnlocked) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    setActiveDropZone(`court-${court.courtNumber}-t1`);
                  }}
                  onDragLeave={() => setActiveDropZone(null)}
                  onDrop={(e) => {
                    if (!isUnlocked) return;
                    e.preventDefault();
                    setActiveDropZone(null);
                    const draggedId = e.dataTransfer.getData("text/plain") || draggedPlayerId;
                    if (draggedId) {
                      if (court.team1.length < 2 && !court.team1.includes(draggedId)) {
                        moveToTeam(draggedId, court.courtNumber, 1);
                      } else if (court.team1.length > 0) {
                        swapPlayers(draggedId, court.team1[0]);
                      }
                    }
                    setDraggedPlayerId(null);
                  }}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs uppercase font-black tracking-wider text-black block">
                      {court.team1.length <= 1 && court.team2.length <= 1 ? "Player 1" : "Team 1"}
                    </span>
                    {isUnlocked && court.team1.length > 0 && (
                      <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                        {isUnlocked ? "Drag / Tap to swap" : ""}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {court.team1.map((pId) => {
                      const isSelected = selectedPlayerId === pId;
                      return (
                        <div
                          key={pId}
                          draggable={isUnlocked}
                          onDragStart={(e) => {
                            if (!isUnlocked) return;
                            e.dataTransfer.setData("text/plain", pId);
                            setDraggedPlayerId(pId);
                          }}
                          onDragEnd={() => setDraggedPlayerId(null)}
                          onDragOver={(e) => {
                            if (!isUnlocked) return;
                            e.preventDefault();
                          }}
                          onDrop={(e) => {
                            if (!isUnlocked) return;
                            e.preventDefault();
                            e.stopPropagation();
                            const draggedId = e.dataTransfer.getData("text/plain") || draggedPlayerId;
                            if (draggedId) swapPlayers(draggedId, pId);
                            setDraggedPlayerId(null);
                          }}
                          onClick={() => handlePlayerClick(pId)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 border-black font-black text-sm text-black transition-all ${
                            isSelected
                              ? "bg-[#ccff00] ring-4 ring-black shadow-[3px_3px_0px_0px_#000] scale-105"
                              : isUnlocked
                              ? "bg-white hover:bg-neutral-50 cursor-grab active:cursor-grabbing shadow-[2px_2px_0px_0px_#000] hover:scale-[1.02]"
                              : "bg-white shadow-[2px_2px_0px_0px_#000]"
                          }`}
                        >
                          {isUnlocked && <span className="text-neutral-400 select-none text-xs">⋮⋮</span>}
                          <span>{nameFor(pId)}</span>
                          {isUnlocked && (
                            <button
                              type="button"
                              title="Bench to sitting pool"
                              onClick={(e) => {
                                e.stopPropagation();
                                moveToSitting(pId);
                                if (selectedPlayerId === pId) setSelectedPlayerId(null);
                              }}
                              className="ml-1 text-xs text-neutral-400 hover:text-black font-black px-1 rounded hover:bg-neutral-200"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      );
                    })}

                    {/* Open partner slot if team has only 1 player */}
                    {isUnlocked && court.team1.length < 2 && (
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedPlayerId) {
                            moveToTeam(selectedPlayerId, court.courtNumber, 1);
                            setSelectedPlayerId(null);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg border-2 border-dashed border-black/60 text-xs font-black uppercase text-neutral-600 transition-all ${
                          selectedPlayerId
                            ? "bg-[#ccff00]/60 hover:bg-[#ccff00] border-black text-black animate-pulse cursor-pointer"
                            : "hover:border-black hover:text-black"
                        }`}
                      >
                        + Add Partner
                      </button>
                    )}

                    {court.team1.length === 0 && (
                      <span className="text-xs font-bold text-neutral-500 italic py-1">
                        Empty team slot
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-center font-display font-black text-sm uppercase tracking-widest text-black my-1">
                  VS
                </div>

                {/* Team 2 */}
                <div
                  className={`p-3 bg-[#fef08a] rounded-xl border-2 border-black shadow-[3px_3px_0px_0px_#000] transition-colors ${
                    activeDropZone === `court-${court.courtNumber}-t2` ? "bg-yellow-300 ring-2 ring-black" : ""
                  }`}
                  onDragOver={(e) => {
                    if (!isUnlocked) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    setActiveDropZone(`court-${court.courtNumber}-t2`);
                  }}
                  onDragLeave={() => setActiveDropZone(null)}
                  onDrop={(e) => {
                    if (!isUnlocked) return;
                    e.preventDefault();
                    setActiveDropZone(null);
                    const draggedId = e.dataTransfer.getData("text/plain") || draggedPlayerId;
                    if (draggedId) {
                      if (court.team2.length < 2 && !court.team2.includes(draggedId)) {
                        moveToTeam(draggedId, court.courtNumber, 2);
                      } else if (court.team2.length > 0) {
                        swapPlayers(draggedId, court.team2[0]);
                      }
                    }
                    setDraggedPlayerId(null);
                  }}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs uppercase font-black tracking-wider text-black block">
                      {court.team1.length <= 1 && court.team2.length <= 1 ? "Player 2" : "Team 2"}
                    </span>
                    {isUnlocked && court.team2.length > 0 && (
                      <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                        {isUnlocked ? "Drag / Tap to swap" : ""}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {court.team2.map((pId) => {
                      const isSelected = selectedPlayerId === pId;
                      return (
                        <div
                          key={pId}
                          draggable={isUnlocked}
                          onDragStart={(e) => {
                            if (!isUnlocked) return;
                            e.dataTransfer.setData("text/plain", pId);
                            setDraggedPlayerId(pId);
                          }}
                          onDragEnd={() => setDraggedPlayerId(null)}
                          onDragOver={(e) => {
                            if (!isUnlocked) return;
                            e.preventDefault();
                          }}
                          onDrop={(e) => {
                            if (!isUnlocked) return;
                            e.preventDefault();
                            e.stopPropagation();
                            const draggedId = e.dataTransfer.getData("text/plain") || draggedPlayerId;
                            if (draggedId) swapPlayers(draggedId, pId);
                            setDraggedPlayerId(null);
                          }}
                          onClick={() => handlePlayerClick(pId)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 border-black font-black text-sm text-black transition-all ${
                            isSelected
                              ? "bg-[#ccff00] ring-4 ring-black shadow-[3px_3px_0px_0px_#000] scale-105"
                              : isUnlocked
                              ? "bg-white hover:bg-neutral-50 cursor-grab active:cursor-grabbing shadow-[2px_2px_0px_0px_#000] hover:scale-[1.02]"
                              : "bg-white shadow-[2px_2px_0px_0px_#000]"
                          }`}
                        >
                          {isUnlocked && <span className="text-neutral-400 select-none text-xs">⋮⋮</span>}
                          <span>{nameFor(pId)}</span>
                          {isUnlocked && (
                            <button
                              type="button"
                              title="Bench to sitting pool"
                              onClick={(e) => {
                                e.stopPropagation();
                                moveToSitting(pId);
                                if (selectedPlayerId === pId) setSelectedPlayerId(null);
                              }}
                              className="ml-1 text-xs text-neutral-400 hover:text-black font-black px-1 rounded hover:bg-neutral-200"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      );
                    })}

                    {/* Open partner slot if team has only 1 player */}
                    {isUnlocked && court.team2.length < 2 && (
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedPlayerId) {
                            moveToTeam(selectedPlayerId, court.courtNumber, 2);
                            setSelectedPlayerId(null);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg border-2 border-dashed border-black/60 text-xs font-black uppercase text-neutral-600 transition-all ${
                          selectedPlayerId
                            ? "bg-[#ccff00]/60 hover:bg-[#ccff00] border-black text-black animate-pulse cursor-pointer"
                            : "hover:border-black hover:text-black"
                        }`}
                      >
                        + Add Partner
                      </button>
                    )}

                    {court.team2.length === 0 && (
                      <span className="text-xs font-bold text-neutral-500 italic py-1">
                        Empty team slot
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sitting Players Section */}
      <section
        className={`bg-white border-[3px] border-black rounded-2xl p-5 shadow-[6px_6px_0px_0px_#000] transition-colors ${
          activeDropZone === "sitting-pool" ? "bg-amber-50 ring-4 ring-black" : ""
        }`}
        onDragOver={(e) => {
          if (!isUnlocked) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          setActiveDropZone("sitting-pool");
        }}
        onDragLeave={() => setActiveDropZone(null)}
        onDrop={(e) => {
          if (!isUnlocked) return;
          e.preventDefault();
          setActiveDropZone(null);
          const draggedId = e.dataTransfer.getData("text/plain") || draggedPlayerId;
          if (draggedId) {
            moveToSitting(draggedId);
          }
          setDraggedPlayerId(null);
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
          <div>
            <h3 className="font-display text-xl font-black uppercase tracking-wider text-black">
              Sitting this round ({localSitting.length})
            </h3>
            <p className="text-xs font-bold text-neutral-600">
              {isUnlocked
                ? "Drag players here to sit out, or drag sitting players to an active court."
                : "These players are taking a break and will have highest priority next round."}
            </p>
          </div>

          {/* Quick Drop Zone button for tap mode */}
          {isUnlocked && selectedPlayerId && !localSitting.includes(selectedPlayerId) && (
            <button
              type="button"
              onClick={() => {
                moveToSitting(selectedPlayerId);
                setSelectedPlayerId(null);
              }}
              className="px-3 py-1.5 rounded-xl bg-[#fde047] border-2 border-black font-black uppercase text-xs text-black shadow-[2px_2px_0px_0px_#000] animate-bounce"
            >
              Move {nameFor(selectedPlayerId)} to Sitting
            </button>
          )}
        </div>

        {/* Sitting Drop Zone Callout when dragging */}
        {isUnlocked && (
          <div
            className={`mb-3 p-3 rounded-xl border-2 border-dashed border-black text-center text-xs font-black uppercase transition-all ${
              activeDropZone === "sitting-pool"
                ? "bg-[#fde047] border-black scale-[1.01]"
                : "bg-neutral-50 text-neutral-600"
            }`}
          >
            📥 Drag players here to sit out (or tap player, then tap here)
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {localSitting.map((id) => {
            const isSelected = selectedPlayerId === id;
            return (
              <span
                key={id}
                draggable={isUnlocked}
                onDragStart={(e) => {
                  if (!isUnlocked) return;
                  e.dataTransfer.setData("text/plain", id);
                  setDraggedPlayerId(id);
                }}
                onDragEnd={() => setDraggedPlayerId(null)}
                onDragOver={(e) => {
                  if (!isUnlocked) return;
                  e.preventDefault();
                }}
                onDrop={(e) => {
                  if (!isUnlocked) return;
                  e.preventDefault();
                  e.stopPropagation();
                  const draggedId = e.dataTransfer.getData("text/plain") || draggedPlayerId;
                  if (draggedId) swapPlayers(draggedId, id);
                  setDraggedPlayerId(null);
                }}
                onClick={() => handlePlayerClick(id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 border-black text-black text-sm font-black transition-all ${
                  isSelected
                    ? "bg-[#ccff00] ring-4 ring-black shadow-[3px_3px_0px_0px_#000] scale-105"
                    : isUnlocked
                    ? "bg-[#fde047] hover:bg-yellow-300 cursor-grab active:cursor-grabbing shadow-[2px_2px_0px_0px_#000] hover:scale-[1.02]"
                    : "bg-[#fde047] shadow-[2px_2px_0px_0px_#000]"
                }`}
              >
                {isUnlocked && <span className="text-neutral-500 select-none text-xs">⋮⋮</span>}
                {nameFor(id)}
              </span>
            );
          })}
          {localSitting.length === 0 && (
            <span className="text-xs font-bold text-neutral-500 italic py-1">
              No players sitting this round.
            </span>
          )}
        </div>
      </section>

      {/* Friction Modal 1: Unlock Confirmation Dialog */}
      {showUnlockModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border-[3px] border-black rounded-3xl p-6 max-w-md w-full space-y-4 shadow-[8px_8px_0px_0px_#000] text-black">
            <div className="flex items-center gap-2">
              <span className="text-2xl">⚠️</span>
              <h3 className="font-display text-2xl font-black uppercase tracking-tight text-black">
                Override Matchmaking Algorithm?
              </h3>
            </div>
            <p className="text-sm font-bold text-neutral-700 leading-relaxed">
              The matchmaking engine calculates optimal pairings for equal court time, skill balance, and partner variety.
            </p>
            <div className="p-3 bg-amber-50 rounded-xl border-2 border-black text-xs font-bold text-neutral-800 space-y-1">
              <p>• Manual changes bypass fairness algorithms.</p>
              <p>• Some players may end up playing or sitting more frequently.</p>
              <p>• Singles courts remain unrated.</p>
            </div>
            <p className="text-sm font-bold text-black">
              Are you sure you want to customize player court assignments?
            </p>
            <div className="flex gap-3 justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowUnlockModal(false)}
                className="font-display uppercase tracking-wider"
              >
                Keep Algorithm Lineup
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={() => {
                  setShowUnlockModal(false);
                  setIsUnlocked(true);
                }}
                className="font-display uppercase tracking-wider bg-[#ccff00] text-black hover:bg-[#b8eb00]"
              >
                Unlock Manual Swaps
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Friction Modal 2: Start Round Confirmation Modal */}
      {showConfirmStart && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border-[3px] border-black rounded-3xl p-6 max-w-md w-full space-y-4 shadow-[8px_8px_0px_0px_#000] text-black">
            <h3 className="font-display text-2xl font-black uppercase tracking-tight text-black">
              {hasModifications ? "Confirm Manual Lineup?" : `Start Round ${round.roundNumber}?`}
            </h3>

            {hasModifications ? (
              <div className="space-y-3">
                <div className="p-3 bg-amber-100 rounded-xl border-2 border-black text-xs font-bold text-neutral-900 space-y-1 shadow-[2px_2px_0px_0px_#000]">
                  <p className="font-black uppercase text-amber-950">
                    ⚠️ Manual Overrides Active ({modificationCount} modifications)
                  </p>
                  <p>
                    You have manually changed court assignments from the recommended algorithm proposal.
                  </p>
                </div>

                {/* Deliberate friction checkbox */}
                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-neutral-50 border-2 border-black cursor-pointer text-xs font-bold text-neutral-800">
                  <input
                    type="checkbox"
                    checked={acknowledgedOverride}
                    onChange={(e) => setAcknowledgedOverride(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-2 border-black accent-black focus:ring-0 cursor-pointer"
                  />
                  <span>
                    I confirm that I want to bypass algorithm recommendations and start this round with the custom lineup.
                  </span>
                </label>
              </div>
            ) : (
              <p className="text-sm font-bold text-neutral-700">
                Once started, court assignments and sitting players are locked in for tracking match results.
              </p>
            )}

            <div className="flex flex-wrap gap-2 justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowConfirmStart(false);
                  setAcknowledgedOverride(false);
                }}
                className="font-display uppercase tracking-wider text-xs"
              >
                Cancel
              </Button>

              {hasModifications && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    handleResetToAlgorithm();
                    setShowConfirmStart(false);
                  }}
                  className="font-display uppercase tracking-wider text-xs"
                >
                  Reset Lineup
                </Button>
              )}

              <Button
                type="button"
                variant="primary"
                onClick={handleStartConfirm}
                disabled={isPending || (hasModifications && !acknowledgedOverride) || !isValidLineup}
                className="font-display uppercase tracking-wider text-xs"
              >
                Confirm &amp; Start
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Persistent Bottom Mobile Action Area */}
      <div className="mobile-action-bar sticky bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-md border-t-[3px] border-black z-40 shadow-[0px_-4px_0px_0px_rgba(0,0,0,0.06)]">
        <div className="max-w-xl mx-auto flex items-center gap-3">
          {canRegenerate && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={onRegenerate}
              disabled={isPending}
              className="flex-1 font-display text-lg uppercase tracking-wider"
            >
              Regenerate Round
            </Button>
          )}

          {round.status === "proposed" && (
            <Button
              type="button"
              variant="primary"
              size="lg"
              onClick={() => {
                setAcknowledgedOverride(false);
                setShowConfirmStart(true);
              }}
              disabled={isPending || !isValidLineup}
              className="flex-1 font-display text-lg uppercase tracking-wider"
            >
              Start Round
            </Button>
          )}

          {round.status === "started" && (
            <Button
              type="button"
              variant="primary"
              size="lg"
              onClick={onEnterResults}
              disabled={isPending}
              className="flex-1 font-display text-lg uppercase tracking-wider"
            >
              Enter Scores
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
