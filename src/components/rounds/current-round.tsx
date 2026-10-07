"use client";

import React, { useState } from "react";
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
  readonly onStartRound?: () => void;
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
  const [showConfirmStart, setShowConfirmStart] = useState(false);

  const nameFor = (id: string) => playerNames[id] ?? id;

  const handleStartConfirm = () => {
    setShowConfirmStart(false);
    if (onStartRound) onStartRound();
  };

  return (
    <div className="current-round-view space-y-6 pb-28 text-black">
      {/* Round Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider text-black bg-[#ccff00] border-2 border-black shadow-[2px_2px_0px_0px_#000] mb-1">
            {round.status === "proposed" ? "Round Proposal" : "Current Round"}
          </span>
          <h1 className="font-display text-3xl sm:text-4xl font-black uppercase tracking-tight text-black">Round {round.roundNumber}</h1>
        </div>
        <div>
          {round.status === "proposed" && (
            <Badge variant="warning">Proposal Draft</Badge>
          )}
          {round.status === "started" && (
            <Badge variant="success">In Progress</Badge>
          )}
          {round.status === "completed" && (
            <Badge variant="default">Completed</Badge>
          )}
        </div>
      </div>

      {/* Courts Presentation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {courts.map((court) => (
          <div
            key={court.courtNumber}
            className="court-card bg-white border-[3px] border-black rounded-2xl p-5 shadow-[6px_6px_0px_0px_#000] text-black"
          >
            <div className="flex items-center justify-between mb-4 border-b-2 border-neutral-100 pb-3">
              <span className="font-display text-2xl font-black uppercase text-black">
                Court {court.courtNumber}
              </span>
              <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider text-black bg-[#ccff00] border-2 border-black shadow-[2px_2px_0px_0px_#000]">
                {court.team1.length === 1 ? "Singles • Unrated" : "Doubles Match"}
              </span>
            </div>

            <div className="space-y-3">
              {/* Team 1 */}
              <div className="p-3 bg-[#e0f2fe] rounded-xl border-2 border-black shadow-[3px_3px_0px_0px_#000]">
                <span className="text-xs uppercase font-black tracking-wider text-black block mb-1">
                  {court.team1.length === 1 ? "Player 1" : "Team 1"}
                </span>
                <div className="text-base font-black text-black flex items-center justify-between">
                  <span>{nameFor(court.team1[0])}</span>
                  {court.team1.length > 1 && (
                    <>
                      <span className="font-bold text-neutral-600">&amp;</span>
                      <span>{nameFor(court.team1[1])}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="text-center font-display font-black text-sm uppercase tracking-widest text-black my-1">
                VS
              </div>

              {/* Team 2 */}
              <div className="p-3 bg-[#fef08a] rounded-xl border-2 border-black shadow-[3px_3px_0px_0px_#000]">
                <span className="text-xs uppercase font-black tracking-wider text-black block mb-1">
                  {court.team2.length === 1 ? "Player 2" : "Team 2"}
                </span>
                <div className="text-base font-black text-black flex items-center justify-between">
                  <span>{nameFor(court.team2[0])}</span>
                  {court.team2.length > 1 && (
                    <>
                      <span className="font-bold text-neutral-600">&amp;</span>
                      <span>{nameFor(court.team2[1])}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Sitting Players Section */}
      {sittingPlayerIds.length > 0 && (
        <section className="bg-white border-[3px] border-black rounded-2xl p-5 shadow-[6px_6px_0px_0px_#000]">
          <h3 className="font-display text-xl font-black uppercase tracking-wider text-black mb-1">
            Sitting this round ({sittingPlayerIds.length})
          </h3>
          <p className="text-xs font-bold text-neutral-600 mb-3">
            These players are taking a break and will have highest priority next round.
          </p>
          <div className="flex flex-wrap gap-2">
            {sittingPlayerIds.map((id) => (
              <span
                key={id}
                className="px-3 py-1.5 rounded-lg bg-[#fde047] border-2 border-black text-black text-sm font-black shadow-[2px_2px_0px_0px_#000]"
              >
                {nameFor(id)}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Confirmation Modal */}
      {showConfirmStart && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border-[3px] border-black rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-[8px_8px_0px_0px_#000] text-black">
            <h3 className="font-display text-2xl font-black uppercase tracking-tight text-black">
              Start Round {round.roundNumber}?
            </h3>
            <p className="text-sm font-bold text-neutral-700">
              Once started, court assignments and sitting players are locked in for tracking match results.
            </p>
            <div className="flex gap-3 justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowConfirmStart(false)}
                className="font-display uppercase tracking-wider"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleStartConfirm}
                disabled={isPending}
                className="font-display uppercase tracking-wider"
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
              onClick={() => setShowConfirmStart(true)}
              disabled={isPending}
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
