"use client";

import React from "react";
import { useHydrated } from "@/lib/utils/hydration";

export interface ClientDateProps {
  readonly date: Date | string | number;
  readonly options?: Intl.DateTimeFormatOptions;
  readonly className?: string;
  readonly prefix?: React.ReactNode;
}

export function ClientDate({ date, options, className, prefix }: ClientDateProps) {
  const isHydrated = useHydrated();
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  const iso = !isNaN(d.getTime()) ? d.toISOString() : undefined;
  const formatted = isHydrated && iso ? d.toLocaleDateString(undefined, options) : "";

  return (
    <span className={className}>
      {prefix}
      <time dateTime={iso} className={isHydrated ? undefined : "invisible"}>
        {formatted}
      </time>
    </span>
  );
}

export interface ClientTimeProps {
  readonly date: Date | string | number;
  readonly options?: Intl.DateTimeFormatOptions;
  readonly className?: string;
  readonly prefix?: React.ReactNode;
}

export function ClientTime({ date, options, className, prefix }: ClientTimeProps) {
  const isHydrated = useHydrated();
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  const iso = !isNaN(d.getTime()) ? d.toISOString() : undefined;
  const formatted = isHydrated && iso
    ? d.toLocaleTimeString(undefined, options ?? { hour: "numeric", minute: "2-digit" })
    : "";

  return (
    <span className={className}>
      {prefix}
      <time dateTime={iso} className={isHydrated ? undefined : "invisible"}>
        {formatted}
      </time>
    </span>
  );
}
