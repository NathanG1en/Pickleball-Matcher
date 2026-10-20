"use client";

import { useEffect, useRef, useState } from "react";
import type { PlayerSessionHistoryRecord } from "@/lib/domain/types";
import { formatDupr } from "@/lib/domain/rating-display";

function formatDate(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ScoreHistoryChart({ history }: { history: readonly PlayerSessionHistoryRecord[] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

  if (history.length === 0) {
    return (
      <p className="text-xs font-semibold text-neutral-600">
        Your rating history will appear after your first session.
      </p>
    );
  }

  const ordered = [...history].sort(
    (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
  );
  const values = ordered.map((entry) => entry.rating);
  const minimum = Math.min(...values, 800);
  const maximum = Math.max(...values, 1_200);
  const span = Math.max(maximum - minimum, 100);
  const points = values.map((value, index) => ({
    x: ordered.length === 1 ? 200 : 18 + (index / (ordered.length - 1)) * 364,
    y: 110 - ((value - minimum) / span) * 90,
  }));

  const activeIndex = hoveredIndex ?? selectedIndex;
  const activeRecord = activeIndex !== null ? ordered[activeIndex] : null;
  const activePoint = activeIndex !== null ? points[activeIndex] : null;

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

  const firstDate = formatDate(ordered[0].startedAt);
  const lastDate = formatDate(ordered.at(-1)!.startedAt);

  return (
    <div ref={containerRef} className="pt-8">
      <div className="relative">
        <svg
          viewBox="0 0 400 130"
          role="img"
          aria-label={`Rating history from ${formatDupr(values[0])} to ${formatDupr(values.at(-1)!)}`}
          className="w-full overflow-visible"
        >
          <line x1="18" y1="110" x2="382" y2="110" stroke="black" strokeWidth="2" />
          <line x1="18" y1="20" x2="18" y2="110" stroke="black" strokeWidth="2" />
          <polyline
            points={points.map((point) => `${point.x},${point.y}`).join(" ")}
            fill="none"
            stroke="#111"
            strokeWidth="4"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {points.map((point, index) => {
            const item = ordered[index];
            const isActive = activeIndex === index;
            const isSelected = selectedIndex === index;
            const pointDate = formatDate(item.startedAt);
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
                    r="9"
                    fill="none"
                    stroke="black"
                    strokeWidth="2.5"
                  />
                )}

                {/* Dot */}
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={isActive ? "6" : "5"}
                  fill={isActive ? "#fde047" : "#ccff00"}
                  stroke="black"
                  strokeWidth="2"
                />
              </g>
            );
          })}

          <text x="18" y="127" fontSize="9">
            {firstDate}
          </text>
          {ordered.length > 1 && (
            <text x="382" y="127" fontSize="9" textAnchor="end">
              {lastDate}
            </text>
          )}
        </svg>

        {/* Floating tooltip positioned higher above the dot */}
        {activeRecord && activePoint && (
          <div
            role="tooltip"
            data-testid="rating-tooltip"
            className="pointer-events-none absolute z-30 flex flex-col items-center rounded-xl border-2 border-black bg-white px-3 py-1.5 text-center shadow-[3px_3px_0px_0px_#000] whitespace-nowrap"
            style={{
              left: `${(activePoint.x / 400) * 100}%`,
              top: `${(activePoint.y / 130) * 100}%`,
              transform: `translate(${xTranslate}, calc(-100% - 24px))`,
            }}
          >
            <div data-testid="tooltip-rating" className="font-display text-base font-black text-black leading-tight">
              {formatDupr(activeRecord.rating)}{" "}
              <span className="text-xs font-bold uppercase text-neutral-500">Rating</span>
            </div>
            <div data-testid="tooltip-date" className="text-xs font-bold text-neutral-600 leading-tight mt-0.5">
              {formatDate(activeRecord.startedAt)}
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
              ({formatDate(activeRecord.startedAt)})
            </span>
          </p>
        )}
      </div>
    </div>
  );
}
