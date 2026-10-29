"use client";

import React from "react";
import { getSkillTier } from "@/lib/domain/rating-display";

export interface RatingTick {
  readonly value: number;
  readonly percent: number;
  readonly type: "major" | "medium" | "minor";
}

export const RATING_TICKS: readonly RatingTick[] = (() => {
  const ticks: RatingTick[] = [];
  const min = 2;
  const max = 6;
  const step = 0.25;
  const steps = Math.round((max - min) / step);

  for (let i = 0; i <= steps; i++) {
    const value = Math.round((min + i * step) * 100) / 100;
    const percent = ((value - min) / (max - min)) * 100;
    const isMajor = Math.abs(value - Math.round(value)) < 0.001;
    const isMedium = !isMajor && Math.abs(value * 2 - Math.round(value * 2)) < 0.001;
    ticks.push({
      value,
      percent,
      type: isMajor ? "major" : isMedium ? "medium" : "minor",
    });
  }
  return ticks;
})();

export interface RatingSliderProps {
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly id?: string;
  readonly name?: string;
  readonly label?: string;
  readonly dataTestId?: string;
  readonly disabled?: boolean;
  readonly showDescription?: boolean;
  readonly className?: string;
}

export function RatingSlider({
  value,
  onChange,
  id = "rating-slider",
  name,
  label = "Rating",
  dataTestId = "rating-slider",
  disabled = false,
  showDescription = true,
  className = "",
}: RatingSliderProps) {
  const percent = Math.min(100, Math.max(0, ((value - 2) / 4) * 100));
  const tier = getSkillTier(value);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const isDraggingRef = React.useRef(false);
  const hasDraggedRef = React.useRef(false);
  const startXRef = React.useRef(0);
  const startYRef = React.useRef(0);
  const isTouchRef = React.useRef(false);
  const touchPendingRef = React.useRef(false);
  const isScrollingRef = React.useRef(false);
  const pointerIdRef = React.useRef<number | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  const calculateValueFromPointer = React.useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const trackLeft = rect.left + 8;
    const trackWidth = rect.width - 16;
    if (trackWidth <= 0) return;
    const ratio = Math.max(0, Math.min(1, (clientX - trackLeft) / trackWidth));
    const rawValue = 2 + ratio * 4;
    const snapped = Math.round(rawValue / 0.25) * 0.25;
    const clamped = Math.min(6, Math.max(2, Math.round(snapped * 100) / 100));
    return clamped;
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;

    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    hasDraggedRef.current = false;
    isScrollingRef.current = false;

    if (e.pointerType === "mouse") {
      isTouchRef.current = false;
      touchPendingRef.current = false;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      isDraggingRef.current = true;
      setIsDragging(true);
      inputRef.current?.focus();

      const newVal = calculateValueFromPointer(e.clientX);
      if (newVal !== undefined && newVal !== value) {
        onChange(newVal);
      }
    } else {
      // Touch: do not immediately change value or capture pointer.
      // Wait to verify if the gesture is vertical scroll or an intentional slide/tap.
      isTouchRef.current = true;
      touchPendingRef.current = true;
      isDraggingRef.current = false;
      pointerIdRef.current = e.pointerId;
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;

    if (isTouchRef.current) {
      if (isScrollingRef.current) return;

      if (touchPendingRef.current) {
        const dx = Math.abs(e.clientX - startXRef.current);
        const dy = Math.abs(e.clientY - startYRef.current);

        // Vertical movement detected -> User is scrolling the page, leave rating untouched
        if (dy > dx && dy > 4) {
          isScrollingRef.current = true;
          touchPendingRef.current = false;
          return;
        }

        // Horizontal movement detected -> User intentionally sliding the rating
        if (dx > dy && dx > 6) {
          touchPendingRef.current = false;
          isDraggingRef.current = true;
          hasDraggedRef.current = true;
          setIsDragging(true);
          try {
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          } catch {
            // Ignore if pointer capture fails
          }
          inputRef.current?.focus();
          const newVal = calculateValueFromPointer(e.clientX);
          if (newVal !== undefined && newVal !== value) {
            onChange(newVal);
          }
          return;
        }
      } else if (isDraggingRef.current) {
        hasDraggedRef.current = true;
        const newVal = calculateValueFromPointer(e.clientX);
        if (newVal !== undefined && newVal !== value) {
          onChange(newVal);
        }
      }
      return;
    }

    if (!isDraggingRef.current) return;
    if (Math.abs(e.clientX - startXRef.current) > 3) {
      hasDraggedRef.current = true;
    }
    const newVal = calculateValueFromPointer(e.clientX);
    if (newVal !== undefined && newVal !== value) {
      onChange(newVal);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isTouchRef.current) {
      if (isScrollingRef.current) {
        isScrollingRef.current = false;
        touchPendingRef.current = false;
        isDraggingRef.current = false;
        setIsDragging(false);
        return;
      }

      // Tap without scrolling or dragging = Intentional rating click
      if (touchPendingRef.current && !hasDraggedRef.current) {
        touchPendingRef.current = false;
        inputRef.current?.focus();
        const newVal = calculateValueFromPointer(e.clientX);
        if (newVal !== undefined && newVal !== value) {
          onChange(newVal);
        }
      }

      if (isDraggingRef.current) {
        try {
          (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        } catch {
          // Ignore
        }
        isDraggingRef.current = false;
        setIsDragging(false);
        setTimeout(() => {
          hasDraggedRef.current = false;
        }, 100);
      }

      touchPendingRef.current = false;
      isScrollingRef.current = false;
      return;
    }

    if (isDraggingRef.current) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Ignore if pointer capture already released
      }
      isDraggingRef.current = false;
      setIsDragging(false);
      setTimeout(() => {
        hasDraggedRef.current = false;
      }, 100);
    }
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
    isDraggingRef.current = false;
    setIsDragging(false);
    hasDraggedRef.current = false;
    touchPendingRef.current = false;
    isScrollingRef.current = false;
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label htmlFor={id} className="block text-xs font-black uppercase tracking-wider text-black">
          {label}
        </label>
      )}

      {/* Number line container with interactive sliding and clicking */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        className={`relative pt-6 pb-7 px-0 select-none touch-pan-y ${
          disabled ? "cursor-not-allowed opacity-60" : isDragging ? "cursor-grabbing" : "cursor-pointer"
        }`}
      >
        {/* Floating Green Box above the number line, aligned with the current dot position */}
        <div
          data-testid="guest-rating-value"
          className={`absolute -translate-x-1/2 top-0 pointer-events-none z-20 flex flex-col items-center ${
            isDragging ? "transition-none" : "transition-[left] duration-75"
          }`}
          style={{ left: `calc(8px + (100% - 16px) * ${percent / 100})` }}
        >
          <div className="font-mono font-black text-xs text-black bg-[#ccff00] border-2 border-black px-2 py-0.5 rounded-lg shadow-[1.5px_1.5px_0px_0px_#000] whitespace-nowrap">
            {value.toFixed(2)}
          </div>
          <div className="w-1.5 h-1.5 bg-[#ccff00] border-r-2 border-b-2 border-black rotate-45 -mt-1" />
        </div>

        {/* The horizontal number line */}
        <div
          aria-hidden="true"
          className="absolute top-9 left-2 right-2 h-1 bg-black rounded-full pointer-events-none"
        />

        {/* Current value dot / thumb on the number line */}
        <div
          aria-hidden="true"
          className={`absolute -translate-x-1/2 -translate-y-1/2 top-9 w-4 h-4 rounded-full bg-black border-2 border-white shadow-[0_0_0_2px_#000] z-25 pointer-events-none transition-transform ${
            isDragging ? "scale-125" : ""
          }`}
          style={{ left: `calc(8px + (100% - 16px) * ${percent / 100})` }}
        />

        {/* Ticks positioned directly ON the number line */}
        <div className="relative w-full h-8 pointer-events-none z-20">
          {RATING_TICKS.map((tick) => {
            const isMajor = tick.type === "major";
            const isMedium = tick.type === "medium";
            return (
              <button
                key={tick.value}
                type="button"
                disabled={disabled}
                onClick={(e) => {
                  if (hasDraggedRef.current || isScrollingRef.current) {
                    e.preventDefault();
                    return;
                  }
                  onChange(tick.value);
                }}
                aria-label={`Set rating to ${tick.value}`}
                data-testid={`rating-tick-${tick.value}`}
                className="absolute -translate-x-1/2 -translate-y-1/2 top-3 flex flex-col items-center cursor-pointer pointer-events-auto touch-pan-y group focus:outline-none z-20 disabled:cursor-not-allowed w-6 h-8 justify-center"
                style={{ left: `calc(8px + (100% - 16px) * ${tick.percent / 100})` }}
              >
                {/* Tick mark passing directly through the number line */}
                <div
                  className={`rounded-full transition-transform group-hover:scale-125 ${
                    isMajor
                      ? "h-5 w-[2.5px] bg-black"
                      : isMedium
                      ? "h-3.5 w-[2px] bg-neutral-800"
                      : "h-2 w-[1.5px] bg-neutral-400"
                  }`}
                />
                {isMajor && (
                  <span className="absolute top-[33px] text-[10px] font-black font-mono text-black select-none leading-none group-hover:underline">
                    {tick.value}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Range input slider for accessibility & keyboard navigation */}
        <input
          ref={inputRef}
          id={id}
          name={name}
          data-testid={dataTestId}
          type="range"
          min={2}
          max={6}
          step={0.25}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          onInput={(e) => onChange(parseFloat((e.target as HTMLInputElement).value))}
          aria-label={label}
          list={`${id}-ticks`}
          className="absolute left-0 right-0 top-9 -translate-y-1/2 w-full appearance-none bg-transparent pointer-events-none z-10 h-6 focus:outline-none disabled:cursor-not-allowed opacity-0"
        />

        <datalist id={`${id}-ticks`}>
          {RATING_TICKS.map((t) => (
            <option
              key={t.value}
              value={t.value}
              label={t.type === "major" ? String(t.value) : undefined}
            />
          ))}
        </datalist>
      </div>

      {/* Selected Level and Description at the bottom */}
      {showDescription && (
        <div
          data-testid="rating-level-info"
          className="rounded-xl border-2 border-black bg-white p-2.5 text-xs shadow-[2px_2px_0px_0px_#000] space-y-1"
        >
          <div className="flex items-center gap-2">
            <span className="font-mono font-black text-xs bg-[#ccff00] text-black border border-black px-1.5 py-0.5 rounded shadow-[1px_1px_0px_0px_#000]">
              {value.toFixed(2)}
            </span>
            <span className="font-black uppercase tracking-wider text-black">
              {tier.name}
            </span>
          </div>
          <p className="font-bold text-neutral-600 text-[11px] leading-relaxed">
            {tier.description}
          </p>
        </div>
      )}
    </div>
  );
}
