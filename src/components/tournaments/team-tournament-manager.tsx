"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { TrophyIcon, PencilIcon } from "@/components/ui/icons";
import type {
  PlayerRecord,
  TeamTournamentLine,
  TournamentRecord,
} from "@/lib/domain/types";
import {
  addTeamTournamentLineAction,
  updateTeamTournamentLineAction,
  updateTournamentNameAction,
  updateTournamentStatusAction,
} from "@/app/actions/tournaments";
import { TournamentOptionsMenu } from "@/components/tournaments/tournament-options-menu";
import { computeTeamScore } from "@/lib/tournament/team-tournament";

interface TeamTournamentManagerProps {
  readonly initialTournament: TournamentRecord;
  readonly isOrganizer: boolean;
  readonly players: readonly PlayerRecord[];
}

export function TeamTournamentManager({
  initialTournament,
  isOrganizer,
  players,
}: TeamTournamentManagerProps) {
  const [tournament, setTournament] = useState<TournamentRecord>(initialTournament);
  const [editingName, setEditingName] = useState(false);
  const [tournamentName, setTournamentName] = useState(tournament.name);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Score Entry Modal / Drawer state
  const [editingLine, setEditingLine] = useState<TeamTournamentLine | null>(null);
  const [score1Input, setScore1Input] = useState<string>("");
  const [score2Input, setScore2Input] = useState<string>("");
  const [t1PlayersInput, setT1PlayersInput] = useState<string[]>([]);
  const [t2PlayersInput, setT2PlayersInput] = useState<string[]>([]);

  // Add Line Modal State
  const [isAddingLine, setIsAddingLine] = useState(false);
  const [newLineName, setNewLineName] = useState("Line 4 - Dreambreaker");
  const [newLineType, setNewLineType] = useState<"doubles" | "singles">("singles");
  const [newLineT1Players, setNewLineT1Players] = useState<string[]>([]);
  const [newLineT2Players, setNewLineT2Players] = useState<string[]>([]);

  const playerMap = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  const teamData = tournament.teamData;
  const team1 = teamData?.teams[0];
  const team2 = teamData?.teams[1];

  const scoreSummary = useMemo(() => computeTeamScore(tournament), [tournament]);

  // Open line scoring modal
  const handleOpenScoreModal = (line: TeamTournamentLine) => {
    setEditingLine(line);
    setScore1Input(line.team1Score !== null ? String(line.team1Score) : "");
    setScore2Input(line.team2Score !== null ? String(line.team2Score) : "");
    setT1PlayersInput([...line.team1PlayerIds]);
    setT2PlayersInput([...line.team2PlayerIds]);
  };

  const handleSaveScore = async () => {
    if (!editingLine) return;
    setError(null);
    setIsPending(true);

    const s1 = score1Input.trim() === "" ? null : parseInt(score1Input, 10);
    const s2 = score2Input.trim() === "" ? null : parseInt(score2Input, 10);

    if (s1 !== null && (isNaN(s1) || s1 < 0)) {
      setError("Score must be a positive number.");
      setIsPending(false);
      return;
    }
    if (s2 !== null && (isNaN(s2) || s2 < 0)) {
      setError("Score must be a positive number.");
      setIsPending(false);
      return;
    }

    try {
      const res = await updateTeamTournamentLineAction({
        tournamentId: tournament.id,
        groupId: tournament.groupId,
        lineId: editingLine.id,
        team1Score: s1,
        team2Score: s2,
        team1PlayerIds: t1PlayersInput,
        team2PlayerIds: t2PlayersInput,
      });

      if (res.ok) {
        setTournament(res.data);
        setEditingLine(null);
      } else {
        setError(res.error);
      }
    } catch {
      setError("Failed to save line score.");
    } finally {
      setIsPending(false);
    }
  };

  const handleAddLineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLineName.trim()) return;
    setError(null);
    setIsPending(true);

    try {
      const res = await addTeamTournamentLineAction({
        tournamentId: tournament.id,
        groupId: tournament.groupId,
        name: newLineName.trim(),
        type: newLineType,
        team1PlayerIds: newLineT1Players,
        team2PlayerIds: newLineT2Players,
      });

      if (res.ok) {
        setTournament(res.data);
        setIsAddingLine(false);
        setNewLineName(`Line ${(res.data.teamData?.lines.length ?? 0) + 1} - Tiebreaker`);
        setNewLineT1Players([]);
        setNewLineT2Players([]);
      } else {
        setError(res.error);
      }
    } catch {
      setError("Failed to add line.");
    } finally {
      setIsPending(false);
    }
  };

  const handleToggleStatus = async () => {
    const nextStatus = tournament.status === "completed" ? "active" : "completed";
    setIsPending(true);
    try {
      const res = await updateTournamentStatusAction({
        tournamentId: tournament.id,
        groupId: tournament.groupId,
        status: nextStatus,
      });
      if (res.ok) {
        setTournament(res.data);
      } else {
        setError(res.error);
      }
    } catch {
      setError("Failed to update status.");
    } finally {
      setIsPending(false);
    }
  };

  const handleUpdateName = async () => {
    if (!tournamentName.trim() || tournamentName === tournament.name) {
      setEditingName(false);
      return;
    }
    setIsPending(true);
    try {
      const res = await updateTournamentNameAction({
        tournamentId: tournament.id,
        groupId: tournament.groupId,
        name: tournamentName.trim(),
      });
      if (res.ok) {
        setTournament(res.data);
        setEditingName(false);
      } else {
        setError(res.error);
      }
    } catch {
      setError("Failed to rename tournament.");
    } finally {
      setIsPending(false);
    }
  };

  const getPlayerNames = (playerIds: readonly string[]) => {
    if (playerIds.length === 0) return "TBD";
    return playerIds.map((id) => playerMap.get(id)?.name ?? "Unknown").join(" & ");
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <header className="bg-white border-[3px] border-black rounded-3xl p-5 sm:p-6 shadow-[6px_6px_0px_0px_#000] space-y-3">
        <div className="flex items-center justify-between">
          <Link
            href={`/g/${tournament.groupId}`}
            className="px-3 py-1.5 rounded-xl bg-white border-2 border-black font-black uppercase text-xs text-black shadow-[2px_2px_0px_0px_#000] hover:bg-neutral-50 active:translate-x-0.5 active:translate-y-0.5 transition-transform"
          >
            ← Back to Group
          </Link>
          <div className="flex items-center gap-2">
            <Badge variant={tournament.status === "completed" ? "success" : "default"}>
              {tournament.status === "completed" ? "Completed" : "Active"}
            </Badge>
            {isOrganizer && (
              <TournamentOptionsMenu
                groupId={tournament.groupId}
                tournamentId={tournament.id}
                tournamentName={tournament.name}
                status={tournament.status}
                onToggleStatus={handleToggleStatus}
              />
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
          <div className="min-w-0 flex-1">
            {editingName && isOrganizer ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleUpdateName();
                }}
                className="flex flex-wrap items-center gap-2"
              >
                <input
                  type="text"
                  aria-label="Tournament name"
                  required
                  value={tournamentName}
                  onChange={(e) => setTournamentName(e.target.value)}
                  className="min-w-0 max-w-xs font-display text-2xl font-black uppercase bg-white border-2 border-black rounded-xl px-3 py-1.5 shadow-[2px_2px_0px_0px_#000] focus:outline-none"
                  autoFocus
                />
                <Button
                  size="sm"
                  variant="primary"
                  type="submit"
                  disabled={isPending || !tournamentName.trim()}
                  className="font-bold uppercase"
                >
                  Save
                </Button>
                <button
                  type="button"
                  onClick={() => setEditingName(false)}
                  className="rounded-xl border-2 border-black bg-white px-3 py-1.5 text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] hover:bg-neutral-100"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="font-display text-2xl sm:text-3xl font-black uppercase text-black leading-tight">
                  {tournament.name}
                </h1>
                {isOrganizer && (
                  <button
                    type="button"
                    onClick={() => setEditingName(true)}
                    aria-label="Edit tournament name"
                    title="Edit tournament name"
                    className="inline-flex shrink-0 items-center justify-center rounded-lg border-2 border-black bg-white p-1.5 text-black shadow-[2px_2px_0px_0px_#000] hover:bg-[#fde047] active:translate-x-0.5 active:translate-y-0.5"
                  >
                    <PencilIcon className="h-2 w-2" />
                  </button>
                )}
              </div>
            )}
            <p className="text-xs font-bold text-neutral-500 mt-0.5">
              Team Clash · {scoreSummary.completedLinesCount} of {scoreSummary.totalLinesCount} lines completed
            </p>
          </div>

          {isOrganizer && tournament.status === "active" && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleToggleStatus}
                disabled={isPending}
                className="px-3 py-1.5 rounded-xl border-2 border-black font-display text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer bg-[#ccff00] hover:bg-[#b8eb00] text-black"
              >
                Finish Tournament
              </button>
            </div>
          )}
        </div>
      </header>

      {error && (
        <div role="alert" className="p-4 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-sm font-bold">
          {error}
        </div>
      )}

      {/* Main Team Scoreboard */}
      {team1 && team2 && (
        <div
          data-testid="team-scoreboard"
          className="bg-white border-4 border-black rounded-3xl p-5 sm:p-6 shadow-[6px_6px_0px_0px_#000] space-y-4"
        >
          <div className="flex items-center justify-between text-center gap-4">
            {/* Team 1 Banner */}
            <div className="flex-1 space-y-1">
              <span className="inline-block px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider text-white bg-rose-600 border border-black shadow-[1px_1px_0px_0px_#000]">
                Team 1
              </span>
              <h2 className="font-display text-xl sm:text-2xl font-black uppercase text-black truncate">
                {team1.name}
              </h2>
              <div className="font-display text-4xl sm:text-5xl font-black text-rose-600">
                {scoreSummary.teamScores[team1.id]?.wins ?? 0}
              </div>
              <p className="text-[11px] font-bold text-neutral-500">
                {scoreSummary.teamScores[team1.id]?.points ?? 0} total points
              </p>
            </div>

            {/* VS Divider */}
            <div className="px-3 py-1 rounded-xl bg-neutral-100 border-2 border-black font-display font-black text-xs uppercase text-neutral-600 shadow-[2px_2px_0px_0px_#000]">
              {scoreSummary.isTied ? "TIED" : "VS"}
            </div>

            {/* Team 2 Banner */}
            <div className="flex-1 space-y-1">
              <span className="inline-block px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider text-white bg-sky-600 border border-black shadow-[1px_1px_0px_0px_#000]">
                Team 2
              </span>
              <h2 className="font-display text-xl sm:text-2xl font-black uppercase text-black truncate">
                {team2.name}
              </h2>
              <div className="font-display text-4xl sm:text-5xl font-black text-sky-600">
                {scoreSummary.teamScores[team2.id]?.wins ?? 0}
              </div>
              <p className="text-[11px] font-bold text-neutral-500">
                {scoreSummary.teamScores[team2.id]?.points ?? 0} total points
              </p>
            </div>
          </div>

          {scoreSummary.leaderTeamId && tournament.status === "completed" && (
            <div className="pt-2 border-t-2 border-neutral-100 text-center">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#ccff00] text-black font-black text-xs uppercase border border-black shadow-[2px_2px_0px_0px_#000]">
                <TrophyIcon className="h-4 w-4" /> Winner:{" "}
                {scoreSummary.leaderTeamId === team1.id ? team1.name : team2.name}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Match Lines Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl font-black uppercase text-black">
            Match Lines &amp; Courts
          </h3>
          {isOrganizer && (
            <button
              type="button"
              data-testid="add-line-button"
              onClick={() => setIsAddingLine(true)}
              className="px-3 py-1.5 rounded-xl bg-white border-2 border-black hover:bg-neutral-50 text-black font-display text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
            >
              + Add Deciding Line
            </button>
          )}
        </div>

        <div className="space-y-3" data-testid="match-lines-list">
          {teamData?.lines.map((line) => {
            const isCompleted = line.status === "completed";
            const t1Won = isCompleted && (line.team1Score ?? 0) > (line.team2Score ?? 0);
            const t2Won = isCompleted && (line.team2Score ?? 0) > (line.team1Score ?? 0);

            return (
              <div
                key={line.id}
                className="p-4 bg-white border-2 border-black rounded-2xl shadow-[3px_3px_0px_0px_#000] space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-neutral-100 border border-black">
                      {line.type === "doubles" ? "2v2 Doubles" : "1v1 Singles"}
                    </span>
                    <h4 className="font-display font-black text-base uppercase text-black">
                      {line.name}
                    </h4>
                  </div>
                  <span
                    className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border border-black ${
                      isCompleted
                        ? "bg-[#ccff00] text-black shadow-[1px_1px_0px_0px_#000]"
                        : line.status === "in_progress"
                        ? "bg-amber-100 text-amber-900"
                        : "bg-neutral-100 text-neutral-500"
                    }`}
                  >
                    {isCompleted ? "Final" : line.status === "in_progress" ? "Live" : "Pending"}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* Team 1 Side */}
                  <div
                    className={`p-3 rounded-xl border-2 border-black flex items-center justify-between ${
                      t1Won ? "bg-rose-50" : "bg-neutral-50"
                    }`}
                  >
                    <div>
                      <span className="block text-[10px] font-black uppercase text-rose-600">
                        {team1?.name}
                      </span>
                      <span className="font-black text-xs text-black">
                        {getPlayerNames(line.team1PlayerIds)}
                      </span>
                    </div>
                    <span className="font-display text-xl font-black text-black">
                      {line.team1Score !== null ? line.team1Score : "—"}
                    </span>
                  </div>

                  {/* Team 2 Side */}
                  <div
                    className={`p-3 rounded-xl border-2 border-black flex items-center justify-between ${
                      t2Won ? "bg-sky-50" : "bg-neutral-50"
                    }`}
                  >
                    <div>
                      <span className="block text-[10px] font-black uppercase text-sky-600">
                        {team2?.name}
                      </span>
                      <span className="font-black text-xs text-black">
                        {getPlayerNames(line.team2PlayerIds)}
                      </span>
                    </div>
                    <span className="font-display text-xl font-black text-black">
                      {line.team2Score !== null ? line.team2Score : "—"}
                    </span>
                  </div>
                </div>

                {isOrganizer && (
                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleOpenScoreModal(line)}
                      className="px-3.5 py-1.5 rounded-xl bg-black hover:bg-neutral-800 text-white font-display text-xs font-black uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)] cursor-pointer"
                    >
                      {isCompleted ? "Edit Score & Players" : "Enter Score →"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Edit Score Modal */}
      {editingLine && (
        <Modal
          isOpen={true}
          onClose={() => setEditingLine(null)}
          title={`Score: ${editingLine.name}`}
        >
          <div className="space-y-4 text-black">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-black uppercase text-rose-600 mb-1">
                  {team1?.name} Score
                </label>
                <input
                  type="number"
                  min="0"
                  max="99"
                  value={score1Input}
                  onChange={(e) => setScore1Input(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-50 border-2 border-black rounded-xl font-black text-lg text-black focus:outline-none"
                  placeholder="e.g. 11"
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase text-sky-600 mb-1">
                  {team2?.name} Score
                </label>
                <input
                  type="number"
                  min="0"
                  max="99"
                  value={score2Input}
                  onChange={(e) => setScore2Input(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-50 border-2 border-black rounded-xl font-black text-lg text-black focus:outline-none"
                  placeholder="e.g. 9"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleSaveScore}
                disabled={isPending}
                className="flex-1 py-2.5 px-4 rounded-xl bg-black hover:bg-neutral-800 text-white font-display text-sm font-black uppercase cursor-pointer"
              >
                Save Score
              </button>
              <button
                type="button"
                onClick={() => setEditingLine(null)}
                className="py-2.5 px-4 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-black font-display text-sm font-black uppercase cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Add Line Modal */}
      {isAddingLine && (
        <Modal
          isOpen={true}
          onClose={() => setIsAddingLine(false)}
          title="Add Match Line / Dreambreaker"
        >
          <form onSubmit={handleAddLineSubmit} className="space-y-4 text-black">
            <div>
              <label className="block text-xs font-black uppercase text-black mb-1">
                Line Name
              </label>
              <input
                type="text"
                value={newLineName}
                onChange={(e) => setNewLineName(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-50 border-2 border-black rounded-xl font-bold text-sm text-black"
                placeholder="e.g. Line 4 - Dreambreaker"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-black mb-1">
                Line Type
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                  <input
                    type="radio"
                    name="lineType"
                    checked={newLineType === "doubles"}
                    onChange={() => setNewLineType("doubles")}
                  />
                  2v2 Doubles
                </label>
                <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                  <input
                    type="radio"
                    name="lineType"
                    checked={newLineType === "singles"}
                    onChange={() => setNewLineType("singles")}
                  />
                  1v1 Singles
                </label>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={isPending || !newLineName.trim()}
                className="flex-1 py-2.5 px-4 rounded-xl bg-black hover:bg-neutral-800 text-white font-display text-sm font-black uppercase cursor-pointer"
              >
                Add Line
              </button>
              <button
                type="button"
                onClick={() => setIsAddingLine(false)}
                className="py-2.5 px-4 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-black font-display text-sm font-black uppercase cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
