import Link from "next/link";

export interface HomeGroupSummary {
  readonly id: string;
  readonly name: string;
  readonly liveSession: {
    readonly id: string;
    readonly roundNumber: number;
    readonly type: "regular" | "open_play";
  } | null;
}

function liveLabel(live: NonNullable<HomeGroupSummary["liveSession"]>): string {
  if (live.type === "open_play") return "Open play is running";
  return live.roundNumber > 0 ? `Round ${live.roundNumber} in play` : "Lineup being set";
}

/** Live sessions first, one tap from the court; then every group the viewer belongs to. */
export function LiveSessionsHome({ groups }: { groups: readonly HomeGroupSummary[] }) {
  const live = groups.filter((group) => group.liveSession);
  if (live.length === 0) return null;
  return (
    <div className="space-y-3 text-left">
      {live.map((group) => (
        <Link
          key={group.id}
          href={`/g/${group.id}/sessions/${group.liveSession!.id}`}
          data-testid="home-live-session"
          className="block rounded-2xl border-[3px] border-black bg-[#ccff00] p-4 shadow-[4px_4px_0px_0px_#000] transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#000]"
        >
          <span className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-black">
            <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full border-2 border-black bg-white" />
            Live now · {liveLabel(group.liveSession!)}
          </span>
          <span className="mt-1.5 block font-display text-2xl font-black uppercase leading-tight text-black break-words">
            {group.name}
          </span>
          <span className="mt-3 flex min-h-11 items-center justify-center rounded-xl bg-black px-4 font-display text-base font-black uppercase tracking-wide text-[#ccff00]">
            See my court →
          </span>
        </Link>
      ))}
    </div>
  );
}

export function YourGroupsHome({ groups }: { groups: readonly HomeGroupSummary[] }) {
  if (groups.length === 0) return null;
  return (
    <section aria-labelledby="your-groups-heading" className="rounded-2xl border-2 border-black bg-[#e0f2fe] p-4 text-left sm:p-5">
      <h2 id="your-groups-heading" className="font-display text-xl font-black uppercase text-black">
        Your groups
      </h2>
      <ul className="mt-3 space-y-2">
        {groups.map((group) => (
          <li key={group.id}>
            <Link
              href={`/g/${group.id}`}
              className="flex min-h-11 items-center justify-between gap-3 rounded-xl border-2 border-black bg-[#FFFDF7] px-3 py-2 hover:bg-white"
            >
              <span className="min-w-0 font-display text-base font-black uppercase text-black break-words">{group.name}</span>
              <span className="shrink-0 text-xs font-black uppercase text-black">
                {group.liveSession ? "Live →" : "Open →"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
