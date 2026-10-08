"use client";

import React, { useEffect, useState, useSyncExternalStore } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "pickleball_dismiss_home_tip";

function subscribeDismiss(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  window.addEventListener("pickleball_dismiss_home_tip_changed", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("pickleball_dismiss_home_tip_changed", callback);
  };
}

function getDismissSnapshot(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(DISMISS_KEY) === "true";
  } catch {
    return true;
  }
}

function getIsStandalone(): boolean {
  if (typeof window === "undefined") return true;
  if (typeof window.matchMedia === "function") {
    if (window.matchMedia("(display-mode: standalone)").matches) return true;
  }
  return (window.navigator as unknown as { standalone?: boolean })?.standalone === true;
}

export function HomeScreenTip() {
  const isDismissed = useSyncExternalStore(
    subscribeDismiss,
    getDismissSnapshot,
    () => true
  );

  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [localDismissed, setLocalDismissed] = useState(false);

  useEffect(() => {
    // Listen for native install prompt on supported browsers (Chrome / Android)
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const isStandalone = getIsStandalone();
  const isIOS =
    typeof window !== "undefined" &&
    Boolean(window.navigator?.userAgent && /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase()));

  const handleDismiss = () => {
    setLocalDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "true");
      window.dispatchEvent(new Event("pickleball_dismiss_home_tip_changed"));
    } catch {
      // Storage unavailable
    }
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        handleDismiss();
      }
      setDeferredPrompt(null);
    } catch {
      // Fallback
    }
  };

  if (isDismissed || localDismissed || isStandalone) {
    return null;
  }

  return (
    <aside
      aria-label="Add to home screen tip"
      className="p-4 rounded-2xl bg-[#fef08a] border-[3px] border-black shadow-[4px_4px_0px_0px_#000] text-black space-y-2.5 relative"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider text-black bg-white border border-black shadow-[1px_1px_0px_0px_#000]">
          📱 Courtside Pro Tip
        </span>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss tip"
          className="w-7 h-7 flex items-center justify-center rounded-lg border border-black bg-white hover:bg-neutral-100 text-sm font-black text-black shadow-[1px_1px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
        >
          ×
        </button>
      </div>

      <div>
        <h3 className="font-display text-lg font-black uppercase text-black leading-tight">
          Save 1-Tap App to Your Phone
        </h3>
        <p className="text-xs font-bold text-neutral-800 mt-1 leading-snug">
          Open your group straight from your home screen during match days—no links or bookmarks needed.
        </p>
      </div>

      {deferredPrompt ? (
        <button
          type="button"
          onClick={handleInstallClick}
          className="w-full py-2.5 px-4 rounded-xl bg-black hover:bg-neutral-900 text-[#ccff00] font-black text-xs uppercase tracking-wide border-2 border-black shadow-[2px_2px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer font-display"
        >
          Install App to Home Screen →
        </button>
      ) : isIOS ? (
        <div className="p-2.5 rounded-xl bg-white/90 border border-black text-xs font-bold text-neutral-900 space-y-1">
          <p>
            1. Tap the <strong className="font-black">Share</strong> icon (square with arrow ↑) in Safari.
          </p>
          <p>
            2. Tap <strong className="font-black">&quot;Add to Home Screen&quot;</strong>.
          </p>
        </div>
      ) : (
        <div className="p-2.5 rounded-xl bg-white/90 border border-black text-xs font-bold text-neutral-900 space-y-1">
          <p>
            Tap browser menu (<strong className="font-black">⋮</strong>), then tap <strong className="font-black">&quot;Add to Home screen&quot;</strong> or <strong className="font-black">&quot;Install App&quot;</strong>.
          </p>
        </div>
      )}
    </aside>
  );
}
