"use client";

import React, { useState } from "react";
import { Button, Input, Label, Modal } from "@/components/ui";
import { updatePlayerAction } from "@/app/actions/players";
import { createIdempotencyKey } from "@/lib/utils/idempotency";
import type { PlayerRecord } from "@/lib/domain/types";

export interface EditGuestModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly guestPlayer: PlayerRecord | null;
  readonly groupId: string;
  readonly onGuestUpdated?: (updatedName: string) => void;
}

export function EditGuestModal({
  isOpen,
  onClose,
  guestPlayer,
  groupId,
  onGuestUpdated,
}: EditGuestModalProps) {
  if (!isOpen || !guestPlayer) return null;

  return (
    <EditGuestModalContent
      onClose={onClose}
      guestPlayer={guestPlayer}
      groupId={groupId}
      onGuestUpdated={onGuestUpdated}
    />
  );
}

function EditGuestModalContent({
  onClose,
  guestPlayer,
  groupId,
  onGuestUpdated,
}: {
  readonly onClose: () => void;
  readonly guestPlayer: PlayerRecord;
  readonly groupId: string;
  readonly onGuestUpdated?: (updatedName: string) => void;
}) {
  const [name, setName] = useState(guestPlayer.name);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Guest name cannot be empty.");
      return;
    }

    if (trimmed === guestPlayer.name) {
      onClose();
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const res = await updatePlayerAction({
        groupId,
        playerId: guestPlayer.id,
        name: trimmed,
        idempotencyKey: createIdempotencyKey("guest_edit"),
      });

      if (res.ok) {
        onGuestUpdated?.(trimmed);
        onClose();
      } else {
        setError(res.error ?? "Failed to update guest name.");
      }
    } catch {
      setError("An unexpected error occurred while updating guest name.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  return (
    <Modal
      isOpen={true}
      onClose={handleClose}
      size="sm"
      role="dialog"
      title="Edit Guest Name"
      description={`Update the display name for guest "${guestPlayer.name}".`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div
            role="alert"
            className="p-3 bg-red-100 border-2 border-red-500 rounded-xl text-red-700 text-xs font-bold"
          >
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="edit-guest-name-input">Guest Name</Label>
          <Input
            id="edit-guest-name-input"
            type="text"
            required
            autoFocus
            maxLength={60}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError(null);
            }}
            placeholder="e.g. Jordan Smith"
          />
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isSaving || !name.trim()}
          >
            {isSaving ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

