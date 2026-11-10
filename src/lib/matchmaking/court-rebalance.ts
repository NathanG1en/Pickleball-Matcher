/**
 * Helper to compute smart, guided court rebalance options when attendance changes mid-session.
 */

export interface CourtChoice {
  readonly id: "doubles_rotate" | "all_active";
  readonly title: string;
  readonly badge: string;
  readonly courtCount: number;
  readonly courts: (2 | 3 | 4)[];
  readonly capacity: number;
  readonly sitting: number;
  readonly summary: string;
  readonly details: string;
}

export function getCourtRebalanceChoices(
  presentCount: number,
  baseCourtCount: number = 2,
  maxAvailableCourts: number = 6
): CourtChoice[] {
  if (presentCount < 2) return [];

  // Choice 1: Maximize full 4-player doubles courts, extras rotate
  const doublesCourtsCount = Math.max(1, Math.min(baseCourtCount, Math.floor(presentCount / 4)));
  let choice1Courts: (2 | 3 | 4)[];
  if (presentCount < 4) {
    choice1Courts = [Math.max(2, Math.min(3, presentCount)) as 2 | 3];
  } else {
    choice1Courts = Array.from({ length: doublesCourtsCount }, () => 4 as const);
  }
  const choice1Capacity = choice1Courts.reduce((sum, c) => sum + c, 0);
  const choice1Sitting = Math.max(0, presentCount - choice1Capacity);

  const choice1: CourtChoice = {
    id: "doubles_rotate",
    title: presentCount >= 4 ? "Full 2v2 Doubles" : "1 Court",
    badge: choice1Sitting > 0 ? `${choice1Sitting} Rotating` : "0 Sitting",
    courtCount: choice1Courts.length,
    courts: choice1Courts,
    capacity: choice1Capacity,
    sitting: choice1Sitting,
    summary: `${choice1Courts.length} ${choice1Courts.length === 1 ? "Court" : "Courts"} (4 players each)`,
    details: choice1Sitting > 0
      ? `${choice1Sitting} ${choice1Sitting === 1 ? "player rotates" : "players rotate"} each round`
      : "All players active every round",
  };

  // Choice 2: Maximize active players across courts (fill additional courts with 2v1 or 1v1)
  // Target courts: at least baseCourtCount (if presentCount allows) up to Math.floor(presentCount / 2)
  const maxPossible = Math.min(maxAvailableCourts, Math.floor(presentCount / 2));
  const targetCourts = Math.min(maxPossible, Math.max(baseCourtCount, Math.ceil(presentCount / 4)));

  if (choice1Sitting === 0 && choice1Courts.every((c) => c === 4)) {
    return [choice1];
  }

  if (targetCourts <= choice1Courts.length && choice1Sitting === 0) {
    return [choice1];
  }

  // Distribute presentCount across targetCourts
  let remaining = presentCount;
  const choice2Courts: (2 | 3 | 4)[] = [];
  for (let i = 0; i < targetCourts; i++) {
    const courtsRemaining = targetCourts - i - 1;
    const minNeededLater = courtsRemaining * 2;
    const maxPossibleLater = courtsRemaining * 4;
    const minThis = Math.max(2, remaining - maxPossibleLater);
    const maxThis = Math.min(4, remaining - minNeededLater);
    const size = Math.min(4, Math.max(2, Math.max(minThis, Math.min(4, maxThis)))) as 2 | 3 | 4;
    choice2Courts.push(size);
    remaining -= size;
  }

  const choice2Capacity = choice2Courts.reduce((sum, c) => sum + c, 0);
  const choice2Sitting = Math.max(0, presentCount - choice2Capacity);

  // Check if choice 2 is structurally identical to choice 1
  const isSame =
    choice2Courts.length === choice1Courts.length &&
    choice2Courts.every((c, idx) => c === choice1Courts[idx]);

  if (isSame) {
    return [choice1];
  }

  const doublesCount = choice2Courts.filter((c) => c === 4).length;
  const cutthroatCount = choice2Courts.filter((c) => c === 3).length;
  const singlesCount = choice2Courts.filter((c) => c === 2).length;

  const parts: string[] = [];
  if (doublesCount > 0) parts.push(`${doublesCount} Doubles (2v2)`);
  if (cutthroatCount > 0) parts.push(`${cutthroatCount} 2v1 (${cutthroatCount === 1 ? "Court" : "Courts"})`);
  if (singlesCount > 0) parts.push(`${singlesCount} Singles (1v1)`);

  const choice2: CourtChoice = {
    id: "all_active",
    title: choice2Sitting === 0 ? "Everyone Plays" : "Active Play",
    badge: choice2Sitting === 0 ? "0 Sitting" : `${choice2Sitting} Rotating`,
    courtCount: choice2Courts.length,
    courts: choice2Courts,
    capacity: choice2Capacity,
    sitting: choice2Sitting,
    summary: `${choice2Courts.length} Courts: ${parts.join(" + ")}`,
    details: choice2Sitting === 0
      ? "All players on court immediately"
      : `${choice2Sitting} rotating while maximizing court play`,
  };

  return [choice1, choice2];
}
