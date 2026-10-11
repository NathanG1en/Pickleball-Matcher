"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export interface BackButtonProps {
  fallbackHref?: string;
  href?: string;
  label?: React.ReactNode;
  className?: string;
}

export function BackButton({
  fallbackHref = "/",
  href,
  label = "← Back",
  className,
}: BackButtonProps) {
  const router = useRouter();

  const buttonClass =
    className ??
    "inline-flex items-center font-black uppercase text-xs text-black active:translate-x-0.5 active:translate-y-0.5 transition-transform cursor-pointer";

  if (href) {
    return (
      <Link href={href} className={buttonClass} aria-label="Go back">
        {label}
      </Link>
    );
  }

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      className={buttonClass}
      aria-label="Go back"
    >
      {label}
    </button>
  );
}

