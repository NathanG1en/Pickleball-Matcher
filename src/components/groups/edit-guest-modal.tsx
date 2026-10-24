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
  readonly initialFocus?: "name" | "gender";
  readonly onGuestUpdated?: (updatedName: string, updatedGender?: "male" | "female") => void;
}

export function EditGuestModal({
  isOpen,
  onClose,
  guestPlayer,
  groupId,
  initialFocus = "name",
  onGuestUpdated,
}: EditGuestModalProps) {
  if (!isOpen || !guestPlayer) return null;

  return (
    <EditGuestModalContent
      onClose={onClose}
      guestPlayer={guestPlayer}
      groupId={groupId}
      initialFocus={initialFocus}
      onGuestUpdated={onGuestUpdated}
    />
  );
}

function EditGuestModalContent({
  onClose,
  guestPlayer,
  groupId,
  initialFocus = "name",
  onGuestUpdated,
}: {
  readonly onClose: () => void;
  readonly guestPlayer: PlayerRecord;
  readonly groupId: string;
  readonly initialFocus?: "name" | "gender";
  readonly onGuestUpdated?: (updatedName: string, updatedGender?: "male" | "female") => void;
}) {
  const [name, setName] = useState(guestPlayer.name);
  const [gender, setGender] = useState<"male" | "female">(
    guestPlayer.gender === "female" ? "female" : "male",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Guest name cannot be empty.");
      return;
    }

    if (trimmed === guestPlayer.name && gender === guestPlayer.gender) {
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
        gender,
        idempotencyKey: createIdempotencyKey("guest_edit"),
      });

      if (res.ok) {
        onGuestUpdated?.(trimmed, gender);
        onClose();
      } else {
        setError(res.error ?? "Failed to update guest.");
      }
    } catch {
      setError("An unexpected error occurred while updating guest.");
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
      title="Edit Guest"
      description={`Update details for guest "${guestPlayer.name}".`}
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
            autoFocus={initialFocus === "name"}
            maxLength={60}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError(null);
            }}
            placeholder="e.g. Jordan Smith"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="edit-guest-gender-select">Guest Gender</Label>
          <select
            id="edit-guest-gender-select"
            value={gender}
            autoFocus={initialFocus === "gender"}
            onChange={(e) => {
              setGender(e.target.value as "male" | "female");
              if (error) setError(null);
            }}
            className="w-full bg-white border-2 border-black rounded-xl px-4 py-2 text-black font-bold text-sm shadow-[2px_2px_0px_0px_#000] focus:shadow-[4px_4px_0px_0px_#000] focus:outline-none transition-shadow cursor-pointer"
          >
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
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

