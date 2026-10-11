"use client";

import React from "react";
import { Modal } from "./modal";
import { Button } from "./button";

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: React.ReactNode;
  description: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: "danger" | "primary";
  disabled?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = "Are you sure?",
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmVariant = "danger",
  disabled = false,
}: ConfirmDialogProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      role="alertdialog"
      showCloseButton={false}
      closeOnBackdropClick={!disabled}
      closeOnEscape={!disabled}
    >
      <div className="space-y-4">
        {title && (
          <h3 className="font-display text-2xl font-black uppercase tracking-tight text-black">
            {title}
          </h3>
        )}
        <div className="text-sm font-bold text-neutral-700">
          {description}
        </div>
        <div className="flex gap-3 justify-end pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={disabled}
            className="font-display uppercase tracking-wider text-sm"
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            variant={confirmVariant}
            onClick={onConfirm}
            disabled={disabled}
            className="font-display uppercase tracking-wider text-sm"
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

