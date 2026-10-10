"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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

export function TemporaryGroupClient({ accountId }: { accountId: string | null }) {
  const router = useRouter();
  const snapshot = useSyncExternalStore(subscribeTemporaryState, getTemporarySnapshot, () => null);
  const stored = useMemo(() => parseTemporarySnapshot(snapshot), [snapshot]);
  const state = stored.group;
  const { groupName, playerNames, courtCount, courtSizes, publicOnSave } = stored.draft;
  const [showExitWarning, setShowExitWarning] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const persist = (next: TemporaryStoredData) => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(TEMP_CHANGE_EVENT));
  };
  const setAndPersist = (next: TemporaryGroupState) => persist({ ...stored, group: next });
  const updateDraft = (changes: Partial<TemporarySetupDraft>) => persist({ ...stored, draft: { ...stored.draft, ...changes } });

  const parsedNames = useMemo(() => playerNames.split(/[\n,]/).map((name) => name.trim()).filter(Boolean), [playerNames]);
  const courtCapacity = courtSizes.slice(0, courtCount).reduce((sum, size) => sum + size, 0);
  const hasTemporaryState = state !== null || Boolean(groupName.trim() || playerNames.trim());

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

  const begin = (event: React.FormEvent) => {
    event.preventDefault();
    const players = parsedNames.map((name) => ({ id: crypto.randomUUID(), name, rating: 1_000 }));
    if (players.length < 2 || players.length > 24 || courtCapacity > players.length) return;
    setAndPersist({
      name: groupName.trim(),
      isPublic: publicOnSave,
      courtPlayerCounts: courtSizes.slice(0, courtCount),
      players,
      rounds: [],
      currentRound: null,
    });
  };

  const propose = () => {
    if (!state) return;
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
    const result = generateRound({ players, courts: state.courtPlayerCounts.length, courtPlayerCounts: state.courtPlayerCounts, pairHistory: [], seed });
    if (!result.ok) {
      setSaveError(result.error.message);
      return;
    }
    setSaveError(null);
    setAndPersist({ ...state, currentRound: fromProposal(result.value, state.rounds.length + 1) });
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
    const result = await saveTemporaryGroupAction({
      name: state.name,
      isPublic: state.isPublic,
      courtPlayerCounts: state.courtPlayerCounts,
      players: state.players,
      rounds: state.rounds,
      currentRound: state.currentRound,
    });
    if (!result.ok || !result.groupId) {
      setSaveError(result.error ?? "Unable to save this group.");
      setSaving(false);
      return;
    }
    window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event(TEMP_CHANGE_EVENT));
    router.replace(`/g/${result.groupId}`);
    router.refresh();
  };

  return <main className="min-h-screen bg-[#f8fafc] p-4 pb-12 text-black sm:p-6">
    <div className="mx-auto max-w-2xl space-y-5">
      <header className="flex items-center justify-between gap-3 rounded-3xl border-[3px] border-black bg-white p-5 shadow-[6px_6px_0px_0px_#000]">
        <div><span className="rounded-full border border-black bg-[#fde047] px-2.5 py-1 text-[10px] font-black uppercase">Temporary · This device only</span><h1 className="mt-2 font-display text-3xl font-black uppercase">{state?.name ?? "Temporary Group"}</h1></div>
        <button type="button" onClick={() => setShowExitWarning(true)} className="rounded-xl border-2 border-black bg-white px-3 py-2 text-xs font-black uppercase">Home</button>
      </header>

      {state ? <>
        <section className="rounded-2xl border-2 border-amber-700 bg-amber-50 p-4 text-sm font-bold text-amber-950">
          This group and its rounds are saved in this browser only. Sign in and save the group to store them in your account.
          <label className="mt-3 block text-xs font-black uppercase text-black">Group name<input aria-label="Temporary group name" maxLength={80} value={state.name} onChange={(event) => setAndPersist({ ...state, name: event.target.value })} className="mt-1 w-full rounded-lg border-2 border-black bg-white px-3 py-2 text-sm font-bold normal-case" /></label>
          {accountId && <button type="button" onClick={saveToAccount} disabled={saving} className="mt-3 block rounded-lg border-2 border-black bg-[#ccff00] px-4 py-2 text-xs font-black uppercase text-black">{saving ? "Saving…" : "Save group and rounds to my account"}</button>}
        </section>
        {saveError && <p role="alert" className="rounded-xl border-2 border-red-600 bg-red-50 p-3 text-sm font-bold text-red-700">{saveError}</p>}
        <section className="space-y-4 rounded-3xl border-[3px] border-black bg-white p-5 shadow-[5px_5px_0px_0px_#000]">
          <div className="flex items-center justify-between"><h2 className="font-display text-2xl font-black uppercase">Players</h2><span className="text-xs font-black uppercase">{state.players.length} total</span></div>
          <ul className="flex flex-wrap gap-2">{state.players.map((player) => <li key={player.id} className="rounded-full border border-black bg-[#e0f2fe] px-3 py-1 text-sm font-bold">{player.name}</li>)}</ul>
          <p className="text-xs font-bold text-neutral-600">Courts: {state.courtPlayerCounts.join(" + ")} · {state.players.length - courtCapacity} sit out each round when the roster is larger than court capacity.</p>
        </section>

        <section className="space-y-4 rounded-3xl border-[3px] border-black bg-white p-5 shadow-[5px_5px_0px_0px_#000]">
          <div className="flex items-center justify-between"><h2 className="font-display text-2xl font-black uppercase">Rounds</h2><span className="text-xs font-black uppercase">{state.rounds.length} saved locally</span></div>
          {state.rounds.map((round) => <RoundSummary key={round.roundNumber} round={round} players={state.players} />)}
          {state.currentRound ? <section className="space-y-4 rounded-2xl border-2 border-black bg-[#fef08a] p-4">
            <h3 className="font-display text-xl font-black uppercase">Round {state.currentRound.roundNumber} · Enter scores</h3>
            {state.currentRound.courts.map((court, index) => <div key={court.courtNumber} className="rounded-xl border-2 border-black bg-white p-3">
              <p className="mb-2 text-xs font-black uppercase">Court {court.courtNumber} · {court.team1.length + court.team2.length === 3 ? "2v1 · Unrated" : court.team1.length === 1 ? "Singles · Unrated" : "Doubles"}</p>
              <div className="grid grid-cols-[1fr_4.5rem] items-center gap-2 text-sm font-bold"><span>{court.team1.map((id) => playerName(state.players, id)).join(" & ")}</span><input aria-label={`Court ${court.courtNumber} team 1 score`} type="number" min="0" step="1" value={court.team1Score ?? ""} onChange={(event) => setScore(index, 1, event.target.value)} className="rounded-lg border-2 border-black px-2 py-1 text-center" /><span>{court.team2.map((id) => playerName(state.players, id)).join(" & ")}</span><input aria-label={`Court ${court.courtNumber} team 2 score`} type="number" min="0" step="1" value={court.team2Score ?? ""} onChange={(event) => setScore(index, 2, event.target.value)} className="rounded-lg border-2 border-black px-2 py-1 text-center" /></div>
            </div>)}
            <p className="text-xs font-bold">Sitting: {state.currentRound.sitting.map((id) => playerName(state.players, id)).join(", ") || "Nobody"}</p>
            {!isRoundScored(state.currentRound) && <p className="text-xs font-bold text-amber-900">Enter a whole, non-tied score for every court to save this round.</p>}
            <button type="button" disabled={!isRoundScored(state.currentRound)} onClick={commitRound} className="w-full rounded-xl border-2 border-black bg-black px-4 py-3 font-display font-black uppercase text-[#ccff00] disabled:opacity-40">Save Round</button>
          </section> : <button type="button" onClick={propose} className="w-full rounded-xl border-2 border-black bg-[#ccff00] px-4 py-3 font-display font-black uppercase shadow-[3px_3px_0px_0px_#000]">{state.rounds.length ? "Generate Next Round" : "Generate First Round"}</button>}
        </section>
      </> : <form onSubmit={begin} className="space-y-5 rounded-3xl border-[3px] border-black bg-white p-5 shadow-[6px_6px_0px_0px_#000]">
        <p className="rounded-xl border-2 border-amber-700 bg-amber-50 p-3 text-sm font-bold text-amber-950">Temporary groups stay in this browser. Sign in later if you want to save the group and its scores to the database.</p>
        <label className="block text-xs font-black uppercase">Group name<input required maxLength={80} value={groupName} onChange={(event) => updateDraft({ groupName: event.target.value })} className="mt-1 w-full rounded-xl border-2 border-black px-3 py-3 text-base font-bold" /></label>
        <label className="block text-xs font-black uppercase">Player names · one per line<textarea required rows={6} value={playerNames} onChange={(event) => { const value = event.target.value; const count = value.split(/[\n,]/).map((name) => name.trim()).filter(Boolean).length; const courts = count < 2 ? 1 : Math.min(6, Math.max(1, Math.floor(count / 4) + (count % 4 >= 2 ? 1 : 0))); updateDraft({ playerNames: value, courtCount: courts, courtSizes: defaultCourtSizes(count, courts) }); }} placeholder="Alex&#10;Jamie&#10;Morgan&#10;Riley" className="mt-1 w-full rounded-xl border-2 border-black px-3 py-3 text-base font-bold normal-case" /></label>
        <p className="text-xs font-bold text-neutral-600">{parsedNames.length} names entered · 2 to 24 players</p>
        <label className="block text-xs font-black uppercase">Number of courts<select value={courtCount} onChange={(event) => { const count = Number(event.target.value); updateDraft({ courtCount: count, courtSizes: defaultCourtSizes(parsedNames.length, count) }); }} className="mt-1 w-full rounded-xl border-2 border-black bg-white px-3 py-3 text-base font-bold">{Array.from({ length: Math.max(1, Math.min(6, Math.floor(parsedNames.length / 2))) }, (_, index) => index + 1).map((count) => <option key={count} value={count}>{count}</option>)}</select></label>
        <div className="space-y-2">{courtSizes.slice(0, courtCount).map((size, index) => <label key={index} className="flex items-center justify-between gap-3 rounded-xl border-2 border-black p-3 text-sm font-black">Court {index + 1}<select value={size} onChange={(event) => updateDraft({ courtSizes: courtSizes.map((value, item) => item === index ? Number(event.target.value) as 2 | 3 | 4 : value) })} className="rounded-lg border-2 border-black bg-white px-2 py-1">{[4, 3, 2].map((amount) => <option key={amount} value={amount}>{amount} players · {amount === 4 ? "2v2" : amount === 3 ? "2v1" : "1v1"}</option>)}</select></label>)}</div>
        {courtCapacity > parsedNames.length && <p className="text-sm font-bold text-red-700">Court sizes exceed the number of players.</p>}
        {courtCapacity <= parsedNames.length && parsedNames.length >= 2 && <p className="text-sm font-bold text-neutral-700">{parsedNames.length - courtCapacity} player(s) sit out each round.</p>}
        <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={publicOnSave} onChange={(event) => updateDraft({ publicOnSave: event.target.checked })} className="h-4 w-4 accent-black" />Make public if I save this group later</label>
        <button type="submit" disabled={parsedNames.length < 2 || parsedNames.length > 24 || courtCapacity > parsedNames.length} className="w-full rounded-xl border-2 border-black bg-[#ccff00] px-4 py-3 font-display text-lg font-black uppercase shadow-[3px_3px_0px_0px_#000] disabled:opacity-40">Start Temporary Group</button>
      </form>}

      {showExitWarning && <ExitWarning accountId={accountId} onStay={() => setShowExitWarning(false)} onLeave={() => { setShowExitWarning(false); router.push("/"); }} />}
    </div>
  </main>;
}

function fromProposal(proposal: GeneratedRound, roundNumber: number): TemporaryRound {
  return {
    roundNumber,
    seed: proposal.seed,
    courts: proposal.courts.map((court) => ({ courtNumber: court.courtNumber, team1: [...court.team1], team2: [...court.team2], team1Score: null, team2Score: null })),
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
  return <article className="rounded-xl border-2 border-black bg-neutral-50 p-3"><h3 className="mb-2 text-xs font-black uppercase">Round {round.roundNumber}</h3><ul className="space-y-1">{round.courts.map((court) => <li key={court.courtNumber} className="text-sm font-bold">Court {court.courtNumber}: {court.team1.map((id) => playerName(players, id)).join(" & ")} {court.team1Score} – {court.team2Score} {court.team2.map((id) => playerName(players, id)).join(" & ")}</li>)}</ul>{round.sitting.length > 0 && <p className="mt-2 text-xs font-semibold">Sat out: {round.sitting.map((id) => playerName(players, id)).join(", ")}</p>}</article>;
}

function ExitWarning({ accountId, onStay, onLeave }: { accountId: string | null; onStay: () => void; onLeave: () => void }) {
  const temporaryReturn = encodeURIComponent("/temporary?save=1");
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="presentation">
    <section role="dialog" aria-modal="true" aria-labelledby="temporary-exit-title" className="w-full max-w-md space-y-4 rounded-2xl border-[3px] border-black bg-white p-6 shadow-[8px_8px_0px_0px_#000]">
      <h2 id="temporary-exit-title" className="font-display text-2xl font-black uppercase">Leave temporary group?</h2>
      <p className="text-sm font-bold text-neutral-700">This group and its rounds have not been saved to the database. Sign in or sign up to save them to your account.</p>
      <button type="button" onClick={onStay} className="w-full rounded-xl border-2 border-black bg-white px-4 py-3 text-sm font-black uppercase">Keep playing</button>
      {!accountId && <div className="grid grid-cols-2 gap-2"><Link href={`/player-login?next=${temporaryReturn}`} className="rounded-xl border-2 border-black bg-[#ccff00] px-3 py-3 text-center text-xs font-black uppercase">Sign in to save</Link><Link href={`/player-signup?next=${temporaryReturn}`} className="rounded-xl border-2 border-black bg-[#7dd3fc] px-3 py-3 text-center text-xs font-black uppercase">Sign up to save</Link></div>}
      {accountId && <p className="rounded-lg border border-black bg-[#ccff00] p-3 text-center text-xs font-black">You&apos;re signed in. Continue here, then save from the group screen.</p>}
      <button type="button" onClick={onLeave} className="w-full text-xs font-bold text-neutral-600 underline">Leave without saving</button>
    </section>
  </div>;
}
