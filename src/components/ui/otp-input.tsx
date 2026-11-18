"use client";

import React, { useRef } from "react";

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
}: OtpInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only accept numeric digits, up to `length` characters
    const raw = e.target.value;
    const sanitized = raw.replace(/\D/g, "").slice(0, length);
    onChange(sanitized);

    if (sanitized.length === length && onComplete) {
      onComplete(sanitized);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      // Allow default arrow behavior
    }
  };

  return (
    <div
      className={`group relative mx-auto w-full max-w-xs select-none ${className}`}
      onClick={() => inputRef.current?.focus()}
    >
      {/* Real accessible input overlaying the slots */}
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={length}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        data-testid={dataTestId || id}
        className="absolute inset-0 z-10 w-full h-full opacity-0 cursor-pointer caret-transparent"
      />

      {/* Visual segmented display: the slots share the available width, so six of them fit a 320px phone. */}
      <div
        className="grid gap-1.5 sm:gap-2"
        style={{ gridTemplateColumns: `repeat(${length}, minmax(0, 1fr))` }}
        aria-hidden="true"
      >
        {Array.from({ length }).map((_, idx) => {
          const char = value[idx] || "";
          // Active slot is the first empty slot, or the last slot if full. It lights up through
          // :focus-within so it also works when the browser auto-focuses before hydration.
          const isCurrent =
            !disabled && (idx === value.length || (idx === length - 1 && value.length === length));

          return (
            <div
              key={idx}
              className={`
                aspect-[4/5] w-full min-w-0
                flex items-center justify-center
                border-2 sm:border-[2.5px] border-black
                rounded-lg sm:rounded-xl
                text-xl sm:text-2xl font-black font-mono text-black
                transition-all duration-150
                shadow-[2px_2px_0px_0px_#000]
                bg-white
                ${isCurrent ? "group-focus-within:bg-[#ccff00] group-focus-within:ring-2 group-focus-within:ring-black group-focus-within:ring-offset-1" : ""}
                ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
              `}
            >
              {char}
            </div>
          );
        })}
      </div>
    </div>
  );
}
