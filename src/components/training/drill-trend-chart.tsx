import React from "react";
import type { ChallengeTemplateRecord } from "@/lib/domain/types";
import { formatMetricValue, formatShortDate, type DailyBestPoint } from "@/lib/domain/training-history";

export interface DrillTrendChartProps {
  readonly challenge: Pick<ChallengeTemplateRecord, "trackingFormat" | "scoreUnit" | "higherIsBetter" | "defaultTargetGoal">;
  readonly points: readonly DailyBestPoint[];
  readonly now?: Date;
}

const WIDTH = 320;
const HEIGHT = 168;
const PAD = { top: 14, right: 14, bottom: 26, left: 44 };

/**
 * Line chart of the best result per day. The x axis is scaled by date so gaps
 * between practice days are visible; the target benchmark is drawn as a dashed line.
 */
export function DrillTrendChart({ challenge, points, now = new Date() }: DrillTrendChartProps) {
  if (points.length < 2) return null;

  const target = challenge.defaultTargetGoal ?? null;
  const values = points.map((p) => p.value);
  if (target !== null) values.push(target);

  const { min, max } = niceBounds(Math.min(...values), Math.max(...values), challenge.trackingFormat === "accuracy");

  const t0 = points[0].date.getTime();
  const t1 = points[points.length - 1].date.getTime();
  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (t: number) => PAD.left + (t1 === t0 ? plotW / 2 : ((t - t0) / (t1 - t0)) * plotW);
  const y = (v: number) => PAD.top + (1 - (v - min) / (max - min)) * plotH;

  const coords = points.map((p) => ({ x: x(p.date.getTime()), y: y(p.value), point: p }));
  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");

  const first = points[0];
  const last = points[points.length - 1];
  const label = `Best result per day from ${formatShortDate(first.date, now)} to ${formatShortDate(last.date, now)}: ${formatMetricValue(challenge, first.value)} to ${formatMetricValue(challenge, last.value)}${
    target !== null ? `. Target ${formatMetricValue(challenge, target)}` : ""
  }.`;

  return (
    <figure className="space-y-1.5">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full h-auto"
        role="img"
        aria-label={label}
        data-testid="drill-trend-chart"
      >
        {/* Plot frame */}
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={HEIGHT - PAD.bottom} stroke="#d4d4d4" />
        <line x1={PAD.left} y1={HEIGHT - PAD.bottom} x2={WIDTH - PAD.right} y2={HEIGHT - PAD.bottom} stroke="#d4d4d4" />

        {/* Y axis labels */}
        <text x={PAD.left - 6} y={PAD.top + 4} textAnchor="end" className="fill-neutral-500" fontSize="10" fontWeight="700">
          {formatMetricValue(challenge, max)}
        </text>
        <text x={PAD.left - 6} y={HEIGHT - PAD.bottom} textAnchor="end" className="fill-neutral-500" fontSize="10" fontWeight="700">
          {formatMetricValue(challenge, min)}
        </text>

        {/* Target line (labelled in the caption so it never collides with points) */}
        {target !== null && (
          <line
            x1={PAD.left}
            x2={WIDTH - PAD.right}
            y1={y(target)}
            y2={y(target)}
            stroke="#65a30d"
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />
        )}

        {/* Trend line and points */}
        <path d={path} fill="none" stroke="#000" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {coords.map((c) => (
          <circle key={c.point.dayKey} cx={c.x} cy={c.y} r="4" fill="#ccff00" stroke="#000" strokeWidth="1.5" />
        ))}

        {/* X axis labels */}
        <text x={PAD.left} y={HEIGHT - 8} textAnchor="start" className="fill-neutral-500" fontSize="10" fontWeight="700">
          {formatShortDate(first.date, now)}
        </text>
        <text x={WIDTH - PAD.right} y={HEIGHT - 8} textAnchor="end" className="fill-neutral-500" fontSize="10" fontWeight="700">
          {formatShortDate(last.date, now)}
        </text>
      </svg>
      <figcaption className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold text-neutral-600">
        <span>Best result per practice day{challenge.higherIsBetter ? "" : " · lower is better"}</span>
        {target !== null && (
          <span className="inline-flex items-center gap-1.5 text-lime-800">
            <svg width="16" height="4" aria-hidden="true">
              <line x1="0" y1="2" x2="16" y2="2" stroke="#65a30d" strokeWidth="1.5" strokeDasharray="4 3" />
            </svg>
            Target {formatMetricValue(challenge, target)}
          </span>
        )}
      </figcaption>
    </figure>
  );
}

/** Expands [low, high] outward to round steps so axis labels read cleanly (e.g. 50%–85%). */
function niceBounds(low: number, high: number, isPercent: boolean): { min: number; max: number } {
  let span = high - low;
  if (span === 0) span = Math.max(1, Math.abs(high) * 0.2);
  const rough = span / 4;
  const step = [0.5, 1, 2, 5, 10, 20, 25, 50, 100, 200, 500].find((st) => st >= rough) ?? 1000;
  let min = Math.floor((low - span * 0.08) / step) * step;
  let max = Math.ceil((high + span * 0.08) / step) * step;
  min = Math.max(0, min);
  if (isPercent) max = Math.min(100, max);
  if (max <= min) max = min + step;
  return { min, max };
}
