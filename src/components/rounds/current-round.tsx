"use client";

import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface RoundCourtData {
  readonly courtNumber: number;
  readonly team1: readonly [string, string];
  readonly team2: readonly [string, string];
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
    <div className="current-round-view space-y-6 pb-28">
      {/* Round Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
            {round.status === "proposed" ? "Round Proposal" : "Current Round"}
          </span>
          <h2 className="text-2xl font-black text-white">Round {round.roundNumber}</h2>
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
            className="court-card bg-slate-900 border-2 border-slate-800 rounded-2xl p-5 shadow-sm relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
              <span className="text-lg font-black text-emerald-400">
                Court {court.courtNumber}
              </span>
              <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
                Doubles Match
              </span>
            </div>

            <div className="space-y-3">
              {/* Team 1 */}
              <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/50">
                <span className="text-xs font-semibold text-slate-400 block mb-1">
                  Team 1
                </span>
                <div className="text-base font-bold text-white flex items-center justify-between">
                  <span>{nameFor(court.team1[0])}</span>
                  <span className="text-slate-500 font-normal">&amp;</span>
                  <span>{nameFor(court.team1[1])}</span>
                </div>
              </div>

              <div className="text-center font-bold text-xs uppercase tracking-widest text-slate-500 my-1">
                VS
              </div>

              {/* Team 2 */}
              <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/50">
                <span className="text-xs font-semibold text-slate-400 block mb-1">
                  Team 2
                </span>
                <div className="text-base font-bold text-white flex items-center justify-between">
                  <span>{nameFor(court.team2[0])}</span>
                  <span className="text-slate-500 font-normal">&amp;</span>
                  <span>{nameFor(court.team2[1])}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Sitting Players Section */}
      {sittingPlayerIds.length > 0 && (
        <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
          <h3 className="text-sm font-bold uppercase tracking-wider text-amber-400 mb-2">
            Sitting this round ({sittingPlayerIds.length})
          </h3>
          <p className="text-xs text-slate-400 mb-3">
            These players are taking a break and will have highest priority next round.
          </p>
          <div className="flex flex-wrap gap-2">
            {sittingPlayerIds.map((id) => (
              <span
                key={id}
                className="px-3 py-1.5 rounded-lg bg-amber-950/40 border border-amber-800/50 text-amber-200 text-sm font-semibold"
              >
                {nameFor(id)}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Confirmation Modal */}
      {showConfirmStart && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Start Round {round.roundNumber}?</h3>
            <p className="text-sm text-slate-300">
              Once started, court assignments and sitting players are locked in for tracking match results.
            </p>
            <div className="flex gap-3 justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowConfirmStart(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleStartConfirm}
                disabled={isPending}
              >
                Confirm &amp; Start
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Persistent Bottom Mobile Action Area */}
      <div className="mobile-action-bar fixed bottom-0 left-0 right-0 p-4 bg-slate-950/90 backdrop-blur-md border-t border-slate-800 z-30">
        <div className="max-w-xl mx-auto flex items-center gap-3">
          {canRegenerate && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={onRegenerate}
              disabled={isPending}
              className="flex-1"
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
              className="flex-1 shadow-lg shadow-emerald-950/50"
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
              className="flex-1 shadow-lg shadow-emerald-950/50"
            >
              Enter Scores
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
