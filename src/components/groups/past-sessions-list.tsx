"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export interface PastSessionMatchData {
  readonly id: string;
  readonly courtNumber: number;
  readonly team1Names: readonly string[];
  readonly team2Names: readonly string[];
  readonly team1Score: number | null;
  readonly team2Score: number | null;
  readonly status: "pending" | "completed" | "cancelled";
}

export interface PastSessionRoundData {
  readonly id: string;
  readonly roundNumber: number;
  readonly status: "started" | "completed" | "cancelled";
  readonly matches: readonly PastSessionMatchData[];
  readonly sittingNames: readonly string[];
}

export interface PastSessionData {
  readonly id: string;
  readonly courtCount: number;
  readonly currentRoundNumber: number;
  readonly status: "active" | "completed";
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly rounds: readonly PastSessionRoundData[];
  readonly totalGames: number;
}

export interface PastSessionsListProps {
  readonly groupId: string;
  readonly sessions: readonly PastSessionData[];
  readonly initialExpandedSessionIds?: Record<string, boolean>;
}

export function PastSessionsList({
  groupId,
  sessions,
  initialExpandedSessionIds,
}: PastSessionsListProps) {
  const [expandedSessionIds, setExpandedSessionIds] = useState<Record<string, boolean>>(
    initialExpandedSessionIds ?? {},
  );

  const toggleExpand = (sessionId: string) => {
    setExpandedSessionIds((prev) => ({
      ...prev,
      [sessionId]: !prev[sessionId],
    }));
  };

  if (sessions.length === 0) {
    return <p className="text-sm font-bold text-neutral-600">No sessions played yet.</p>;
  }

  return (
    <div className="divide-y-2 divide-neutral-100" data-testid="past-sessions-list">
      {sessions.map((session) => {
        const isExpanded = Boolean(expandedSessionIds[session.id]);
        const formattedDate = new Date(session.startedAt).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        });

        return (
          <div key={session.id} className="py-3.5 space-y-3" data-testid={`past-session-item-${session.id}`}>
            {/* Session Header Row */}
            <div className="flex items-center justify-between gap-3">
              <div
                className="flex-1 cursor-pointer select-none"
                onClick={() => toggleExpand(session.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleExpand(session.id);
                  }
                }}
                aria-expanded={isExpanded}
                aria-label={`Session from ${formattedDate}`}
              >
                <span className="font-bold text-black text-sm block">{formattedDate}</span>
                <span className="text-xs font-bold text-neutral-500">
                  {session.courtCount} court{session.courtCount > 1 ? "s" : ""} · {session.rounds.length} round
                  {session.rounds.length !== 1 ? "s" : ""} · {session.totalGames} game
                  {session.totalGames !== 1 ? "s" : ""}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant={session.status === "active" ? "warning" : "muted"}>
                  {session.status === "active" ? "Active" : "Completed"}
                </Badge>

                {/* Downward Arrow to expand */}
                <button
                  type="button"
                  onClick={() => toggleExpand(session.id)}
                  className="p-1.5 rounded-lg border-2 border-black bg-white hover:bg-neutral-100 active:translate-x-0.5 active:translate-y-0.5 transition-transform cursor-pointer shadow-[1px_1px_0px_0px_#000]"
                  aria-label={isExpanded ? `Collapse games for ${formattedDate}` : `Expand games for ${formattedDate}`}
                  data-testid={`expand-session-arrow-${session.id}`}
                >
                  <svg
                    className={`w-4 h-4 text-black transition-transform duration-200 ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Expanded Content: Categorized by Rounds, Sized to fit 5 games with scrolling */}
            {isExpanded && (
              <div
                className="bg-neutral-50 border-2 border-black rounded-2xl p-4 space-y-4 shadow-[3px_3px_0px_0px_#000]"
                data-testid={`expanded-session-content-${session.id}`}
              >
                {session.rounds.length === 0 ? (
                  <p className="text-xs font-bold text-neutral-500 py-1">No games played in this session.</p>
                ) : (
                  /* Container sized to fit approximately 5 games and scrollable */
                  <div
                    className="max-h-[390px] overflow-y-auto space-y-3.5 pr-1.5 scrollbar-thin"
                    data-testid={`session-games-scroll-container-${session.id}`}
                  >
                    {session.rounds.map((round) => (
                      <div key={round.id} className="space-y-2" data-testid={`round-section-${round.roundNumber}`}>
                        <div className="flex items-center justify-between text-xs font-black uppercase text-neutral-600 bg-white px-3 py-1.5 rounded-xl border-2 border-black/20 shadow-[1px_1px_0px_0px_rgba(0,0,0,0.1)]">
                          <span>Round {round.roundNumber}</span>
                          <span className="text-[10px] font-bold text-neutral-500">
                            {round.matches.length} game{round.matches.length !== 1 ? "s" : ""}
                          </span>
                        </div>

                        {round.sittingNames.length > 0 && (
                          <p className="text-[11px] font-bold text-neutral-500 pl-1">
                            Sitting out: {round.sittingNames.join(", ")}
                          </p>
                        )}

                        <div className="space-y-2">
                          {round.matches.map((m) => {
                            const isT1Winner =
                              m.team1Score !== null &&
                              m.team2Score !== null &&
                              m.team1Score > m.team2Score;
                            const isT2Winner =
                              m.team1Score !== null &&
                              m.team2Score !== null &&
                              m.team2Score > m.team1Score;

                            return (
                              <div
                                key={m.id}
                                className="p-3 bg-white border-2 border-black rounded-xl shadow-[2px_2px_0px_0px_#000] text-xs space-y-1.5"
                                data-testid={`match-card-${m.id}`}
                              >
                                <div className="flex items-center justify-between text-[11px] font-black uppercase text-neutral-600">
                                  <span>Court {m.courtNumber}</span>
                                  {m.status === "completed" &&
                                  m.team1Score !== null &&
                                  m.team2Score !== null ? (
                                    <span className="font-mono font-black text-black">
                                      {m.team1Score} – {m.team2Score}
                                    </span>
                                  ) : (
                                    <Badge
                                      variant={m.status === "cancelled" ? "muted" : "warning"}
                                      className="text-[10px] py-0 px-1.5"
                                    >
                                      {m.status === "cancelled" ? "Cancelled" : "In Play"}
                                    </Badge>
                                  )}
                                </div>

                                <div className="space-y-1 pt-0.5">
                                  <div className="flex items-center justify-between gap-2">
                                    <span
                                      className={`truncate font-bold ${
                                        isT1Winner ? "font-black text-black" : "text-neutral-800"
                                      }`}
                                    >
                                      {m.team1Names.join(" & ") || "Team 1"}
                                    </span>
                                    <span
                                      className={`font-mono text-xs px-2 py-0.5 rounded border-2 border-black font-black flex-shrink-0 ${
                                        isT1Winner
                                          ? "bg-[#ccff00] text-black shadow-[1px_1px_0px_0px_#000]"
                                          : "bg-neutral-100 text-neutral-800"
                                      }`}
                                    >
                                      {m.team1Score ?? 0}
                                    </span>
                                  </div>

                                  <div className="flex items-center justify-between gap-2">
                                    <span
                                      className={`truncate font-bold ${
                                        isT2Winner ? "font-black text-black" : "text-neutral-800"
                                      }`}
                                    >
                                      {m.team2Names.join(" & ") || "Team 2"}
                                    </span>
                                    <span
                                      className={`font-mono text-xs px-2 py-0.5 rounded border-2 border-black font-black flex-shrink-0 ${
                                        isT2Winner
                                          ? "bg-[#ccff00] text-black shadow-[1px_1px_0px_0px_#000]"
                                          : "bg-neutral-100 text-neutral-800"
                                      }`}
                                    >
                                      {m.team2Score ?? 0}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Fully expandable: Link to full session page */}
                <div className="pt-2 border-t-2 border-black/10 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-neutral-500">
                    {session.rounds.length} round{session.rounds.length !== 1 ? "s" : ""} · {session.totalGames} game{session.totalGames !== 1 ? "s" : ""}
                  </span>
                  <Link
                    href={`/g/${groupId}/sessions/${session.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black hover:bg-neutral-800 text-white font-display text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)] transition-transform active:translate-x-0.5 active:translate-y-0.5"
                    data-testid={`view-full-session-link-${session.id}`}
                  >
                    <span>View Full Session</span>
                    <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
