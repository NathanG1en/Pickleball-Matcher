"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BackButton } from "@/components/groups/back-button";
import { InfoIcon, ShuffleIcon } from "@/components/ui/icons";
import { saveTemporaryGroupAction } from "@/app/actions/temporary";
import { generateRound } from "@/lib/matchmaking/generate-round";
import type { GeneratedRound } from "@/lib/matchmaking/types";
import type { TemporaryGroupState, TemporaryRound } from "@/lib/temporary/types";

const STORAGE_KEY = "pickleball-temporary-group-v1";
const TEMP_CHANGE_EVENT = "pickleball-temporary-group-change";

interface TemporarySetupDraft {
  groupName: string;
  playerNames: string;
  courtCount: number;
  courtSizes: (2 | 3 | 4)[];
  publicOnSave: boolean;
}

interface TemporaryStoredData {
  group: TemporaryGroupState | null;
  draft: TemporarySetupDraft;
}

const EMPTY_DRAFT: TemporarySetupDraft = { groupName: "", playerNames: "", courtCount: 1, courtSizes: [4], publicOnSave: false };

function subscribeTemporaryState(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(TEMP_CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(TEMP_CHANGE_EVENT, callback);
  };
}

function getTemporarySnapshot() {
  return window.localStorage.getItem(STORAGE_KEY);
}

function parseTemporarySnapshot(snapshot: string | null): TemporaryStoredData {
  if (!snapshot) return { group: null, draft: EMPTY_DRAFT };
  try {
    const saved = JSON.parse(snapshot) as TemporaryStoredData | TemporaryGroupState;
    if ("group" in saved && "draft" in saved) return saved as TemporaryStoredData;
    return { group: saved as TemporaryGroupState, draft: EMPTY_DRAFT };
  } catch {
    return { group: null, draft: EMPTY_DRAFT };
  }
}

export interface TemporaryGroupClientProps {
  readonly accountId: string | null;
  readonly userGroups?: readonly {
    readonly id: string;
    readonly name: string;
    readonly players?: readonly { readonly id: string; readonly name: string }[];
  }[];
  readonly initialStoredData?: TemporaryStoredData;
}

export function TemporaryGroupClient({
  accountId,
  userGroups = [],
  initialStoredData,
}: TemporaryGroupClientProps) {
  const router = useRouter();
  const snapshot = useSyncExternalStore(subscribeTemporaryState, getTemporarySnapshot, () => null);
  const stored = useMemo(() => {
    if (snapshot !== null) return parseTemporarySnapshot(snapshot);
    if (initialStoredData) return initialStoredData;
    return parseTemporarySnapshot(null);
  }, [snapshot, initialStoredData]);
  const state = stored.group;
  const { groupName, playerNames, courtCount, courtSizes } = stored.draft;
  const [showExitWarning, setShowExitWarning] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showStorageTooltip, setShowStorageTooltip] = useState(false);

  const [saveDestination, setSaveDestination] = useState<"new" | "existing">(
    userGroups.length > 0 ? "existing" : "new",
  );
  const [selectedGroupId, setSelectedGroupId] = useState<string>(
    userGroups[0]?.id ?? "",
  );
  const [playerMappings, setPlayerMappings] = useState<Record<string, string>>({});

  const currentGroup = userGroups.find((g) => g.id === selectedGroupId);
  const groupRoster = useMemo(() => currentGroup?.players ?? [], [currentGroup]);

  const unincorporatedNameMatches = useMemo(() => {
    if (!currentGroup || saveDestination !== "existing") return [];
    const matches: { tempPlayer: { id: string; name: string }; existingPlayer: { id: string; name: string } }[] = [];
    for (const tempPlayer of state?.players ?? []) {
      const tempNameLower = tempPlayer.name.trim().toLowerCase();
      const existing = groupRoster.find(
        (p) => p.name.trim().toLowerCase() === tempNameLower
      );
      if (existing) {
        const mappedId = playerMappings[tempPlayer.id];
        if (mappedId !== existing.id) {
          matches.push({ tempPlayer, existingPlayer: existing });
        }
      }
    }
    return matches;
  }, [currentGroup, saveDestination, groupRoster, state?.players, playerMappings]);

  const persist = (next: TemporaryStoredData) => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(TEMP_CHANGE_EVENT));
  };
  const setAndPersist = (next: TemporaryGroupState) => persist({ ...stored, group: next });
  const updateDraft = (changes: Partial<TemporarySetupDraft>) => persist({ ...stored, draft: { ...stored.draft, ...changes } });

  const parsedNames = useMemo(() => playerNames.split(/[\n,]/).map((name) => name.trim()).filter(Boolean), [playerNames]);
  const courtCapacity = courtSizes.slice(0, courtCount).reduce((sum, size) => sum + size, 0);
  const playingCapacity = state?.courtPlayerCounts.reduce((sum, size) => sum + size, 0) ?? 0;
  const hasTemporaryState = state !== null || Boolean(playerNames.trim());
  const temporaryReturn = encodeURIComponent("/temporary?save=1");

  useEffect(() => {
    if (!hasTemporaryState) return;
    const temporaryUrl = window.location.href;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const guardBack = (event: PopStateEvent) => {
      event.stopImmediatePropagation();
      window.history.pushState({ temporaryGroupGuard: true }, "", temporaryUrl);
      setShowExitWarning(true);
    };
    window.addEventListener("beforeunload", warn);
    window.history.pushState({ temporaryGroupGuard: true }, "", window.location.href);
    window.addEventListener("popstate", guardBack, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      window.removeEventListener("popstate", guardBack, true);
    };
  }, [hasTemporaryState]);

  const handleBack = () => {
    if (hasTemporaryState) {
      setShowExitWarning(true);
    } else if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  };

  const begin = (event: React.FormEvent) => {
    event.preventDefault();
    const players = parsedNames.map((name) => ({ id: crypto.randomUUID(), name, rating: 1_000 }));
    if (players.length < 2 || players.length > 24 || courtCapacity > players.length) return;
    setAndPersist({
      name: (groupName || "Quick Session").trim(),
      isPublic: false,
      courtPlayerCounts: courtSizes.slice(0, courtCount),
      players,
      rounds: [],
      currentRound: null,
    });
  };

  const generateProposal = (roundNumber: number) => {
    if (!state) return null;
    const games = new Map<string, number>();
    for (const round of state.rounds) for (const court of round.courts) {
      for (const id of [...court.team1, ...court.team2]) games.set(id, (games.get(id) ?? 0) + 1);
    }
    const lastSitting = new Set(state.rounds.at(-1)?.sitting ?? []);
    const players = state.players.map((player) => ({
      ...player,
      gamesPlayed: games.get(player.id) ?? 0,
      eligibleRounds: state.rounds.length,
      satPreviousRound: lastSitting.has(player.id),
    }));
    const seed = Math.floor(Math.random() * 0xffff_ffff);
    const result = generateRound({
      players,
      courts: state.courtPlayerCounts.length,
      courtPlayerCounts: state.courtPlayerCounts,
      pairHistory: [],
      seed,
    });
    if (!result.ok) {
      setSaveError(result.error.message);
      return null;
    }
    setSaveError(null);
    return fromProposal(result.value, roundNumber);
  };

  const propose = () => {
    if (!state) return;
    const proposal = generateProposal(state.rounds.length + 1);
    if (proposal) {
      setAndPersist({ ...state, currentRound: proposal });
    }
  };

  const reshuffle = () => {
    if (!state?.currentRound) return;
    const hasScores = state.currentRound.courts.some((c) => c.team1Score !== null || c.team2Score !== null);
    if (
      hasScores &&
      typeof window !== "undefined" &&
      typeof window.confirm === "function" &&
      !window.confirm(
        `Are you sure you want to reshuffle Round ${state.currentRound.roundNumber} matchups? Any entered match scores for this round will be reset.`
      )
    ) {
      return;
    }
    const proposal = generateProposal(state.currentRound.roundNumber);
    if (proposal) {
      setAndPersist({ ...state, currentRound: proposal });
    }
  };

  const setScore = (courtIndex: number, team: 1 | 2, rawScore: string) => {
    if (!state?.currentRound) return;
    const score = rawScore === "" ? null : Number(rawScore);
    const courts = state.currentRound.courts.map((court, index) => index !== courtIndex ? court : {
      ...court,
      [team === 1 ? "team1Score" : "team2Score"]: Number.isSafeInteger(score) && score! >= 0 ? score : null,
    });
    setAndPersist({ ...state, currentRound: { ...state.currentRound, courts } });
  };

  const commitRound = () => {
    if (!state?.currentRound || !isRoundScored(state.currentRound)) return;
    setAndPersist({ ...state, rounds: [...state.rounds, state.currentRound], currentRound: null });
  };

  const saveToAccount = async () => {
    if (!state || !accountId) {
      setShowExitWarning(true);
      return;
    }
    setSaving(true);
    setSaveError(null);

    const isAttachingExisting = saveDestination === "existing" && Boolean(selectedGroupId);

    const result = await saveTemporaryGroupAction({
      name: state.name || "Quick Session",
      isPublic: state.isPublic,
      courtPlayerCounts: state.courtPlayerCounts,
      players: state.players,
      rounds: state.rounds,
      currentRound: state.currentRound,
      targetGroupId: isAttachingExisting ? selectedGroupId : undefined,
      playerMappings: isAttachingExisting ? playerMappings : undefined,
    });
    if (!result.ok || !result.groupId) {
      setSaveError(result.error ?? "Unable to save this session.");
      setSaving(false);
      return;
    }
    window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event(TEMP_CHANGE_EVENT));
    router.replace(`/g/${result.groupId}`);
    router.refresh();
  };

  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-xl mx-auto space-y-6 pb-24 text-black">
      <header className="rounded-3xl border-[3px] border-black bg-white p-6 shadow-[6px_6px_0px_0px_#000] space-y-4">
        <div className="flex items-center justify-between gap-2">
          <BackButton
            onClick={handleBack}
            className="px-3 py-1.5 rounded-xl bg-white border-2 border-black font-black uppercase text-xs text-black shadow-[2px_2px_0px_0px_#000] hover:bg-neutral-50 active:translate-x-0.5 active:translate-y-0.5 transition-transform cursor-pointer"
          />
          <div className="flex items-center gap-2">
            {!accountId ? (
              <Link
                href={`/player-login?next=${temporaryReturn}`}
                className="px-3.5 py-1.5 rounded-xl bg-[#ccff00] hover:bg-[#b8eb00] border-2 border-black font-display font-black uppercase text-xs text-black shadow-[2px_2px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
              >
                Sign In
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#dcfce7] border-2 border-black font-display font-black uppercase text-xs text-black shadow-[2px_2px_0px_0px_#000]">
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                Signed In
              </span>
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-black bg-[#fde047] px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-black shadow-[1px_1px_0px_0px_#000]">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" />
              Quick Session · Browser only
            </span>
            <div
              className="relative inline-flex items-center"
              onMouseEnter={() => setShowStorageTooltip(true)}
              onMouseLeave={() => setShowStorageTooltip(false)}
            >
              <button
                type="button"
                onClick={() => setShowStorageTooltip((prev) => !prev)}
                onFocus={() => setShowStorageTooltip(true)}
                onBlur={() => setShowStorageTooltip(false)}
                aria-label="Browser storage details"
                title="Browser storage details"
                data-testid="browser-storage-info-button"
                className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-black/40 bg-neutral-100 text-neutral-700 hover:bg-neutral-200 hover:text-black transition-all cursor-pointer"
              >
                <InfoIcon className="h-2.5 w-2.5" />
              </button>

              {showStorageTooltip && (
                <>
                  <div
                    className="fixed inset-0 z-40 sm:hidden"
                    onClick={() => setShowStorageTooltip(false)}
                    aria-hidden="true"
                  />
                  <div
                    role="tooltip"
                    data-testid="browser-storage-tooltip"
                    className="absolute left-0 sm:left-6 top-6 sm:top-1/2 sm:-translate-y-1/2 z-50 w-64 max-w-[calc(100vw-5rem)] rounded-xl border-2 border-black bg-white p-3 text-left shadow-[4px_4px_0px_0px_#000] text-black"
                  >
                    <p className="text-xs font-bold leading-relaxed text-neutral-800">
                      Quick sessions stay in this browser. You can {accountId ? "" : "sign in anytime to "}save your session into a new or existing group anytime.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
          <h1 className="mt-2 font-display text-3xl sm:text-4xl font-black uppercase tracking-tight text-black">
            {state?.name || "Quick Session"}
          </h1>
          <p className="mt-1 text-xs font-bold text-neutral-600">
            {state
              ? "Stored in your browser only. Save this session into a new or existing group anytime."
              : "Fast pickup round-robin with fair rotations. Stored in this browser until saved."}
          </p>
        </div>
      </header>

      {state ? (
        <>
          <section className="rounded-3xl border-[3px] border-black bg-[#fef08a] p-5 sm:p-6 shadow-[6px_6px_0px_0px_#000] space-y-4">
            <div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider text-black bg-white border border-black shadow-[1px_1px_0px_0px_#000]">
                Save Session
              </span>
              <h2 className="mt-2 font-display text-2xl font-black uppercase text-black">
                {accountId ? "Save Your Session" : "Keep Your History"}
              </h2>
              <p className="mt-1 text-xs font-bold text-neutral-800 leading-relaxed">
                {accountId
                  ? "Choose whether to create a new group or attach this session to an existing group you organize."
                  : "Sign in to permanently save this session into a new group or attach it to an existing group you organize."}
              </p>
            </div>

            {accountId && userGroups.length > 0 && (
              <div className="grid grid-cols-2 gap-2 bg-yellow-200/60 p-1.5 rounded-2xl border-2 border-black">
                <button
                  type="button"
                  onClick={() => setSaveDestination("existing")}
                  className={`py-2 px-3 rounded-xl font-display text-xs font-black uppercase transition-all ${
                    saveDestination === "existing"
                      ? "bg-black text-[#ccff00] shadow-[2px_2px_0px_0px_#000]"
                      : "bg-transparent text-black hover:bg-yellow-300"
                  }`}
                >
                  Add to Existing Group
                </button>
                <button
                  type="button"
                  onClick={() => setSaveDestination("new")}
                  className={`py-2 px-3 rounded-xl font-display text-xs font-black uppercase transition-all ${
                    saveDestination === "new"
                      ? "bg-black text-[#ccff00] shadow-[2px_2px_0px_0px_#000]"
                      : "bg-transparent text-black hover:bg-yellow-300"
                  }`}
                >
                  Create New Group
                </button>
              </div>
            )}

            {accountId && saveDestination === "existing" && userGroups.length > 0 ? (
              <div className="space-y-3">
                <label className="block text-xs font-black uppercase text-black">
                  Select Group
                  <select
                    value={selectedGroupId}
                    onChange={(e) => {
                      setSelectedGroupId(e.target.value);
                      setPlayerMappings({});
                    }}
                    className="mt-1 w-full rounded-xl border-2 border-black bg-white px-3.5 py-2.5 text-sm font-bold shadow-[2px_2px_0px_0px_#000] focus:outline-none focus:ring-2 focus:ring-black cursor-pointer"
                  >
                    {userGroups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                </label>

                {unincorporatedNameMatches.length > 0 && (
                  <div
                    role="alert"
                    data-testid="unincorporated-name-matches-notice"
                    className="rounded-2xl border-2 border-black bg-[#fee2e2] p-4 text-xs font-bold text-red-950 shadow-[3px_3px_0px_0px_#000] space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display text-xs font-black uppercase tracking-wide text-red-900 flex items-center gap-1.5">
                        <span>⚠️</span> Matching Names Not Incorporated
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = { ...playerMappings };
                          for (const match of unincorporatedNameMatches) {
                            updated[match.tempPlayer.id] = match.existingPlayer.id;
                          }
                          setPlayerMappings(updated);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-black text-[#ccff00] font-display text-[10px] font-black uppercase shadow-[1px_1px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
                      >
                        Merge Matching
                      </button>
                    </div>
                    <p className="text-xs leading-relaxed text-red-900">
                      The following session players match existing group members by name but are currently set to create new guests:
                    </p>
                    <ul className="list-disc list-inside space-y-0.5 text-red-950 font-bold">
                      {unincorporatedNameMatches.map(({ tempPlayer, existingPlayer }) => (
                        <li key={tempPlayer.id}>
                          <span className="font-black text-black">&quot;{tempPlayer.name}&quot;</span> matches roster member <span className="font-black text-black">&quot;{existingPlayer.name}&quot;</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-black uppercase text-black">
                      Merge Session Players into Roster
                    </label>
                    <span className="text-[10px] font-bold text-neutral-600">
                      Link to members or add as new
                    </span>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {state.players.map((player) => (
                      <div
                        key={player.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl border-2 border-black bg-white shadow-[2px_2px_0px_0px_#000]"
                      >
                        <span className="font-display text-xs font-black uppercase text-black truncate max-w-[140px]">
                          {player.name}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black text-neutral-400">→</span>
                          <select
                            aria-label={`Merge ${player.name}`}
                            value={playerMappings[player.id] ?? ""}
                            onChange={(e) =>
                              setPlayerMappings((prev) => ({
                                ...prev,
                                [player.id]: e.target.value,
                              }))
                            }
                            className="w-full sm:w-52 rounded-lg border-2 border-black bg-neutral-50 px-2 py-1.5 text-xs font-bold text-black focus:outline-none focus:ring-2 focus:ring-black cursor-pointer"
                          >
                            <option value="">(Create New Guest)</option>
                            {groupRoster.map((rosterPlayer) => (
                              <option key={rosterPlayer.id} value={rosterPlayer.id}>
                                Merge into {rosterPlayer.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={saveToAccount}
                  disabled={saving || !selectedGroupId}
                  className="w-full rounded-2xl border-2 border-black bg-[#ccff00] hover:bg-[#b8eb00] px-4 py-3 font-display text-sm font-black uppercase tracking-wide shadow-[3px_3px_0px_0px_#000] hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  {saving ? "Attaching Session…" : "Attach Session to Group →"}
                </button>
              </div>
            ) : accountId ? (
              <div className="space-y-3">
                <label className="block text-xs font-black uppercase text-black">
                  Group name
                  <input
                    aria-label="Temporary group name"
                    maxLength={80}
                    value={state.name}
                    onChange={(event) => setAndPersist({ ...state, name: event.target.value })}
                    className="mt-1 w-full rounded-xl border-2 border-black bg-white px-3.5 py-2.5 text-sm font-bold shadow-[2px_2px_0px_0px_#000] focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </label>
                <button
                  type="button"
                  onClick={saveToAccount}
                  disabled={saving}
                  className="w-full rounded-2xl border-2 border-black bg-[#ccff00] hover:bg-[#b8eb00] px-4 py-3 font-display text-sm font-black uppercase tracking-wide shadow-[3px_3px_0px_0px_#000] hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  {saving ? "Creating Group & Saving Session…" : "Create Group & Save Session →"}
                </button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                <Link
                  href={`/player-login?next=${temporaryReturn}`}
                  className="flex-1 rounded-xl border-2 border-black bg-[#ccff00] hover:bg-[#b8eb00] px-4 py-2.5 text-center font-display text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
                >
                  Sign in to save
                </Link>
                <Link
                  href={`/player-signup?next=${temporaryReturn}`}
                  className="rounded-xl border-2 border-black bg-white hover:bg-neutral-100 px-4 py-2.5 text-center font-display text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
                >
                  Sign up
                </Link>
              </div>
            )}
          </section>

          {saveError && (
            <p role="alert" className="rounded-2xl border-2 border-black bg-[#fee2e2] p-4 text-sm font-bold text-red-900 shadow-[3px_3px_0px_0px_#000]">
              {saveError}
            </p>
          )}

          <section className="space-y-4 rounded-3xl border-[3px] border-black bg-white p-5 sm:p-6 shadow-[6px_6px_0px_0px_#000]">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl font-black uppercase">Players</h2>
              <span className="text-xs font-black uppercase px-2.5 py-0.5 rounded-full bg-neutral-100 border border-black shadow-[1px_1px_0px_0px_#000]">
                {state.players.length} total
              </span>
            </div>
            <ul className="flex flex-wrap gap-2">
              {state.players.map((player) => (
                <li key={player.id} className="rounded-xl border-2 border-black bg-[#e0f2fe] px-3 py-1.5 text-sm font-bold shadow-[2px_2px_0px_0px_#000]">
                  {player.name}
                </li>
              ))}
            </ul>
            <p className="text-xs font-bold text-neutral-600 pt-1 border-t border-dashed border-neutral-300">
              {state.courtPlayerCounts.length} court{state.courtPlayerCounts.length === 1 ? "" : "s"} · {playingCapacity} playing · {state.players.length - playingCapacity} sitting out
            </p>
          </section>

          <section className="space-y-5">
            {state.currentRound ? (
              <section className="space-y-4 rounded-3xl border-[3px] border-black bg-[#ccff00] p-5 sm:p-6 shadow-[6px_6px_0px_0px_#000]">
                <div className="flex items-center justify-between">
                  <span className="inline-block px-2.5 py-0.5 rounded-full bg-black text-[#ccff00] text-[10px] font-black uppercase tracking-wider">
                    Active Game
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase text-black">
                      Round {state.currentRound.roundNumber}
                    </span>
                    <button
                      type="button"
                      onClick={reshuffle}
                      data-testid="reshuffle-round-button"
                      aria-label="Reshuffle matchups"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white hover:bg-neutral-100 border-2 border-black font-display font-black uppercase text-xs text-black shadow-[2px_2px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
                    >
                      <ShuffleIcon className="h-3.5 w-3.5 shrink-0" />
                      <span>Reshuffle</span>
                    </button>
                  </div>
                </div>

                <h3 className="font-display text-2xl font-black uppercase text-black">
                  Round {state.currentRound.roundNumber} · Enter scores
                </h3>

                <div className="space-y-3">
                  {state.currentRound.courts.map((court, index) => (
                    <div key={court.courtNumber} className="rounded-2xl border-2 border-black bg-white p-4 shadow-[3px_3px_0px_0px_#000] space-y-3">
                      <div className="flex items-center justify-between border-b-2 border-neutral-100 pb-2">
                        <span className="font-display text-xl font-black uppercase">Court {court.courtNumber}</span>
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md border border-black bg-[#fef08a]">
                          {court.team1.length + court.team2.length === 3 ? "2v1 · Unrated" : court.team1.length === 1 ? "Singles · Unrated" : "Doubles"}
                        </span>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-3 p-2.5 bg-neutral-50 rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_#000]">
                          <span className="text-sm font-black truncate">{court.team1.map((id) => playerName(state.players, id)).join(" & ")}</span>
                          <input
                            aria-label={`Court ${court.courtNumber} team 1 score`}
                            type="number"
                            min="0"
                            step="1"
                            value={court.team1Score ?? ""}
                            onChange={(event) => setScore(index, 1, event.target.value)}
                            placeholder="0"
                            className="w-16 h-10 rounded-lg border-2 border-black bg-white font-display text-xl font-black text-center shadow-[2px_2px_0px_0px_#000] focus:outline-none"
                          />
                        </div>

                        <div className="text-center font-display font-black text-xs uppercase tracking-widest text-neutral-500">
                          VS
                        </div>

                        <div className="flex items-center justify-between gap-3 p-2.5 bg-neutral-50 rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_#000]">
                          <span className="text-sm font-black truncate">{court.team2.map((id) => playerName(state.players, id)).join(" & ")}</span>
                          <input
                            aria-label={`Court ${court.courtNumber} team 2 score`}
                            type="number"
                            min="0"
                            step="1"
                            value={court.team2Score ?? ""}
                            onChange={(event) => setScore(index, 2, event.target.value)}
                            placeholder="0"
                            className="w-16 h-10 rounded-lg border-2 border-black bg-white font-display text-xl font-black text-center shadow-[2px_2px_0px_0px_#000] focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl border-2 border-black bg-white p-3 text-xs font-bold shadow-[2px_2px_0px_0px_#000]">
                  Sitting: {state.currentRound.sitting.map((id) => playerName(state.players, id)).join(", ") || "Nobody"}
                </div>

                {!isRoundScored(state.currentRound) && (
                  <p className="text-xs font-bold text-neutral-900 bg-amber-100 rounded-lg p-2.5 border border-black">
                    Enter a whole, non-tied score for every court to save this round.
                  </p>
                )}

                <button
                  type="button"
                  disabled={!isRoundScored(state.currentRound)}
                  onClick={commitRound}
                  className="w-full rounded-2xl border-2 border-black bg-black hover:bg-neutral-900 text-[#ccff00] px-4 py-3.5 font-display text-base font-black uppercase tracking-wider shadow-[4px_4px_0px_0px_#000] hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 transition-all disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                >
                  Save Round
                </button>
              </section>
            ) : (
              <button
                type="button"
                onClick={propose}
                className="w-full rounded-2xl border-2 border-black bg-[#ccff00] hover:bg-[#b8eb00] px-4 py-3.5 font-display text-lg font-black uppercase tracking-wide shadow-[4px_4px_0px_0px_#000] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#000] transition-all cursor-pointer"
              >
                {state.rounds.length ? "Generate Next Round" : "Generate First Round"}
              </button>
            )}

            <section className="space-y-4 rounded-3xl border-[3px] border-black bg-white p-5 sm:p-6 shadow-[6px_6px_0px_0px_#000]">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-2xl font-black uppercase">Completed Rounds</h2>
                <span className="text-xs font-black uppercase px-2.5 py-0.5 rounded-full bg-neutral-100 border border-black shadow-[1px_1px_0px_0px_#000]">
                  {state.rounds.length} saved
                </span>
              </div>

              {state.rounds.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-neutral-300 p-6 text-center text-xs font-bold text-neutral-500">
                  No completed rounds yet. Generate a round to begin play.
                </div>
              ) : (
                state.rounds.map((round) => (
                  <RoundSummary key={round.roundNumber} round={round} players={state.players} />
                ))
              )}
            </section>
          </section>
        </>
      ) : (
        <form
          onSubmit={begin}
          data-hydrated="true"
          className="space-y-5 rounded-3xl border-[3px] border-black bg-white p-6 shadow-[6px_6px_0px_0px_#000]"
        >
          <div className="space-y-1">
            <label className="block text-xs font-black uppercase tracking-wide">
              Player names · one per line
            </label>
            <textarea
              required
              rows={6}
              value={playerNames}
              aria-label="Player names · one per line"
              onChange={(event) => {
                const value = event.target.value;
                const count = value.split(/[\n,]/).map((name) => name.trim()).filter(Boolean).length;
                const courts = count < 2 ? 1 : Math.min(6, Math.max(1, Math.floor(count / 4) + (count % 4 >= 2 ? 1 : 0)));
                updateDraft({ playerNames: value, courtCount: courts, courtSizes: defaultCourtSizes(count, courts) });
              }}
              placeholder="Alex&#10;Jamie&#10;Morgan&#10;Riley"
              className="w-full rounded-xl border-2 border-black bg-white px-3.5 py-2.5 text-base font-bold normal-case shadow-[2px_2px_0px_0px_#000] focus:outline-none focus:ring-2 focus:ring-[#ccff00] transition-shadow placeholder:font-normal placeholder:text-neutral-400"
            />
            <p className="text-xs font-bold text-neutral-600 pt-0.5">
              {parsedNames.length} names entered · 2 to 24 players
            </p>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-black uppercase tracking-wide">
              Number of courts
            </label>
            <select
              value={courtCount}
              aria-label="Number of courts"
              onChange={(event) => {
                const count = Number(event.target.value);
                updateDraft({ courtCount: count, courtSizes: defaultCourtSizes(parsedNames.length, count) });
              }}
              className="w-full rounded-xl border-2 border-black bg-white px-3.5 py-2.5 text-base font-bold shadow-[2px_2px_0px_0px_#000] focus:outline-none focus:ring-2 focus:ring-[#ccff00] transition-shadow"
            >
              {Array.from({ length: Math.max(1, Math.min(6, Math.floor(parsedNames.length / 2))) }, (_, index) => index + 1).map((count) => (
                <option key={count} value={count}>{count} {count === 1 ? "court" : "courts"}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            {courtSizes.slice(0, courtCount).map((size, index) => (
              <label key={index} className="flex items-center justify-between gap-3 rounded-xl border-2 border-black bg-neutral-50 p-3 text-sm font-black shadow-[2px_2px_0px_0px_#000]">
                <span>Court {index + 1}</span>
                <select
                  value={size}
                  aria-label={`Court ${index + 1}`}
                  onChange={(event) => updateDraft({ courtSizes: courtSizes.map((value, item) => item === index ? Number(event.target.value) as 2 | 3 | 4 : value) })}
                  className="rounded-lg border-2 border-black bg-white px-2 py-1 text-xs font-bold shadow-[1px_1px_0px_0px_#000]"
                >
                  {[4, 3, 2].map((amount) => (
                    <option key={amount} value={amount}>{amount} players · {amount === 4 ? "2v2" : amount === 3 ? "2v1" : "1v1"}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          {courtCapacity > parsedNames.length && (
            <p className="rounded-xl border-2 border-black bg-[#fee2e2] p-3 text-sm font-bold text-red-900 shadow-[2px_2px_0px_0px_#000]">
              Court sizes exceed the number of players.
            </p>
          )}
          {courtCapacity <= parsedNames.length && parsedNames.length >= 2 && (
            <p className="text-xs font-bold text-neutral-700 bg-neutral-100 rounded-lg p-2.5 border border-black">
              {parsedNames.length - courtCapacity} player(s) sit out each round.
            </p>
          )}

          <button
            type="submit"
            disabled={parsedNames.length < 2 || parsedNames.length > 24 || courtCapacity > parsedNames.length}
            className="w-full rounded-2xl border-2 border-black bg-[#ccff00] hover:bg-[#b8eb00] px-4 py-3.5 font-display text-lg font-black uppercase tracking-wide shadow-[4px_4px_0px_0px_#000] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#000] transition-all disabled:opacity-40 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[4px_4px_0px_0px_#000] cursor-pointer disabled:cursor-not-allowed"
          >
            Start Quick Session
          </button>
        </form>
      )}

      {showExitWarning && (
        <ExitWarning
          accountId={accountId}
          onStay={() => setShowExitWarning(false)}
          onLeave={() => {
            setShowExitWarning(false);
            router.replace("/");
          }}
        />
      )}
    </main>
  );
}

function fromProposal(proposal: GeneratedRound, roundNumber: number): TemporaryRound {
  return {
    roundNumber,
    seed: proposal.seed,
    courts: proposal.courts.map((court) => ({
      courtNumber: court.courtNumber,
      team1: [...court.team1],
      team2: [...court.team2],
      team1Score: null,
      team2Score: null,
    })),
    sitting: [...proposal.sitting],
  };
}

function isRoundScored(round: TemporaryRound): boolean {
  return round.courts.every((court) => court.team1Score !== null && court.team2Score !== null && court.team1Score !== court.team2Score);
}

function playerName(players: TemporaryGroupState["players"], playerId: string): string {
  return players.find((player) => player.id === playerId)?.name ?? "Unknown player";
}

function defaultCourtSizes(playerCount: number, courtCount: number): (2 | 3 | 4)[] {
  let remaining = playerCount;
  return Array.from({ length: courtCount }, (_, index) => {
    const placesNeededForLaterCourts = (courtCount - index - 1) * 2;
    const size = Math.min(4, Math.max(2, remaining - placesNeededForLaterCourts)) as 2 | 3 | 4;
    remaining -= size;
    return size;
  });
}

function RoundSummary({ round, players }: { round: TemporaryRound; players: TemporaryGroupState["players"] }) {
  return (
    <article className="rounded-2xl border-2 border-black bg-neutral-50 p-4 shadow-[3px_3px_0px_0px_#000] space-y-3">
      <div className="flex items-center justify-between border-b-2 border-neutral-200 pb-2">
        <h3 className="font-display text-lg font-black uppercase">Round {round.roundNumber}</h3>
        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md border border-black bg-[#dcfce7]">
          Final
        </span>
      </div>
      <ul className="space-y-2">
        {round.courts.map((court) => (
          <li key={court.courtNumber} className="flex items-center justify-between gap-2 text-sm font-bold bg-white p-2.5 rounded-xl border border-black">
            <span className="text-xs font-black uppercase text-neutral-600 shrink-0">Court {court.courtNumber}</span>
            <div className="flex items-center gap-2 truncate">
              <span className="truncate">{court.team1.map((id) => playerName(players, id)).join(" & ")}</span>
              <span className="font-display font-black px-2 py-0.5 rounded-md bg-neutral-100 border border-black text-xs">
                {court.team1Score} – {court.team2Score}
              </span>
              <span className="truncate">{court.team2.map((id) => playerName(players, id)).join(" & ")}</span>
            </div>
          </li>
        ))}
      </ul>
      {round.sitting.length > 0 && (
        <p className="text-xs font-bold text-neutral-600 pt-1">
          Sat out: {round.sitting.map((id) => playerName(players, id)).join(", ")}
        </p>
      )}
    </article>
  );
}

export function ExitWarning({ accountId, onStay, onLeave }: { accountId: string | null; onStay: () => void; onLeave: () => void }) {
  const temporaryReturn = encodeURIComponent("/temporary?save=1");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="temporary-exit-title" className="w-full max-w-md space-y-4 rounded-3xl border-[3px] border-black bg-white p-6 sm:p-7 shadow-[8px_8px_0px_0px_#000]">
        <div className="space-y-1">
          <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#fee2e2] border border-black text-[10px] font-black uppercase tracking-wider text-red-900">
            Unsaved Progress
          </span>
          <h2 id="temporary-exit-title" className="font-display text-2xl sm:text-3xl font-black uppercase tracking-tight">
            Leave quick session?
          </h2>
        </div>
        <p className="text-sm font-bold text-neutral-700 leading-relaxed">
          This session and its rounds have not been saved. Sign in or sign up to save them to your account.
        </p>
        {!accountId && (
          <div className="grid grid-cols-2 gap-2.5">
            <Link
              href={`/player-login?next=${temporaryReturn}`}
              className="rounded-2xl border-2 border-black bg-[#ccff00] hover:bg-[#b8eb00] px-3 py-3 text-center text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
            >
              Sign in to save
            </Link>
            <Link
              href={`/player-signup?next=${temporaryReturn}`}
              className="rounded-2xl border-2 border-black bg-[#7dd3fc] hover:bg-sky-300 px-3 py-3 text-center text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
            >
              Sign up
            </Link>
          </div>
        )}
        {accountId && (
          <p className="rounded-xl border-2 border-black bg-[#dcfce7] p-3 text-center text-xs font-black shadow-[2px_2px_0px_0px_#000]">
            You&apos;re signed in. Continue here, then save from the session screen.
          </p>
        )}
        <button
          type="button"
          onClick={onStay}
          className="w-full rounded-2xl border-2 border-black bg-white hover:bg-neutral-100 px-4 py-3 text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
        >
          Keep playing
        </button>
        <button
          type="button"
          onClick={onLeave}
          className="w-full text-center text-xs font-bold text-neutral-500 hover:text-black underline cursor-pointer pt-1"
        >
          Leave without saving
        </button>
      </section>
    </div>
  );
}
