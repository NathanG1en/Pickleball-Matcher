"use client";

import { useRouter } from "next/navigation";

export function BackButton({
  fallbackHref = "/",
  label = "← Back",
  className,
}: {
  fallbackHref?: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();

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
      className={
        className ??
        "inline-flex items-center font-black uppercase text-xs text-black active:translate-x-0.5 active:translate-y-0.5 transition-transform cursor-pointer"
      }
      aria-label="Go back"
    >
      {label}
    </button>
  );
}

