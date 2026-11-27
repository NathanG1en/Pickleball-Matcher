"use client";

import React, { useEffect, useRef } from "react";

/**
 * The value is the code as typed, one character per box. An empty box before a filled one is a
 * space ("12 456"), so clearing a middle digit doesn't slide the later ones over; trailing empty
 * boxes are trimmed ("12"). Use {@link isCompleteOtp} to check every box is filled.
 */
export interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  length?: number;
  id?: string;
  name?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  ariaLabel?: string;
  dataTestId?: string;
  className?: string;
  /** "checking" plays a little wave across the boxes while the code is being verified. */
  status?: "idle" | "checking";
  /** Change this number to shake the boxes once, e.g. after a wrong code. */
  shakeSignal?: number;
}

export function isCompleteOtp(value: string, length = 6): boolean {
  return new RegExp(`^\\d{${length}}$`).test(value);
}

function slotsFrom(value: string, length: number): string[] {
  return Array.from({ length }, (_, idx) => (/\d/.test(value[idx] ?? "") ? value[idx]! : ""));
}

function joinSlots(slots: readonly string[]): string {
  return slots.map((slot) => slot || " ").join("").trimEnd();
}

export function OtpInput({
  value = "",
  onChange,
  onComplete,
  length = 6,
  id = "otp-input",
  name,
  disabled = false,
  autoFocus = false,
  ariaLabel = "6-digit verification code",
  dataTestId,
  className = "",
  status = "idle",
  shakeSignal = 0,
}: OtpInputProps) {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const groupRef = useRef<HTMLDivElement>(null);
  const slots = slotsFrom(value, length);
  const firstEmpty = slots.findIndex((slot) => !slot);
  const autoFocusIndex = firstEmpty === -1 ? length - 1 : firstEmpty;

  // A one-shot shake after a wrong code, then focus back on the first box so the code can be
  // retyped straight over the old digits. Web Animations keeps the typed digits intact, where
  // re-mounting the boxes to replay a CSS animation would not.
  useEffect(() => {
    if (!shakeSignal || !groupRef.current) return;
    inputRefs.current[0]?.focus();
    inputRefs.current[0]?.select();
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    groupRef.current.animate?.(
      [
        { transform: "translateX(0)" },
        { transform: "translateX(-8px) rotate(-1deg)" },
        { transform: "translateX(7px) rotate(1deg)" },
        { transform: "translateX(-5px)" },
        { transform: "translateX(3px)" },
        { transform: "translateX(0)" },
      ],
      { duration: 420, easing: "cubic-bezier(0.36, 0.07, 0.19, 0.97)" },
    );
  }, [shakeSignal]);

  const focusSlot = (idx: number) => {
    const target = inputRefs.current[Math.max(0, Math.min(length - 1, idx))];
    target?.focus();
    target?.select();
  };

  /**
   * Auto-submit when the code first becomes complete, when the last box is typed, or when a whole
   * code is pasted. Fixing a middle digit of an already complete code waits for the submit button,
   * so retyping after a wrong code doesn't send it again after the first keystroke.
   */
  const commit = (nextSlots: string[], { submit = false }: { submit?: boolean } = {}) => {
    const next = joinSlots(nextSlots);
    onChange(next);
    if (!onComplete || !isCompleteOtp(next, length)) return;
    if (submit || !isCompleteOtp(value, length)) onComplete(next);
  };

  const handleChange = (idx: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const digits = event.target.value.replace(/\D/g, "");
    const nextSlots = [...slots];

    if (digits.length === 0) {
      // The box's digit was deleted in place.
      nextSlots[idx] = "";
      commit(nextSlots);
      return;
    }

    if (digits.length >= length) {
      // A whole code pasted or autofilled into any box fills every box.
      commit(digits.slice(0, length).split(""), { submit: true });
      focusSlot(length - 1);
      return;
    }

    // One new digit typed over the box's old one, or a few digits pasted from here on.
    const previous = slots[idx];
    const typed =
      previous && digits.length === 2
        ? [digits.startsWith(previous) ? digits[1]! : digits[0]!]
        : digits.split("");
    typed.forEach((digit, offset) => {
      if (idx + offset < length) nextSlots[idx + offset] = digit;
    });
    commit(nextSlots, { submit: idx + typed.length >= length });
    focusSlot(idx + typed.length);
  };

  const handleKeyDown = (idx: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case "ArrowLeft":
        event.preventDefault();
        focusSlot(idx - 1);
        return;
      case "ArrowRight":
        event.preventDefault();
        focusSlot(idx + 1);
        return;
      case "Home":
        event.preventDefault();
        focusSlot(0);
        return;
      case "End":
        event.preventDefault();
        focusSlot(length - 1);
        return;
      case "Backspace":
        if (!slots[idx] && idx > 0) {
          // An empty box steps back and clears the digit before it.
          event.preventDefault();
          const nextSlots = [...slots];
          nextSlots[idx - 1] = "";
          commit(nextSlots);
          focusSlot(idx - 1);
        }
        return;
      case "Delete":
        event.preventDefault();
        if (slots[idx]) {
          const nextSlots = [...slots];
          nextSlots[idx] = "";
          commit(nextSlots);
        }
        return;
    }
  };

  return (
    <div
      ref={groupRef}
      role="group"
      aria-label={ariaLabel}
      data-testid={dataTestId || id}
      data-state={status}
      className={`otp-group mx-auto grid w-full max-w-xs gap-1.5 sm:gap-2 ${className}`}
      style={{ gridTemplateColumns: `repeat(${length}, minmax(0, 1fr))` }}
    >
      {slots.map((slot, idx) => (
        <input
          key={idx}
          ref={(element) => {
            inputRefs.current[idx] = element;
          }}
          // Only the first box carries the id (for labels). The others have none, because browsers
          // guess field types from ids: "verify-email-otp-1" made Chrome offer saved email addresses.
          id={idx === 0 ? id : undefined}
          name={name ? `${name}-${idx}` : undefined}
          type="text"
          inputMode="numeric"
          // Every box is marked as a one-time code. Chrome ignores "off" for address autofill, and
          // this tells it (and iOS/macOS code autofill) what the box is for.
          autoComplete="one-time-code"
          pattern="[0-9]*"
          value={slot}
          onChange={(event) => handleChange(idx, event)}
          onKeyDown={(event) => handleKeyDown(idx, event)}
          onFocus={(event) => event.target.select()}
          onClick={(event) => event.currentTarget.select()}
          disabled={disabled}
          autoFocus={autoFocus && idx === autoFocusIndex}
          aria-label={`Digit ${idx + 1} of ${length}`}
          data-testid={`${dataTestId || id}-digit-${idx}`}
          data-filled={slot ? "true" : "false"}
          style={{ "--otp-index": idx } as React.CSSProperties}
          className={`
            otp-slot aspect-[4/5] w-full min-w-0 p-0
            rounded-lg sm:rounded-xl border-2 sm:border-[2.5px] border-black bg-white
            text-center text-xl sm:text-2xl font-black font-mono text-black caret-transparent selection:bg-transparent
            shadow-[2px_2px_0px_0px_#000] outline-none
            transition-[transform,background-color,box-shadow] duration-150 ease-out
            hover:-translate-y-0.5
            focus:-translate-y-1 focus:bg-[#ccff00] focus:shadow-[3px_4px_0px_0px_#000] focus:ring-2 focus:ring-black focus:ring-offset-1 disabled:cursor-not-allowed disabled:shadow-none disabled:bg-neutral-200 disabled:text-neutral-600 disabled:border-neutral-400 disabled:hover:bg-neutral-200
            cursor-pointer
          `}
        />
      ))}
    </div>
  );
}
