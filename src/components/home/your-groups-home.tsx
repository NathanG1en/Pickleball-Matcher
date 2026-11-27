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
          className="group block rounded-2xl border-2 border-black bg-[#FFFDF7] hover:bg-white p-4 sm:p-5 shadow-[3px_3px_0px_0px_#000] hover:shadow-[5px_5px_0px_0px_#000] hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#000] transition-all"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <span className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-bold text-black bg-[#ccff00] border border-black">
                <span aria-hidden="true" className="h-2 w-2 rounded-full bg-emerald-600 motion-safe:animate-ping" />
                Live now · {liveLabel(group.liveSession!)}
              </span>
              <h2 className="mt-2 font-display text-2xl sm:text-3xl font-black uppercase leading-tight text-black break-words group-hover:text-neutral-900">
                {group.name}
              </h2>
            </div>
            <span className="flex min-h-11 items-center justify-center rounded-xl bg-black px-5 text-sm font-bold text-[#ccff00] border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)] shrink-0 self-start sm:self-auto group-hover:bg-neutral-900">
              See my court →
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}


export function YourGroupsHome({ groups }: { groups: readonly HomeGroupSummary[] }) {
  if (groups.length === 0) return null;
  return (
    <section aria-labelledby="your-groups-heading" className="rounded-2xl border-2 border-black bg-[#FFFDF7] p-5 text-left shadow-[3px_3px_0px_0px_#000]">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 id="your-groups-heading" className="font-display text-2xl font-black uppercase text-black">
          Your groups
        </h2>
        <span className="text-xs font-bold text-neutral-600">
          {groups.length} {groups.length === 1 ? "group" : "groups"}
        </span>
      </div>
      <ul className="space-y-2.5">
        {groups.map((group) => (
          <li key={group.id}>
            <Link
              href={`/g/${group.id}`}
              className="flex min-h-12 items-center justify-between gap-3 rounded-xl border-2 border-black bg-white px-4 py-2.5 hover:bg-neutral-50 shadow-[2px_2px_0px_0px_#000] hover:shadow-[3px_3px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
            >
              <span className="min-w-0 font-display text-lg font-black uppercase text-black break-words">{group.name}</span>
              <span className="shrink-0 text-xs font-bold text-black bg-[#fde047] border border-black px-2.5 py-1 rounded-lg">Open →</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

