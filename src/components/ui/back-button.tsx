"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export interface BackButtonProps {
  fallbackHref?: string;
  href?: string;
  label?: React.ReactNode;
  ariaLabel?: string;
  className?: string;
  onClick?: (event: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => void;
}

export function BackButton({
  fallbackHref = "/",
  href,
  label = "← Back",
  ariaLabel = "Go back",
  className,
  onClick,
}: BackButtonProps) {
  const router = useRouter();

  const buttonClass =
    className ??
    "inline-flex items-center font-black uppercase text-xs text-black active:translate-x-0.5 active:translate-y-0.5 transition-transform cursor-pointer";

  if (href) {
    return (
      <Link
        href={href}
        className={buttonClass}
        aria-label={ariaLabel}
        onClick={onClick}
      >
        {label}
      </Link>
    );
  }

  const handleBack = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (onClick) {
      onClick(event);
      return;
    }
    if (typeof window !== "undefined") {
      const hasExternalReferrer =
        typeof document !== "undefined" &&
        Boolean(document.referrer) &&
        !document.referrer.startsWith(window.location.origin);

      if (window.history.length > 1 && !hasExternalReferrer) {
        router.back();
        return;
      }
    }
    router.push(fallbackHref);
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      className={buttonClass}
      aria-label={ariaLabel}
    >
      {label}
    </button>
  );
}

