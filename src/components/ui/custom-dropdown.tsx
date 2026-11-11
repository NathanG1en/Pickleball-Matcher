"use client";

import React, { useState, useRef, useEffect, useId } from "react";
import { ChevronDownIcon, CheckIcon } from "@/components/ui/icons";

export interface CustomDropdownOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface CustomDropdownProps {
  id?: string;
  name?: string;
  options: CustomDropdownOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  hasError?: boolean;
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  sizeVariant?: "xs" | "sm" | "md";
  ariaLabel?: string;
  "aria-label"?: string;
  dataTestId?: string;
  align?: "left" | "right";
}

export function CustomDropdown({
  id,
  name,
  options,
  value,
  onChange,
  disabled = false,
  required = false,
  hasError = false,
  placeholder,
  className = "",
  buttonClassName = "",
  menuClassName = "",
  sizeVariant = "sm",
  ariaLabel,
  "aria-label": ariaLabelProp,
  dataTestId,
  align = "left",
}: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const generatedId = useId();
  const listboxId = id ? `${id}-listbox` : `dropdown-listbox-${generatedId}`;
  const computedAriaLabel = ariaLabel ?? ariaLabelProp;

  const currentOption = options.find((opt) => opt.value === value);
  const displayLabel = currentOption ? currentOption.label : (placeholder ?? (options[0]?.label ?? value));

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const sizeClasses = {
    xs: "px-2 py-1 text-xs gap-1.5 rounded-lg shadow-[1px_1px_0px_0px_#000]",
    sm: "px-3 py-2 text-xs gap-2 rounded-xl shadow-[2px_2px_0px_0px_#000]",
    md: "px-3.5 py-2.5 text-sm gap-2.5 rounded-xl shadow-[2px_2px_0px_0px_#000]",
  };

  const iconSizes = {
    xs: "h-3 w-3",
    sm: "h-3.5 w-3.5",
    md: "h-4 w-4",
  };

  return (
    <div ref={containerRef} className={`relative inline-block max-w-full ${className}`}>
      {/* Visual trigger button */}
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-label={computedAriaLabel}
        data-testid={dataTestId}
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setIsOpen((prev) => !prev);
          }
        }}
        className={`inline-flex items-center justify-between min-w-0 max-w-full font-bold text-black border-2 transition-all cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed ${
          hasError
            ? "border-red-600 bg-red-50 focus:ring-red-600"
            : "border-black bg-white"
        } ${sizeClasses[sizeVariant]} ${buttonClassName}`}
      >
        <span className={`truncate ${!currentOption && placeholder ? "text-neutral-500 font-semibold" : ""}`}>
          {displayLabel}
        </span>
        <ChevronDownIcon
          className={`shrink-0 text-black stroke-[2.5] transition-transform duration-150 ${
            isOpen ? "rotate-180" : ""
          } ${iconSizes[sizeVariant]}`}
        />
      </button>

      {/* Dropdown Menu Popover */}
      {isOpen && (
        <div
          id={listboxId}
          role="listbox"
          aria-label={computedAriaLabel}
          className={`absolute z-50 mt-1 min-w-full w-max max-w-[320px] max-h-60 overflow-y-auto rounded-xl border-2 border-black bg-[#FFFDF7] p-1 shadow-[3px_3px_0px_0px_#000] dropdown-animate ${
            align === "right" ? "right-0" : "left-0"
          } ${menuClassName}`}
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={opt.disabled}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                  triggerRef.current?.focus();
                }}
                className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs font-bold transition-colors select-none ${
                  opt.disabled
                    ? "opacity-40 cursor-not-allowed text-neutral-400"
                    : isSelected
                    ? "bg-[#ccff00] text-black font-black cursor-pointer"
                    : "hover:bg-[#F0EEE7] active:bg-[#EAE5D9] text-black cursor-pointer"
                }`}
              >
                <span className="truncate">{opt.label}</span>
                {isSelected && <CheckIcon className="h-3.5 w-3.5 shrink-0 stroke-[2.5] text-black" />}
              </button>
            );
          })}
        </div>
      )}

      {/* Native select for accessibility tools, form serialization, and Playwright locators */}
      {(id || name || computedAriaLabel) && (
        <select
          id={id}
          name={name}
          value={value}
          required={required}
          onChange={(e) => onChange(e.target.value)}
          tabIndex={-1}
          aria-label={computedAriaLabel}
          className="absolute inset-0 w-full h-full opacity-0 pointer-events-none -z-10"
        >
          {placeholder && !options.some((opt) => opt.value === "") && (
            <option value="">{placeholder}</option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

