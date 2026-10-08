import type { PlayerSessionHistoryRecord } from "@/lib/domain/types";

export function ScoreHistoryChart({ history }: { history: readonly PlayerSessionHistoryRecord[] }) {
  if (history.length === 0) return <p className="text-xs font-semibold text-neutral-600">Your rating history will appear after your first session.</p>;
  const ordered = [...history].sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
  const values = ordered.map((entry) => entry.rating);
  const minimum = Math.min(...values, 800);
  const maximum = Math.max(...values, 1_200);
  const span = Math.max(maximum - minimum, 100);
  const points = values.map((value, index) => ({
    x: ordered.length === 1 ? 200 : 18 + (index / (ordered.length - 1)) * 364,
    y: 110 - ((value - minimum) / span) * 90,
  }));
  return <div>
    <svg viewBox="0 0 400 130" role="img" aria-label={`Rating history from ${values[0]} to ${values.at(-1)}`} className="w-full overflow-visible">
      <line x1="18" y1="110" x2="382" y2="110" stroke="black" strokeWidth="2" />
      <line x1="18" y1="20" x2="18" y2="110" stroke="black" strokeWidth="2" />
      <polyline points={points.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke="#111" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((point, index) => <circle key={`${ordered[index].sessionId}-${ordered[index].groupId}`} cx={point.x} cy={point.y} r="5" fill="#ccff00" stroke="black" strokeWidth="2" />)}
      <text x="18" y="127" fontSize="9">{ordered[0].startedAt.toLocaleDateString()}</text>
      <text x="382" y="127" fontSize="9" textAnchor="end">{ordered.at(-1)?.startedAt.toLocaleDateString()}</text>
    </svg>
    <p className="mt-1 text-xs font-bold text-neutral-600">{values[0]} → {values.at(-1)} internal rating</p>
  </div>;
}
