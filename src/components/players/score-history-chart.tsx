"use client";

import { useEffect, useRef, useState } from "react";
import type { PlayerSessionHistoryRecord } from "@/lib/domain/types";
import {
  eloToDupr,
  duprToElo,
  formatDupr,
  formatDuprValue,
} from "@/lib/domain/rating-display";
import { useHydrated } from "@/lib/utils/hydration";

export interface YAxisTick {
  readonly dupr: number;
  readonly elo: number;
  readonly y: number;
  readonly label: string;
}

export function computeYAxisTicks(
  minimumElo: number,
  maximumElo: number,
  spanElo: number
): YAxisTick[] {
  const minDupr = eloToDupr(minimumElo);
  const maxDupr = eloToDupr(maximumElo);

  const candidateSteps = [0.05, 0.1, 0.2, 0.25, 0.5, 1.0];
  let bestStep = 0.25;
  let bestScore = Infinity;

  for (const step of candidateSteps) {
    const start = Math.ceil((minDupr + 0.001) / step) * step;
    const end = Math.floor((maxDupr - 0.001) / step) * step;
    const count = Math.round((end - start) / step) + 1;
    if (count >= 2) {
      const score = Math.abs(count - 4);
      if (score < bestScore) {
        bestScore = score;
        bestStep = step;
      }
    }
  }

  const start = Math.ceil((minDupr + 0.001) / bestStep) * bestStep;
  const end = Math.floor((maxDupr - 0.001) / bestStep) * bestStep;
  const count = Math.max(0, Math.round((end - start) / bestStep) + 1);

  const ticks: YAxisTick[] = [];
  for (let i = 0; i < count; i++) {
    const rawDupr = Number((start + i * bestStep).toFixed(3));
    const elo = duprToElo(rawDupr);
    const y = 180 - ((elo - minimumElo) / spanElo) * 155;
    const label =
      rawDupr % 1 === 0 ? rawDupr.toFixed(1) : formatDuprValue(rawDupr);
    ticks.push({ dupr: rawDupr, elo, y, label });
  }

  if (ticks.length === 0) {
    const midElo = (minimumElo + maximumElo) / 2;
    for (const elo of [minimumElo + spanElo * 0.25, midElo, minimumElo + spanElo * 0.75]) {
      const dupr = eloToDupr(elo);
      const y = 180 - ((elo - minimumElo) / spanElo) * 155;
      ticks.push({ dupr, elo, y, label: formatDupr(elo) });
    }
  }

  return ticks;
}

export type RatingTimeRange = "week" | "month" | "year" | "all";

export const RATING_TIME_RANGES: readonly {
  readonly id: RatingTimeRange;
  readonly label: string;
  readonly shortLabel: string;
}[] = [
  { id: "week", label: "Week", shortLabel: "W" },
  { id: "month", label: "Month", shortLabel: "M" },
  { id: "year", label: "Year", shortLabel: "Y" },
  { id: "all", label: "All time", shortLabel: "All" },
];

export function filterHistoryByTimeRange(
  records: readonly PlayerSessionHistoryRecord[],
  range: RatingTimeRange,
  referenceDate: Date = new Date()
): PlayerSessionHistoryRecord[] {
  if (range === "all") return [...records];
  const refTime = referenceDate.getTime();
  let durationMs: number;
  switch (range) {
    case "week":
      durationMs = 7 * 24 * 60 * 60 * 1000;
      break;
    case "month":
      durationMs = 30 * 24 * 60 * 60 * 1000;
      break;
    case "year":
      durationMs = 365 * 24 * 60 * 60 * 1000;
      break;
  }
  const cutoff = refTime - durationMs;
  return records.filter((r) => new Date(r.startedAt).getTime() >= cutoff);
}

function formatDate(date: Date | string, isHydrated: boolean): string {
  if (!isHydrated) return "";
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export interface ScoreHistoryChartProps {
  readonly history: readonly PlayerSessionHistoryRecord[];
  readonly title?: string | null;
  readonly initialTimeRange?: RatingTimeRange;
  readonly referenceDate?: Date;
}

export function ScoreHistoryChart({
  history,
  title = "Rating over time",
  initialTimeRange = "all",
  referenceDate,
}: ScoreHistoryChartProps) {
  const isHydrated = useHydrated();
  const [timeRange, setTimeRange] = useState<RatingTimeRange>(initialTimeRange);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleRangeChange = (range: RatingTimeRange) => {
    setTimeRange(range);
    setHoveredIndex(null);
    setSelectedIndex(null);
  };

  useEffect(() => {
    if (selectedIndex === null) return;
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setSelectedIndex(null);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedIndex(null);
        setHoveredIndex(null);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedIndex]);

  const ordered = [...history].sort(
    (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
  );

  const filtered = filterHistoryByTimeRange(ordered, timeRange, referenceDate);

  const values = filtered.map((entry) => entry.rating);
  const rawMin = values.length > 0 ? Math.min(...values) : 800;
  const rawMax = values.length > 0 ? Math.max(...values) : 1_200;
  const valueRange = rawMax - rawMin;
  const padding = Math.max(Math.round(valueRange * 0.15), 25);
  const minimum = rawMin - padding;
  const maximum = rawMax + padding;
  const span = Math.max(maximum - minimum, 50);

  const yTicks = computeYAxisTicks(minimum, maximum, span);

  const points = values.map((value, index) => ({
    x: filtered.length === 1 ? 200 : 36 + (index / (filtered.length - 1)) * 346,
    y: 180 - ((value - minimum) / span) * 155,
  }));

  const activeIndex = hoveredIndex ?? selectedIndex;
  const activeRecord = activeIndex !== null && activeIndex < filtered.length ? filtered[activeIndex] : null;
  const activePoint = activeIndex !== null && activeIndex < points.length ? points[activeIndex] : null;

  let xTranslate = "-50%";
  let arrowLeft = "50%";
  if (activePoint) {
    const xPercent = (activePoint.x / 400) * 100;
    if (xPercent < 20) {
      xTranslate = "-12%";
      arrowLeft = "12%";
    } else if (xPercent > 80) {
      xTranslate = "-88%";
      arrowLeft = "88%";
    }
  }

  const firstDate = filtered.length > 0 ? formatDate(filtered[0].startedAt, isHydrated) : "";
  const lastDate = filtered.length > 0 ? formatDate(filtered.at(-1)!.startedAt, isHydrated) : "";

  return (
    <div ref={containerRef} className="relative space-y-4">
      <div className="flex items-center justify-between gap-3">
        {title ? (
          <h2 className="font-display text-2xl font-black uppercase">{title}</h2>
        ) : (
          <div />
        )}
      </div>

      <div
        role="group"
        aria-label="Filter rating timeline"
        data-testid="rating-timeline-filter"
        className={`absolute right-0 ${
          title ? "top-12 sm:top-0" : "top-0"
        } z-20 inline-flex items-center rounded-xl border-2 border-black bg-neutral-100 p-0.5 sm:p-1`}
      >
        {RATING_TIME_RANGES.map((item) => {
          const isActive = timeRange === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleRangeChange(item.id)}
              disabled={history.length === 0}
              aria-pressed={isActive}
              aria-label={item.label}
              data-testid={`rating-range-${item.id}`}
              className={`rounded-lg px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                isActive
                  ? "bg-[#ccff00] text-black border-2 border-black shadow-[1.5px_1.5px_0px_0px_#000]"
                  : "border-2 border-transparent text-neutral-600 hover:text-black hover:bg-black/5"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <span className="sm:hidden">{item.shortLabel}</span>
              <span className="hidden sm:inline">{item.label}</span>
            </button>
          );
        })}
      </div>

      {history.length === 0 ? (
        <p className="text-xs font-semibold text-neutral-600">
          Your rating history will appear after your first session.
        </p>
      ) : filtered.length === 0 ? (
        <div className="py-8 text-center" data-testid="rating-chart-empty-range">
          <p className="text-xs font-bold text-neutral-500">
            No rating history in the selected time period.
          </p>
        </div>
      ) : (
        <div className="pt-8">
          <div className="relative">
            <svg
              viewBox="0 0 400 220"
              role="img"
              aria-label={`Rating history from ${formatDupr(values[0])} to ${formatDupr(values.at(-1)!)}`}
              className="w-full overflow-visible"
            >
              {/* Y-axis markings and horizontal grid lines */}
              {yTicks.map((tick, i) => (
                <g key={`y-tick-${tick.label}-${i}`} data-testid={`rating-y-tick-${i}`}>
                  <line
                    x1="36"
                    y1={tick.y}
                    x2="382"
                    y2={tick.y}
                    stroke="#e5e5e5"
                    strokeDasharray="3 3"
                    strokeWidth="1"
                  />
                  <line
                    x1="31"
                    y1={tick.y}
                    x2="36"
                    y2={tick.y}
                    stroke="black"
                    strokeWidth="1.5"
                  />
                  <text
                    x="28"
                    y={tick.y + 3.5}
                    textAnchor="end"
                    fontSize="9"
                    fontWeight="700"
                    fill="#525252"
                  >
                    {tick.label}
                  </text>
                </g>
              ))}

              <line x1="36" y1="180" x2="382" y2="180" stroke="black" strokeWidth="1.5" />
              <line x1="36" y1="25" x2="36" y2="180" stroke="black" strokeWidth="1.5" />
              <polyline
                points={points.map((point) => `${point.x},${point.y}`).join(" ")}
                fill="none"
                stroke="#111"
                strokeWidth="2.25"
                strokeLinejoin="round"
                strokeLinecap="round"
              />

              {points.map((point, index) => {
                const item = filtered[index];
                const isActive = activeIndex === index;
                const isSelected = selectedIndex === index;
                const pointDate = formatDate(item.startedAt, isHydrated);
                const pointRating = formatDupr(item.rating);

                return (
                  <g
                    key={`${item.sessionId}-${item.groupId}`}
                    tabIndex={0}
                    role="button"
                    data-testid={`rating-point-${index}`}
                    aria-label={`Rating ${pointRating} on ${pointDate}`}
                    aria-pressed={isSelected}
                    className="cursor-pointer outline-none focus-visible:outline-2 focus-visible:outline-black focus-visible:outline-offset-2"
                    onMouseEnter={() => setHoveredIndex(index)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedIndex((prev) => (prev === index ? null : index));
                    }}
                    onFocus={() => setHoveredIndex(index)}
                    onBlur={() => setHoveredIndex(null)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedIndex((prev) => (prev === index ? null : index));
                      }
                    }}
                  >
                    <title>{`${pointRating} Rating - ${pointDate}`}</title>
                    {/* Invisible enlarged hit target for easy mouse and touch interactions */}
                    <circle cx={point.x} cy={point.y} r="16" fill="transparent" />

                    {/* Ring indicator when active */}
                    {isActive && (
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r="7"
                        fill="none"
                        stroke="black"
                        strokeWidth="1.5"
                      />
                    )}

                    {/* Dot */}
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={isActive ? "4.5" : "3.5"}
                      fill={isActive ? "#fde047" : "#ccff00"}
                      stroke="black"
                      strokeWidth="1.5"
                    />
                  </g>
                );
              })}

              <text x="36" y="202" fontSize="10">
                {firstDate}
              </text>
              {filtered.length > 1 && (
                <text x="382" y="202" fontSize="10" textAnchor="end">
                  {lastDate}
                </text>
              )}
            </svg>

            {/* Floating tooltip positioned higher above the dot */}
            {activeRecord && activePoint && (
              <div
                role="tooltip"
                data-testid="rating-tooltip"
                className="pointer-events-none absolute z-30 flex flex-col items-center rounded-xl border-2 border-black bg-white px-3 py-1.5 text-center shadow-[3px_3px_0px_0px_#000] whitespace-nowrap tooltip-animate"
                style={{
                  left: `${(activePoint.x / 400) * 100}%`,
                  top: `${(activePoint.y / 220) * 100}%`,
                  transform: `translate(${xTranslate}, calc(-100% - 24px))`,
                }}
              >
                <div data-testid="tooltip-rating" className="font-display text-base font-black text-black leading-tight">
                  {formatDupr(activeRecord.rating)}{" "}
                  <span className="text-xs font-bold uppercase text-neutral-500">Rating</span>
                </div>
                <div data-testid="tooltip-date" className="text-xs font-bold text-neutral-600 leading-tight mt-0.5">
                  {formatDate(activeRecord.startedAt, isHydrated)}
                </div>

                {/* Tooltip pointer arrow pointing to the dot */}
                <div
                  className="absolute -bottom-1.5 h-2.5 w-2.5 rotate-45 border-b-2 border-r-2 border-black bg-white"
                  style={{ left: arrowLeft, transform: "translateX(-50%) rotate(45deg)" }}
                />
              </div>
            )}
          </div>

          <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-neutral-600">
            <p>
              {formatDupr(values[0])} → {formatDupr(values.at(-1)!)} rating
            </p>
            {activeRecord && (
              <p data-testid="active-rating-details" className="text-black font-black">
                <span>{formatDupr(activeRecord.rating)} rating</span>
                <span className="text-neutral-500 font-bold ml-1.5">
                  ({formatDate(activeRecord.startedAt, isHydrated)})
                </span>
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
