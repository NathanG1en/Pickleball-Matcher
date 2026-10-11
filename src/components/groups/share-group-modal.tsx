"use client";

import { useEffect, useState } from "react";
import { QRCodeDisplay } from "./qr-code";

export function ShareGroupModal({
  isOpen,
  onClose,
  groupId,
  groupName,
}: {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  groupName: string;
}) {
  const [copied, setCopied] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const shareUrl = origin ? `${origin}/g/${groupId}/join` : `/g/${groupId}/join`;
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const input = document.getElementById("share-group-url-input") as HTMLInputElement | null;
        if (input) {
          input.select();
          document.execCommand("copy");
        }
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      setCopied(false);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${groupName}`,
          text: `Join our pickleball group "${groupName}" on Pickleball Matcher!`,
          url: shareUrl,
        });
      } catch {
        // User cancelled or share failed
      }
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-group-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-sm rounded-3xl border-[3px] border-black bg-white p-6 text-center text-black shadow-[8px_8px_0px_0px_#000] sm:p-7 space-y-4">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close share dialog"
          className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full border-2 border-black bg-white text-xl font-black leading-none hover:bg-[#fde047] cursor-pointer"
        >
          ×
        </button>

        <div className="space-y-1 pr-6 text-left">
          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#ccff00] border-2 border-black">
            Share Group
          </span>
          <h2 id="share-group-title" className="font-display text-2xl sm:text-3xl font-black uppercase tracking-tight text-black">
            {groupName}
          </h2>
          <p className="text-xs font-bold text-neutral-600">
            Invite players to join. Anyone with the link or QR code can join even if the group is private.
          </p>
        </div>

        {/* QR Code Container */}
        <div className="flex flex-col items-center justify-center py-2 space-y-2">
          <QRCodeDisplay url={shareUrl} size={190} />
          <p className="text-[11px] font-black uppercase tracking-wider text-neutral-700">
            Scan with phone camera to join
          </p>
        </div>

        {/* Copy Link Input & Button */}
        <div className="space-y-2">
          <div className="flex items-stretch gap-2">
            <input
              id="share-group-url-input"
              type="text"
              readOnly
              value={shareUrl}
              aria-label="Share group link"
              className="flex-1 min-w-0 px-3 py-2 text-xs font-bold border-2 border-black rounded-xl bg-neutral-50 shadow-[2px_2px_0px_0px_#000] focus:outline-none select-all text-neutral-800"
            />
            <button
              type="button"
              onClick={handleCopy}
              className="shrink-0 px-3.5 py-2 rounded-xl bg-[#ccff00] hover:bg-[#b8eb00] text-black border-2 border-black font-display font-black uppercase text-xs tracking-wider shadow-[2px_2px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
            >
              {copied ? "Copied! ✓" : "Copy Link"}
            </button>
          </div>

          {canNativeShare && (
            <button
              type="button"
              onClick={handleNativeShare}
              className="w-full py-2 px-3 rounded-xl bg-white hover:bg-neutral-50 text-black border-2 border-black font-display font-black uppercase text-xs tracking-wider shadow-[2px_2px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
            >
              Share via Apps…
            </button>
          )}
        </div>

        <p className="text-[11px] font-semibold text-neutral-600 leading-tight">
          New players can sign in, create an account, or join as a guest right away.
        </p>
      </div>
    </div>
  );
}

export function ShareGroupButton({
  groupId,
  groupName,
  className = "",
}: {
  groupId: string;
  groupName: string;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Share group link and QR code"
        className={`px-3 py-1.5 rounded-xl bg-white border-2 border-black font-black uppercase text-xs text-black shadow-[2px_2px_0px_0px_#000] hover:bg-neutral-50 active:translate-x-0.5 active:translate-y-0.5 transition-all flex items-center gap-1.5 cursor-pointer ${className}`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-3.5 h-3.5"
          aria-hidden="true"
        >
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
          <polyline points="16 6 12 2 8 6" />
          <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
        <span>Share</span>
      </button>

      <ShareGroupModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        groupId={groupId}
        groupName={groupName}
      />
    </>
  );
}
