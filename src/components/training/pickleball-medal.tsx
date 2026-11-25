import React from "react";

/** Podium colours: lime is the app's "gold", then silver and bronze. */
const RANK_FILL: Record<1 | 2 | 3, string> = {
  1: "var(--neo-lime)",
  2: "#cfd4d8",
  3: "#d08a4e",
};

// Holes sit around the rim (same size and style as PickleballIcon) so the label fits in the middle.
const HOLES: readonly [number, number][] = [
  [12, 4.4],
  [18.6, 7.6],
  [19.6, 15.2],
  [12, 19.6],
  [4.4, 15.2],
  [5.4, 7.6],
];

export interface PickleballMedalProps {
  readonly rank: 1 | 2 | 3;
  /** Rendered width/height in px. */
  readonly size?: number;
  readonly className?: string;
}

/** A pickleball medal: "PB" on the best result, "2" and "3" on the runners-up. */
export function PickleballMedal({ rank, size = 48, className }: PickleballMedalProps) {
  const label = rank === 1 ? "PB" : String(rank);
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={rank === 1 ? "Personal best" : `${rank === 2 ? "2nd" : "3rd"} best`}
    >
      <circle cx="12" cy="12" r="10.5" fill={RANK_FILL[rank]} stroke="#000" strokeWidth="1.6" />
      <g fill="#000">
        {HOLES.map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.15" />
        ))}
      </g>
      <text
        x="12"
        y="12.2"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={rank === 1 ? 7.4 : 8.6}
        fontWeight="900"
        className="font-display"
        fill="#000"
      >
        {label}
      </text>
    </svg>
  );
}

/** Sun rays fanning out on both sides of the top medal, like a podium flash. */
export function MedalRays({ className }: { readonly className?: string }) {
  // Angles in degrees from horizontal, with alternating long and short rays.
  const rays = [-34, -20, 0, 20, 34].map((angle, i) => ({ angle, long: i % 2 === 0 }));
  const side = (dir: 1 | -1) =>
    rays.map(({ angle, long }) => {
      const rad = (angle * Math.PI) / 180;
      const inner = 62;
      const outer = long ? 92 : 80;
      const x1 = 120 + dir * inner * Math.cos(rad);
      const y1 = 60 + inner * Math.sin(rad);
      const x2 = 120 + dir * outer * Math.cos(rad);
      const y2 = 60 + outer * Math.sin(rad);
      return <line key={`${dir}-${angle}`} x1={x1} y1={y1} x2={x2} y2={y2} />;
    });
  return (
    <svg viewBox="0 0 240 120" className={className} aria-hidden="true">
      <g stroke="#facc15" strokeWidth="5" strokeLinecap="round">
        {side(1)}
        {side(-1)}
      </g>
    </svg>
  );
}
