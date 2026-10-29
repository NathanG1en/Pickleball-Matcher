"use client";

import React, { useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { FilterablePlayerSelect } from "@/components/groups/filterable-player-select";
import { submitSessionPickupGameAction } from "@/app/actions/sessions";
import type { AttendanceRecord, MatchPlayerRecord, MatchRecord, PlayerRecord, RoundProposal, StartedRoundRecord } from "@/lib/domain/types";

export interface AddPickupGameModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly groupId: string;
  readonly sessionId: string;
  readonly players: readonly PlayerRecord[];
  readonly attendance: readonly AttendanceRecord[];
  readonly activeRound?: StartedRoundRecord | null;
  readonly activeProposal?: RoundProposal | null;
  readonly courtCount?: number;
  readonly onSuccess?: (match: MatchRecord, matchPlayers: readonly MatchPlayerRecord[]) => void;
}

export function computePlayerAvailability(
  activeRound?: StartedRoundRecord | null,
  activeProposal?: RoundProposal | null,
) {
  if (activeRound && activeRound.round.status === "started") {
    const sitting = new Set((activeRound.sits ?? []).map((s) => s.playerId));

    const finished = new Set(
      activeRound.matches
        .filter((m) => m.status === "completed")
        .flatMap((m) =>
          (activeRound.matchPlayers ?? [])
            .filter((mp) => mp.matchId === m.id)
            .map((mp) => mp.playerId),
        ),
    );

    const playing = new Map<string, number>();
    for (const match of activeRound.matches) {
      if (match.status === "pending") {
        const pids = (activeRound.matchPlayers ?? [])
          .filter((mp) => mp.matchId === match.id)
          .map((mp) => mp.playerId);
        for (const pid of pids) {
          playing.set(pid, match.courtNumber);
        }
      }
    }

    return { sitting, finished, playing };
  }

  if (activeProposal) {
    const sitting = new Set(activeProposal.sitting);
    const playing = new Map<string, number>();
    for (const court of activeProposal.courts) {
      for (const pid of [...court.team1, ...court.team2]) {
        playing.set(pid, court.courtNumber);
      }
    }
    return { sitting, finished: new Set<string>(), playing };
  }

  return {
    sitting: new Set<string>(),
    finished: new Set<string>(),
    playing: new Map<string, number>(),
  };
}

export interface PickupSlotState {
  t1p1: string;
  t1p2: string;
  t2p1: string;
  t2p2: string;
}

export function swapPickupSlot(
  current: PickupSlotState,
  targetSlot: "t1p1" | "t1p2" | "t2p1" | "t2p2",
  newPlayerId: string,
): PickupSlotState {
  if (!newPlayerId) {
    return { ...current, [targetSlot]: "" };
  }

  const previousInTarget = current[targetSlot];
  const next = { ...current };

  // If newPlayerId is already in another slot, swap: that slot gets previousInTarget
  for (const key of ["t1p1", "t1p2", "t2p1", "t2p2"] as const) {
    if (key !== targetSlot && current[key] === newPlayerId) {
      next[key] = previousInTarget;
    }
  }

  next[targetSlot] = newPlayerId;
  return next;
}

export function AddPickupGameModal({
  isOpen,
  onClose,
  groupId,
  sessionId,
  players,
  attendance,
  activeRound,
  activeProposal,
  onSuccess,
}: AddPickupGameModalProps) {
  const [matchType, setMatchType] = useState<"doubles" | "singles">("doubles");
  const [t1p1, setT1p1] = useState("");
  const [t1p2, setT1p2] = useState("");
  const [t2p1, setT2p1] = useState("");
  const [t2p2, setT2p2] = useState("");
  const [t1Score, setT1Score] = useState("");
  const [t2Score, setT2Score] = useState("");
  const [isRated, setIsRated] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Present players in session
  const presentPlayers = useMemo(() => {
    const presentIds = new Set(
      attendance.filter((a) => a.leftRound === null).map((a) => a.playerId),
    );
    return players.filter((p) => p.active && presentIds.has(p.id));
  }, [players, attendance]);

  // Compute player availability based on active round or proposal
  const playerAvailability = useMemo(
    () => computePlayerAvailability(activeRound, activeProposal),
    [activeRound, activeProposal],
  );

  // Options for player select dropdowns
  const playerOptions = useMemo(() => {
    const options = presentPlayers.map((p) => {
      let badge = "";
      let priority = 2; // Default: general checked-in

      if (playerAvailability.sitting.has(p.id)) {
        badge = " (🟢 Sitting Out)";
        priority = 0;
      } else if (playerAvailability.finished.has(p.id)) {
        badge = " (🟢 Finished Game)";
        priority = 1;
      } else if (playerAvailability.playing.has(p.id)) {
        const court = playerAvailability.playing.get(p.id);
        badge = ` (🟡 Court ${court})`;
        priority = 3;
      }

      return {
        id: p.id,
        name: `${p.name}${badge}`,
        priority,
      };
    });

    // Sort: Available players first, then general, then currently playing
    return options.sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));
  }, [presentPlayers, playerAvailability]);

  const getSlotOptions = (slotKey: "t1p1" | "t1p2" | "t2p1" | "t2p2") => {
    const activeSlots: { key: "t1p1" | "t1p2" | "t2p1" | "t2p2"; id: string }[] =
      matchType === "doubles"
        ? [
            { key: "t1p1", id: t1p1 },
            { key: "t1p2", id: t1p2 },
            { key: "t2p1", id: t2p1 },
            { key: "t2p2", id: t2p2 },
          ]
        : [
            { key: "t1p1", id: t1p1 },
            { key: "t2p1", id: t2p1 },
          ];

    const otherSelectedIds = new Set(
      activeSlots
        .filter((s) => s.key !== slotKey && Boolean(s.id))
        .map((s) => s.id),
    );

    const currentValue =
      slotKey === "t1p1"
        ? t1p1
        : slotKey === "t1p2"
        ? t1p2
        : slotKey === "t2p1"
        ? t2p1
        : t2p2;

    const mapped = playerOptions.map((opt) => {
      const isSelectedElsewhere = otherSelectedIds.has(opt.id);
      const isCurrentValue = opt.id === currentValue;

      // Group 0: Currently in this slot
      // Group 1: Selected in another slot (shown at top, marked (Selected), switches on pick)
      // Group 2: Available unselected players
      let group = 2;
      if (isCurrentValue) {
        group = 0;
      } else if (isSelectedElsewhere) {
        group = 1;
      }

      return {
        id: opt.id,
        name: opt.name,
        selectedElsewhere: isSelectedElsewhere,
        disabled: false,
        group,
        priority: opt.priority,
      };
    });

    mapped.sort((a, b) => {
      // Group 0 & 1 (selected players) stay at the top of the list
      if (a.group !== b.group) {
        return a.group - b.group;
      }
      // For unselected players, sort by availability priority
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      // Alphabetical tie-breaker
      return a.name.localeCompare(b.name);
    });

    return mapped;
  };

  const handleSelectSlot = (slotKey: "t1p1" | "t1p2" | "t2p1" | "t2p2", val: string) => {
    setError(null);
    const updated = swapPickupSlot({ t1p1, t1p2, t2p1, t2p2 }, slotKey, val);
    setT1p1(updated.t1p1);
    setT1p2(updated.t1p2);
    setT2p1(updated.t2p1);
    setT2p2(updated.t2p2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const team1PlayerIds = matchType === "doubles" ? [t1p1, t1p2].filter(Boolean) : [t1p1].filter(Boolean);
    const team2PlayerIds = matchType === "doubles" ? [t2p1, t2p2].filter(Boolean) : [t2p1].filter(Boolean);

    const expectedCount = matchType === "doubles" ? 2 : 1;
    if (team1PlayerIds.length !== expectedCount || team2PlayerIds.length !== expectedCount) {
      setError(`Please select ${expectedCount} player${expectedCount > 1 ? "s" : ""} for each team.`);
      return;
    }

    const s1 = parseInt(t1Score, 10);
    const s2 = parseInt(t2Score, 10);
    if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0) {
      setError("Please enter valid non-negative points for both teams.");
      return;
    }
    if (s1 === s2) {
      setError("Ties are not allowed. Please enter a winning score and losing score.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await submitSessionPickupGameAction({
        groupId,
        sessionId,
        team1PlayerIds,
        team2PlayerIds,
        team1Score: s1,
        team2Score: s2,
        rated: isRated,
      });

      if (res.ok) {
        setT1p1("");
        setT1p2("");
        setT2p1("");
        setT2p2("");
        setT1Score("");
        setT2Score("");
        if (onSuccess) {
          onSuccess(res.data.match, res.data.matchPlayers);
        }
        onClose();
      } else {
        setError(res.error ?? "Failed to record pickup game.");
      }
    } catch {
      setError("An unexpected error occurred while saving the game.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Pickup Game"
      description="Record a pickup match played while waiting for other courts or rounds to finish."
      size="lg"
    >
      <div className="space-y-4 pt-2 text-black">
        {/* Match Type Switcher */}
        <div className="flex border-2 border-black rounded-xl overflow-hidden shadow-[2px_2px_0px_0px_#000] w-fit">
          <button
            type="button"
            onClick={() => {
              setMatchType("doubles");
              setError(null);
            }}
            className={`py-1.5 px-4 text-xs font-black uppercase whitespace-nowrap cursor-pointer transition-colors ${
              matchType === "doubles" ? "bg-[#ccff00] text-black" : "bg-white text-neutral-600 hover:bg-neutral-50"
            }`}
          >
            Doubles (2v2)
          </button>
          <button
            type="button"
            onClick={() => {
              setMatchType("singles");
              setT1p2("");
              setT2p2("");
              setError(null);
            }}
            className={`py-1.5 px-4 text-xs font-black uppercase border-l-2 border-black whitespace-nowrap cursor-pointer transition-colors ${
              matchType === "singles" ? "bg-[#ccff00] text-black" : "bg-white text-neutral-600 hover:bg-neutral-50"
            }`}
          >
            Singles (1v1)
          </button>
        </div>

        {error && (
          <div role="alert" className="p-3 rounded-xl bg-[#ff6b6b] border-2 border-black text-black font-black text-xs shadow-[2px_2px_0px_0px_#000]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Team 1 Card */}
            <div className="p-3.5 bg-[#ccff00]/20 border-2 border-black rounded-2xl space-y-2.5 shadow-[2px_2px_0px_0px_#000]">
              <h3 className="font-display text-sm font-black uppercase text-black">Team 1</h3>
              <div className="space-y-2">
                <FilterablePlayerSelect
                  ariaLabel="Team 1 Player 1"
                  placeholder="Select Player 1..."
                  value={t1p1}
                  onChange={(val) => handleSelectSlot("t1p1", val)}
                  options={getSlotOptions("t1p1")}
                  dataTestId="pickup-team-1-player-1"
                />

                {matchType === "doubles" && (
                  <FilterablePlayerSelect
                    ariaLabel="Team 1 Player 2"
                    placeholder="Select Player 2..."
                    value={t1p2}
                    onChange={(val) => handleSelectSlot("t1p2", val)}
                    options={getSlotOptions("t1p2")}
                    dataTestId="pickup-team-1-player-2"
                  />
                )}

                <div className="pt-1">
                  <label htmlFor="pickup-team-1-score" className="block text-[11px] font-black uppercase text-black mb-1">
                    Team 1 Points
                  </label>
                  <input
                    id="pickup-team-1-score"
                    type="number"
                    min="0"
                    max="99"
                    placeholder="e.g. 11"
                    value={t1Score}
                    onChange={(e) => {
                      setT1Score(e.target.value);
                      setError(null);
                    }}
                    aria-label="Team 1 Score"
                    className="w-full p-2.5 rounded-xl border-2 border-black bg-white font-mono font-bold text-sm text-center shadow-[1px_1px_0px_0px_#000] focus:shadow-[2px_2px_0px_0px_#000] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Team 2 Card */}
            <div className="p-3.5 bg-[#fde047]/20 border-2 border-black rounded-2xl space-y-2.5 shadow-[2px_2px_0px_0px_#000]">
              <h3 className="font-display text-sm font-black uppercase text-black">Team 2</h3>
              <div className="space-y-2">
                <FilterablePlayerSelect
                  ariaLabel="Team 2 Player 1"
                  placeholder="Select Player 1..."
                  value={t2p1}
                  onChange={(val) => handleSelectSlot("t2p1", val)}
                  options={getSlotOptions("t2p1")}
                  dataTestId="pickup-team-2-player-1"
                />

                {matchType === "doubles" && (
                  <FilterablePlayerSelect
                    ariaLabel="Team 2 Player 2"
                    placeholder="Select Player 2..."
                    value={t2p2}
                    onChange={(val) => handleSelectSlot("t2p2", val)}
                    options={getSlotOptions("t2p2")}
                    dataTestId="pickup-team-2-player-2"
                  />
                )}

                <div className="pt-1">
                  <label htmlFor="pickup-team-2-score" className="block text-[11px] font-black uppercase text-black mb-1">
                    Team 2 Points
                  </label>
                  <input
                    id="pickup-team-2-score"
                    type="number"
                    min="0"
                    max="99"
                    placeholder="e.g. 9"
                    value={t2Score}
                    onChange={(e) => {
                      setT2Score(e.target.value);
                      setError(null);
                    }}
                    aria-label="Team 2 Score"
                    className="w-full p-2.5 rounded-xl border-2 border-black bg-white font-mono font-bold text-sm text-center shadow-[1px_1px_0px_0px_#000] focus:shadow-[2px_2px_0px_0px_#000] focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Rated Checkbox */}
          <div className="flex items-center gap-2 pt-1">
            <input
              id="pickup-game-rated-toggle"
              type="checkbox"
              checked={isRated}
              onChange={(e) => setIsRated(e.target.checked)}
              className="h-4 w-4 rounded border-2 border-black accent-black cursor-pointer"
            />
            <label htmlFor="pickup-game-rated-toggle" className="text-xs font-bold text-black cursor-pointer select-none">
              Count toward player ratings & session leaderboard
            </label>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t-2 border-neutral-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="font-display uppercase text-xs tracking-wider"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSubmitting}
              data-testid="submit-pickup-game-button"
              className="font-display uppercase text-xs tracking-wider"
            >
              {isSubmitting ? "Saving..." : "Submit Game"}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

