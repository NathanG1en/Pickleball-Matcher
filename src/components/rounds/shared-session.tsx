import React from "react";
import { Badge } from "@/components/ui/badge";

export interface SharedCourtData {
  readonly courtNumber: number;
  readonly team1Names: readonly [string, string];
  readonly team2Names: readonly [string, string];
  readonly team1Score: number | null;
  readonly team2Score: number | null;
  readonly status: "pending" | "completed" | "cancelled";
}

export interface SharedSessionViewProps {
  readonly groupName: string;
  readonly sessionStatus: "active" | "completed";
  readonly currentRoundNumber: number;
  readonly courts: readonly SharedCourtData[];
  readonly sittingPlayerNames: readonly string[];
}

export function SharedSessionView({
  groupName,
  sessionStatus,
  currentRoundNumber,
  courts,
  sittingPlayerNames,
}: SharedSessionViewProps) {
  return (
    <div className="shared-session-view space-y-6 max-w-xl mx-auto">
      {/* Header */}
      <header className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
            Live Court Board
          </span>
          <Badge variant={sessionStatus === "active" ? "success" : "default"}>
            {sessionStatus === "active" ? "Live" : "Finished"}
          </Badge>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-white">{groupName}</h1>
        <p className="text-sm font-semibold text-slate-300 mt-1">
          Round {currentRoundNumber}
        </p>
      </header>

      {/* Courts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {courts.map((court) => {
          const isCompleted = court.status === "completed";
          const isCancelled = court.status === "cancelled";

          return (
            <div
              key={court.courtNumber}
              className={`court-card bg-slate-900 border-2 rounded-2xl p-5 shadow-sm space-y-3 ${
                isCompleted
                  ? "border-emerald-800/80 bg-slate-900/90"
                  : isCancelled
                  ? "border-slate-800 opacity-60"
                  : "border-slate-800"
              }`}
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <span className="text-base font-black text-emerald-400">
                  Court {court.courtNumber}
                </span>
                <div>
                  {isCancelled && <Badge variant="muted">Cancelled</Badge>}
                  {isCompleted && <Badge variant="success">Final</Badge>}
                  {court.status === "pending" && <Badge variant="warning">In Play</Badge>}
                </div>
              </div>

              {/* Team 1 */}
              <div className="flex items-center justify-between p-3 bg-slate-800/60 rounded-xl border border-slate-700/50">
                <span className="font-bold text-white text-base">
                  {court.team1Names[0]} &amp; {court.team1Names[1]}
                </span>
                {isCompleted && (
                  <span className="text-2xl font-black text-emerald-400 ml-3">
                    {court.team1Score}
                  </span>
                )}
              </div>

              <div className="text-center font-bold text-xs uppercase tracking-widest text-slate-500 my-0.5">
                VS
              </div>

              {/* Team 2 */}
              <div className="flex items-center justify-between p-3 bg-slate-800/60 rounded-xl border border-slate-700/50">
                <span className="font-bold text-white text-base">
                  {court.team2Names[0]} &amp; {court.team2Names[1]}
                </span>
                {isCompleted && (
                  <span className="text-2xl font-black text-emerald-400 ml-3">
                    {court.team2Score}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Sitting Players */}
      {sittingPlayerNames.length > 0 && (
        <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wider text-amber-400 mb-2">
            Sitting this round ({sittingPlayerNames.length})
          </h2>
          <div className="flex flex-wrap gap-2">
            {sittingPlayerNames.map((name) => (
              <span
                key={name}
                className="px-3 py-1.5 rounded-lg bg-amber-950/40 border border-amber-800/50 text-amber-200 text-sm font-semibold"
              >
                {name}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
