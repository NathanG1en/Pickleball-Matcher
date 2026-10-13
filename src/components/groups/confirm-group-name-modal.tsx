"use client";

import React, { useState } from "react";
import { Button, Input, Label, Modal } from "@/components/ui";

export interface ConfirmGroupNameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (confirmationName: string) => Promise<void> | void;
  title: string;
  description: string;
  groupName: string;
  confirmButtonText: string;
  pendingButtonText?: string;
  confirmVariant?: "danger" | "primary";
  error?: string | null;
  isPending?: boolean;
  onClearError?: () => void;
}

export function ConfirmGroupNameModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  groupName,
  confirmButtonText,
  pendingButtonText = "Confirming…",
  confirmVariant = "danger",
  error,
  isPending = false,
  onClearError,
}: ConfirmGroupNameModalProps) {
  const [confirmName, setConfirmName] = useState("");

  const isConfirmed =
    Boolean(groupName.trim()) &&
    confirmName.trim().toLowerCase() === groupName.trim().toLowerCase();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConfirmed || isPending) return;
    await onConfirm(confirmName.trim());
  };

  const handleClose = () => {
    setConfirmName("");
    if (onClearError) onClearError();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="sm"
      role="alertdialog"
      showCloseButton={false}
      title={title}
      description={description}
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <Label htmlFor="confirm-group-name" className="text-neutral-600">
            Type <span className="text-black font-black select-all">&quot;{groupName}&quot;</span> to confirm
          </Label>
          <Input
            id="confirm-group-name"
            type="text"
            required
            sizeVariant="sm"
            value={confirmName}
            onChange={(e) => {
              setConfirmName(e.target.value);
              if (onClearError) onClearError();
            }}
            placeholder={groupName}
            autoFocus
          />
        </div>

        {error && (
          <p role="alert" className="text-xs font-bold text-red-600">
            {error}
          </p>
        )}

        <div className="flex gap-3 justify-end pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isPending}
            className="font-display text-xs uppercase tracking-wider"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant={confirmVariant}
            disabled={!isConfirmed || isPending}
            className="font-display text-xs uppercase tracking-wider"
          >
            {isPending ? pendingButtonText : confirmButtonText}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

