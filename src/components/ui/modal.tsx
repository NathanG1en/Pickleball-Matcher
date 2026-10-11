"use client";

import React, { useEffect, useId } from "react";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  showCloseButton?: boolean;
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
  role?: "dialog" | "alertdialog";
  className?: string;
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = "md",
  showCloseButton = true,
  closeOnBackdropClick = true,
  closeOnEscape = true,
  role = "dialog",
  className = "",
}: ModalProps) {
  const generatedId = useId();
  const titleId = `${generatedId}-title`;
  const descId = `${generatedId}-desc`;

  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeOnEscape, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
  };

  return (
    <div
      role={role}
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
      aria-describedby={description ? descId : undefined}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (closeOnBackdropClick && e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={`relative w-full ${sizeClasses[size]} rounded-3xl border-[3px] border-black bg-white p-6 text-black shadow-[8px_8px_0px_0px_#000] sm:p-7 space-y-4 max-h-[90vh] overflow-y-auto ${className}`}
      >
        {showCloseButton && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full border-2 border-black bg-white text-lg font-black leading-none hover:bg-[#fde047] active:translate-x-0.5 active:translate-y-0.5 cursor-pointer transition-colors"
          >
            ×
          </button>
        )}

        {(title || description) && (
          <div className="space-y-1 pr-6">
            {title && (
              <h2
                id={titleId}
                className="font-display text-2xl font-black uppercase tracking-tight text-black"
              >
                {title}
              </h2>
            )}
            {description && (
              <p id={descId} className="text-xs font-bold text-neutral-600">
                {description}
              </p>
            )}
          </div>
        )}

        {children}
      </div>
    </div>
  );
}

export function ModalHeader({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`mb-3 pb-2 border-b-2 border-neutral-100 flex items-center justify-between ${className}`}>
      {children}
    </div>
  );
}

export function ModalFooter({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`mt-4 pt-2 flex items-center justify-end gap-3 ${className}`}>
      {children}
    </div>
  );
}

