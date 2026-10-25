"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDownIcon, SearchIcon } from "@/components/ui/icons";

export interface FilterablePlayerOption {
  readonly id: string;
  readonly name: string;
  readonly disabled?: boolean;
  readonly selectedElsewhere?: boolean;
}

export interface FilterablePlayerSelectProps {
  readonly ariaLabel: string;
  readonly placeholder?: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly options: readonly FilterablePlayerOption[];
  readonly disabled?: boolean;
  readonly sizeVariant?: "sm" | "md";
  readonly className?: string;
  readonly dataTestId?: string;
}

export function FilterablePlayerSelect({
  ariaLabel,
  placeholder = "Select Player...",
  value,
  onChange,
  options,
  disabled = false,
  sizeVariant = "md",
  className = "",
  dataTestId,
}: FilterablePlayerSelectProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const uniqueOptions = useMemo(() => {
    const seen = new Set<string>();
    return options.filter((opt) => {
      if (!opt.id || seen.has(opt.id)) return false;
      seen.add(opt.id);
      return true;
    });
  }, [options]);

  const selectedOption = useMemo(
    () => uniqueOptions.find((opt) => opt.id === value),
    [uniqueOptions, value],
  );

  const filteredOptions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return uniqueOptions;
    return uniqueOptions.filter((opt) => opt.name.toLowerCase().includes(q));
  }, [uniqueOptions, searchQuery]);

  // Close on click outside or Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        setSearchQuery("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Focus search input when popover opens
  useEffect(() => {
    if (isOpen) {
      // Small tick to ensure element is rendered
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 10);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleSelectOption = (optionId: string) => {
    onChange(optionId);
    setIsOpen(false);
    setSearchQuery("");
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Styled Combobox Trigger Button */}
      <button
        type="button"
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-label={ariaLabel}
        data-testid={dataTestId}
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setIsOpen((prev) => {
              if (prev) {
                setSearchQuery("");
                return false;
              }
              return true;
            });
          }
        }}
        className={`w-full flex items-center justify-between text-left rounded-xl border-2 border-black bg-white font-bold transition-all shadow-[2px_2px_0px_0px_#000] focus:outline-none ${
          sizeVariant === "sm" ? "p-1.5 text-sm" : "p-2 text-sm"
        } ${
          disabled
            ? "opacity-50 cursor-not-allowed"
            : "cursor-pointer hover:bg-neutral-50 active:translate-x-0.5 active:translate-y-0.5"
        }`}
      >
        <span
          className={`truncate ${
            selectedOption ? "text-black font-black" : "text-neutral-500 font-semibold"
          }`}
        >
          {selectedOption ? selectedOption.name : placeholder}
        </span>
        <ChevronDownIcon
          className={`h-4 w-4 shrink-0 ml-1.5 text-neutral-600 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div
          id={listboxId}
          role="listbox"
          aria-label={`${ariaLabel} options`}
          className="absolute left-0 right-0 top-full mt-1.5 z-40 rounded-xl border-2 border-black bg-white p-2 shadow-[4px_4px_0px_0px_#000] space-y-2 animate-in fade-in duration-100"
        >
          {/* Search Filter Input inside Dropdown */}
          <div className="relative">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Filter players..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.stopPropagation();
                  setIsOpen(false);
                  setSearchQuery("");
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  const firstValid = filteredOptions.find((opt) => !opt.disabled);
                  if (firstValid) {
                    handleSelectOption(firstValid.id);
                  }
                }
              }}
              aria-label={`Filter ${ariaLabel} options`}
              data-testid="filterable-select-search"
              className="w-full pl-8 pr-7 py-1.5 rounded-lg border border-black text-xs font-bold focus:outline-none bg-neutral-50"
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="Clear filter"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black font-black text-xs p-0.5 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Options List */}
          <div className="max-h-48 overflow-y-auto space-y-1">
            {value && (
              <button
                type="button"
                onClick={() => handleSelectOption("")}
                className="w-full text-left px-2 py-1 text-[11px] font-bold text-neutral-500 hover:bg-neutral-100 rounded-lg cursor-pointer"
              >
                Clear selection
              </button>
            )}

            {filteredOptions.length === 0 ? (
              <div className="py-3 text-center text-xs text-neutral-500 font-semibold italic">
                No players found matching &quot;{searchQuery}&quot;
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.id === value;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={opt.disabled}
                    data-testid={`player-option-${opt.id}`}
                    onClick={() => {
                      if (!opt.disabled) {
                        handleSelectOption(opt.id);
                      }
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-bold text-left transition-colors ${
                      opt.disabled
                        ? "opacity-40 cursor-not-allowed bg-neutral-50 text-neutral-400"
                        : isSelected
                        ? "bg-[#ccff00] text-black border border-black cursor-pointer font-black"
                        : "hover:bg-neutral-100 cursor-pointer text-black"
                    }`}
                  >
                    <span className="truncate">{opt.name}</span>
                    <span className="text-[10px] font-semibold shrink-0 ml-2">
                      {opt.selectedElsewhere || opt.disabled ? "(Selected)" : isSelected ? "✓" : ""}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
