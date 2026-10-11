"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export function BackButton({
  fallbackHref = "/",
  href,
}: {
  fallbackHref?: string;
  href?: string;
}) {
  const router = useRouter();

  if (href) {
    return (
      <Link
        href={href}
        className="inline-flex items-center font-black uppercase text-xs text-black active:translate-x-0.5 active:translate-y-0.5 transition-transform cursor-pointer"
        aria-label="Go back"
      >
        ← Back
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
      className="inline-flex items-center font-black uppercase text-xs text-black active:translate-x-0.5 active:translate-y-0.5 transition-transform cursor-pointer"
      aria-label="Go back"
    >
      ← Back
    </button>
  );
}


