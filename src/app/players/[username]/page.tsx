import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getActionRepository,
  getActivePlayerAccountId,
} from "@/app/actions/action-context";
import {
  LeaveGroupButton,
  PlayerLogoutButton,
  PlayerProfileHeader,
} from "@/components/players/player-profile-controls";
import { ScoreHistoryChart } from "@/components/players/score-history-chart";
import { SynergyExplainerButton } from "@/components/players/synergy-explainer";
import { BackButton, StatCard } from "@/components/ui";
import { GlobeIcon, HandshakeIcon, LockIcon } from "@/components/ui/icons";
import { formatDupr } from "@/lib/domain/rating-display";
import { formatSessionDate } from "@/lib/utils/date";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const decoded = decodeURIComponent(username).replace(/^@/, "");
  return {
    title: `@${decoded} · Profile | Pickleball Matcher`,
  };
}

export default async function PlayerPublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username: rawUsername } = await params;
  const username = decodeURIComponent(rawUsername).replace(/^@/, "").trim().toLowerCase();

  const repository = getActionRepository();
  const targetAccount = await repository.getPlayerAccountByUsername(username);

  if (!targetAccount) {
    notFound();
  }

  const viewerAccountId = await getActivePlayerAccountId();
  const isOwner = Boolean(viewerAccountId && viewerAccountId === targetAccount.id);
  const isPrivate = targetAccount.isPublic === false && !isOwner;

  if (isPrivate) {
    return (
      <main className="min-h-screen p-4 sm:p-6">
        <section className="mx-auto max-w-2xl space-y-5">
          <header className="rounded-3xl border-[3px] border-black bg-white p-5 shadow-[6px_6px_0px_0px_#000]">
            <div className="mb-4 flex items-center justify-between">
              <BackButton fallbackHref="/" />
            </div>
            <div className="space-y-1">
              <h1 className="font-display text-3xl font-black uppercase truncate text-black">
                {targetAccount.name}
              </h1>
              <p className="text-sm font-bold text-neutral-600">
                @{targetAccount.username}
              </p>
            </div>
            <div className="mt-3 flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-black bg-neutral-200 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black shadow-[1.5px_1.5px_0px_0px_#000]">
                <LockIcon className="h-2.5 w-2.5 shrink-0" />
                <span>Private</span>
              </span>
            </div>
          </header>

          <section className="rounded-3xl border-[3px] border-black bg-white p-6 shadow-[5px_5px_0px_0px_#000] text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-black bg-neutral-100 shadow-[2px_2px_0px_0px_#000]">
              <LockIcon className="h-6 w-6 text-neutral-700" />
            </div>
            <h2 className="font-display text-xl font-black uppercase text-black">This Profile is Private</h2>
            <p className="mt-1 text-xs font-bold text-neutral-600 max-w-sm mx-auto">
              @{targetAccount.username} has chosen to keep their stats, match history, and rating private.
            </p>
          </section>
        </section>
      </main>
    );
  }

  const [history, groups, bestPartner, viewerSynergy] = await Promise.all([
    repository.listPlayerSessionHistory(targetAccount.id),
    repository.listAccountGroups(targetAccount.id),
    repository.getBestPartner(targetAccount.id),
    viewerAccountId && viewerAccountId !== targetAccount.id
      ? repository.getPairSynergy(viewerAccountId, targetAccount.id)
      : Promise.resolve(null),
  ]);

  const wins = history.reduce((total, session) => total + session.wins, 0);
  const losses = history.reduce((total, session) => total + session.losses, 0);
  const currentRating = targetAccount.rating ?? targetAccount.initialRating;

  return (
    <main className="min-h-screen p-4 sm:p-6">
      <section className="mx-auto max-w-2xl space-y-5">
        <header className="rounded-3xl border-[3px] border-black bg-white p-5 shadow-[6px_6px_0px_0px_#000]">
          <div className="mb-4 flex items-center justify-between">
            <BackButton fallbackHref="/" />
            {isOwner && <PlayerLogoutButton />}
          </div>

          {isOwner ? (
            <PlayerProfileHeader
              initialName={targetAccount.name}
              initialUsername={targetAccount.username}
              initialGender={targetAccount.gender}
              skillLevel={targetAccount.skillLevel}
              currentRating={currentRating}
              initialIsPublic={targetAccount.isPublic ?? true}
            />
          ) : (
            <div className="min-w-0 flex-1 space-y-2">
              <h1 className="font-display text-3xl font-black uppercase truncate text-black">
                {targetAccount.name}
              </h1>
              <p className="text-sm font-bold text-neutral-600">
                @{targetAccount.username}
              </p>
              {targetAccount.gender && (
                <p className="text-xs font-bold uppercase text-neutral-600">
                  {targetAccount.gender === "male" ? "Male" : "Female"}
                </p>
              )}
              <div className="flex items-center gap-2 pt-0.5">
                <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-black bg-[#ccff00] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black shadow-[1.5px_1.5px_0px_0px_#000]">
                  <GlobeIcon className="h-2.5 w-2.5 shrink-0" />
                  <span>Public</span>
                </span>
              </div>
              <div className="pt-2 border-t-2 border-neutral-100">
                <p className="text-xs font-bold uppercase text-neutral-600">
                  {targetAccount.skillLevel} · current rating {formatDupr(currentRating)}
                </p>
              </div>
            </div>
          )}
        </header>

        {bestPartner ? (
          <section className="rounded-3xl border-[3px] border-black bg-gradient-to-br from-[#ccff00] to-[#fde047] p-5 shadow-[5px_5px_0px_0px_#000]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-[10px] font-black uppercase tracking-wider text-neutral-800">Chemistry Spotlight</p>
                  <SynergyExplainerButton />
                </div>
                <h2 className="font-display text-2xl font-black uppercase">Best Partner</h2>
                <p className="text-sm font-bold text-neutral-800">
                  <Link
                    href={`/players/${encodeURIComponent(bestPartner.username)}`}
                    className="underline hover:text-black"
                  >
                    @{bestPartner.username}
                  </Link>
                </p>
              </div>
              <div className="text-right">
                {(() => {
                  const raw = bestPartner.synergyScore;
                  const score = Math.round(raw > -1 && raw < 1 && raw !== 0 ? raw * 100 : raw);
                  const sign = score > 0 ? `+${score}` : `${score}`;
                  return (
                    <span className={`inline-block rounded-xl border-2 border-black px-3 py-1 font-display text-xl font-black shadow-[2px_2px_0px_0px_#000] ${
                      score > 0
                        ? "bg-emerald-100 text-emerald-950"
                        : score < 0
                        ? "bg-rose-100 text-rose-950"
                        : "bg-white text-black"
                    }`}>
                      {sign} Synergy
                    </span>
                  );
                })()}
                <p className="mt-1 text-[11px] font-bold text-neutral-800">
                  {bestPartner.matchesPlayed} {bestPartner.matchesPlayed === 1 ? "match" : "matches"} together
                </p>
              </div>
            </div>
          </section>
        ) : (
          <section className="rounded-3xl border-[3px] border-black bg-white p-5 shadow-[5px_5px_0px_0px_#000]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Chemistry Spotlight</p>
                  <SynergyExplainerButton />
                </div>
                <h2 className="font-display text-xl font-black uppercase text-neutral-800">Doubles Synergy</h2>
                <p className="mt-1 text-xs font-bold text-neutral-600 max-w-sm">
                  Play doubles matches with other registered accounts in your groups to discover your best partner and unlock mutual chemistry scores.
                </p>
              </div>
              <span className="flex items-center justify-center rounded-2xl border-2 border-black bg-neutral-100 p-3 shadow-[2px_2px_0px_0px_#000]">
                <HandshakeIcon className="h-6 w-6 text-black" />
              </span>
            </div>
          </section>
        )}

        {viewerSynergy && viewerSynergy.matchesPlayed > 0 && (
          <section className="rounded-3xl border-[3px] border-black bg-white p-5 shadow-[5px_5px_0px_0px_#000]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Mutual Chemistry</p>
                <h2 className="font-display text-xl font-black uppercase text-neutral-800">Partner Chemistry With You</h2>
                <p className="mt-1 text-xs font-bold text-neutral-600">
                  {viewerSynergy.wins} wins in {viewerSynergy.matchesPlayed} matches together
                </p>
              </div>
              <div className="text-right">
                <span className="inline-block rounded-xl border-2 border-black bg-[#ccff00] px-3 py-1 font-display text-xl font-black shadow-[2px_2px_0px_0px_#000]">
                  {viewerSynergy.synergyScore > 1
                    ? Math.round(viewerSynergy.synergyScore)
                    : Math.round(viewerSynergy.synergyScore * 100)}%
                </span>
              </div>
            </div>
          </section>
        )}

        <section className="grid grid-cols-3 gap-3 text-center">
          <StatCard label="Sessions" value={new Set(history.map((item) => item.sessionId)).size} />
          <StatCard label="Wins" value={wins} />
          <StatCard label="Losses" value={losses} />
        </section>

        <section className="rounded-3xl border-[3px] border-black bg-[#ccff00] p-5 shadow-[5px_5px_0px_0px_#000]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-display text-2xl font-black uppercase">
              {isOwner ? "My Groups" : "Groups"}
            </h2>
            {isOwner && (
              <div className="flex gap-2">
                <Link href="/setup" className="rounded-xl border-2 border-black bg-[#fde047] px-3 py-2 text-xs font-black uppercase">Create</Link>
                <Link href="/players/groups" className="rounded-xl border-2 border-black bg-white px-3 py-2 text-xs font-black uppercase">Find groups</Link>
              </div>
            )}
          </div>
          {groups.length === 0 ? (
            <p className="text-sm font-bold">
              {isOwner ? "You haven't joined any groups yet." : "No groups joined yet."}
            </p>
          ) : (
            <ul className="space-y-2">
              {groups.map((group) => (
                <li key={group.id} className="flex items-center justify-between gap-3 rounded-xl border-2 border-black bg-white px-3 py-2 text-sm font-bold">
                  <div>
                    <Link href={`/g/${group.id}`} className="block underline">{group.name}</Link>
                    <span className="text-xs text-neutral-600">{group.playerCount} players</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {(group.isHost || group.isOrganizer) && (
                      <span className="rounded-full border border-black bg-[#fde047] px-2 py-1 text-[9px] font-black uppercase">
                        {group.isHost ? "Host" : "Organizer"}
                      </span>
                    )}
                    {isOwner && group.isMember && !group.isHost && (
                      <LeaveGroupButton groupId={group.id} groupName={group.name} />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-4 rounded-3xl border-[3px] border-black bg-white p-5 shadow-[5px_5px_0px_0px_#000]">
          <h2 className="font-display text-2xl font-black uppercase">Rating over time</h2>
          <ScoreHistoryChart history={history} />
        </section>

        <section className="space-y-3 rounded-3xl border-[3px] border-black bg-white p-5 shadow-[5px_5px_0px_0px_#000]">
          <h2 className="font-display text-2xl font-black uppercase">Past Sessions</h2>
          {history.length === 0 ? (
            <p className="text-sm font-bold text-neutral-600">No sessions played yet.</p>
          ) : (
            history.map((item) => {
              const formattedDate = formatSessionDate(item.startedAt);
              return (
                <article
                  key={`${item.groupId}-${item.sessionId}`}
                  data-testid={`player-session-${item.sessionId}`}
                  className="flex items-center justify-between gap-3 border-t-2 border-neutral-100 py-3"
                >
                  <div>
                    <h3 suppressHydrationWarning className="font-black text-black">
                      {item.sessionName ? `${item.sessionName} · ${formattedDate}` : formattedDate}
                    </h3>
                    <p className="text-xs font-bold text-neutral-600">
                      {item.groupName}
                      {item.type === "open_play" ? " (Open Play)" : ""}
                      {" · "}
                      {item.wins}W – {item.losses}L
                    </p>
                  </div>
                  <Link
                    href={`/g/${item.groupId}/sessions/${item.sessionId}?from=profile`}
                    className="rounded-xl border-2 border-black bg-white px-3 py-1.5 text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] hover:bg-neutral-100 active:translate-x-0.5 active:translate-y-0.5 transition-transform shrink-0"
                  >
                    Go to session
                  </Link>
                </article>
              );
            })
          )}
        </section>
      </section>
    </main>
  );
}

