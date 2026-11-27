import type { PlayCountRow } from "@/lib/sessions/play-count";

/** Collapsed by default: answers "why am I sitting again?" without crowding the courts. */
export function PlayCountPanel({
  rows,
  playerNames,
  viewerPlayerId = null,
}: {
  rows: readonly PlayCountRow[];
  playerNames: Readonly<Record<string, string>>;
  viewerPlayerId?: string | null;
}) {
  if (rows.length === 0) return null;
  return (
    <details data-testid="play-count" className="group rounded-2xl border-2 border-black bg-white shadow-[2px_2px_0px_0px_#000]">
      <summary className="flex min-h-11 cursor-pointer select-none items-center justify-between gap-2 px-4 text-sm font-bold text-black">
        <span>Games played · rounds sat out</span>
        <span aria-hidden="true" className="transition-transform group-open:rotate-180">▼</span>
      </summary>
      <table className="w-full border-t-2 border-black text-sm">
        <thead>
          <tr className="text-left text-xs font-bold text-black">
            <th scope="col" className="px-4 py-2">Player</th>
            <th scope="col" className="px-2 py-2 text-right">Played</th>
            <th scope="col" className="px-4 py-2 text-right">Sat</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {rows.map((row) => (
            <tr
              key={row.playerId}
              data-viewer-row={row.playerId === viewerPlayerId ? "true" : undefined}
              className={`border-t border-neutral-200 ${row.playerId === viewerPlayerId ? "bg-[#ccff00]" : ""}`}
            >
              <th scope="row" className="px-4 py-2 text-left font-bold text-black">
                {playerNames[row.playerId] ?? "Player"}
                {row.playerId === viewerPlayerId && <span className="ml-1.5 text-xs font-bold">(You)</span>}
              </th>
              <td className="px-2 py-2 text-right font-black text-black">{row.played}</td>
              <td className="px-4 py-2 text-right font-black text-black">{row.sat}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
