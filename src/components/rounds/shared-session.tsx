import React from "react";
import { Badge } from "@/components/ui/badge";

export interface SharedCourtData {
  readonly courtNumber: number;
  readonly team1Names: readonly string[];
  readonly team2Names: readonly string[];
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
    <div className="shared-session-view space-y-6 max-w-xl mx-auto text-black">
      {/* Header */}
      <header className="bg-white border-[3px] border-black rounded-3xl p-6 shadow-[6px_6px_0px_0px_#000]">
        <div className="flex items-center justify-between mb-2">
          <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider text-black bg-[#ccff00] border-2 border-black shadow-[2px_2px_0px_0px_#000]">
            Live Court Board
          </span>
          <Badge variant={sessionStatus === "active" ? "success" : "default"}>
            {sessionStatus === "active" ? "Live" : "Finished"}
          </Badge>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-black uppercase text-black tracking-tight">{groupName}</h1>
        <p className="font-display text-lg font-black uppercase text-neutral-800 mt-1">
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
              className={`court-card bg-white border-[3px] border-black rounded-2xl p-5 shadow-[6px_6px_0px_0px_#000] space-y-3 relative text-black ${
                isCancelled ? "opacity-60 border-neutral-400 bg-neutral-100" : ""
              }`}
            >
              <div className="flex items-center justify-between border-b-2 border-neutral-100 pb-2.5">
                <span className="font-display text-2xl font-black uppercase text-black">
                  Court {court.courtNumber}
                </span>
                <div>
                  {isCancelled && <Badge variant="muted">Cancelled</Badge>}
                  {isCompleted && <Badge variant="success">Final</Badge>}
                  {court.status === "pending" && <Badge variant="warning">In Play</Badge>}
                </div>
              </div>

              {/* Team 1 */}
              <div className="flex items-center justify-between p-3 bg-[#e0f2fe] rounded-xl border-2 border-black shadow-[3px_3px_0px_0px_#000]">
                <span className="font-black text-black text-base">
                  {court.team1Names.join(" & ")}
                </span>
                {isCompleted && (
                  <span className="font-display text-3xl font-black text-black ml-3 bg-white px-2.5 py-0.5 rounded-lg border-2 border-black shadow-[2px_2px_0px_0px_#000]">
                    {court.team1Score}
                  </span>
                )}
              </div>

              <div className="text-center font-display font-black text-xs uppercase tracking-widest text-black my-0.5">
                VS
              </div>

              {/* Team 2 */}
              <div className="flex items-center justify-between p-3 bg-[#fef08a] rounded-xl border-2 border-black shadow-[3px_3px_0px_0px_#000]">
                <span className="font-black text-black text-base">
                  {court.team2Names.join(" & ")}
                </span>
                {isCompleted && (
                  <span className="font-display text-3xl font-black text-black ml-3 bg-white px-2.5 py-0.5 rounded-lg border-2 border-black shadow-[2px_2px_0px_0px_#000]">
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
        <section className="bg-white border-[3px] border-black rounded-2xl p-5 shadow-[6px_6px_0px_0px_#000]">
          <h2 className="font-display text-xl font-black uppercase tracking-wider text-black mb-1">
            Sitting this round ({sittingPlayerNames.length})
          </h2>
          <p className="text-xs font-bold text-neutral-600 mb-3">
            Taking a breather for this round.
          </p>
          <div className="flex flex-wrap gap-2">
            {sittingPlayerNames.map((name) => (
              <span
                key={name}
                className="px-3 py-1.5 rounded-lg bg-[#fde047] border-2 border-black text-black text-sm font-black shadow-[2px_2px_0px_0px_#000]"
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
