"use client";

import React, { useRef, useState } from "react";

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
  const [isFocused, setIsFocused] = useState(false);

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
      className={`relative inline-flex items-center justify-center select-none ${className}`}
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
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        disabled={disabled}
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        data-testid={dataTestId || id}
        className="absolute inset-0 z-10 w-full h-full opacity-0 cursor-pointer caret-transparent"
      />

      {/* Visual 6-box segmented display */}
      <div className="flex items-center justify-center gap-2 sm:gap-2.5" aria-hidden="true">
        {Array.from({ length }).map((_, idx) => {
          const char = value[idx] || "";
          // Active slot is the first empty slot, or the last slot if full
          const isCurrent =
            isFocused &&
            !disabled &&
            (idx === value.length || (idx === length - 1 && value.length === length));

          return (
            <div
              key={idx}
              className={`
                w-11 h-13 sm:w-12 sm:h-14
                flex items-center justify-center
                border-2 sm:border-[2.5px] border-black
                rounded-lg sm:rounded-xl
                text-xl sm:text-2xl font-black font-mono text-black
                transition-all duration-150
                shadow-[2px_2px_0px_0px_#000]
                ${isCurrent ? "bg-[#ccff00] ring-2 ring-black ring-offset-1 scale-[1.03]" : "bg-white"}
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
