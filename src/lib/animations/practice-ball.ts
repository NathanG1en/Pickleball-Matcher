/** Where the Practice Profile pickleball starts its drop, relative to where it lands. */
export interface PracticeBallLaunch {
  /** Horizontal start offset in px; negative starts left of the resting spot. */
  readonly fromX: number;
  /** How far above the resting spot the drop starts, in px. */
  readonly dropHeight: number;
  /** Starting rotation in degrees; follows the sideways travel so the ball reads as rolling. */
  readonly spin: number;
}

const FROM_X_MIN = -48;
const FROM_X_MAX = 64;
const DROP_MIN = 120;
const DROP_MAX = 180;
/** Degrees of spin per px of sideways travel (a 24px ball rolls about 4.8deg per px). */
const SPIN_PER_PX = 5;

/** Picks a slightly different launch each time; the landing spot never changes. */
export function pickPracticeBallLaunch(random: () => number = Math.random): PracticeBallLaunch {
  const fromX = Math.round(FROM_X_MIN + random() * (FROM_X_MAX - FROM_X_MIN));
  const dropHeight = Math.round(DROP_MIN + random() * (DROP_MAX - DROP_MIN));
  return { fromX, dropHeight, spin: fromX * SPIN_PER_PX };
}

/** Applies a launch as the CSS variables read by the practice-profile-ball keyframes. */
export function applyPracticeBallLaunch(element: HTMLElement, launch: PracticeBallLaunch): void {
  element.style.setProperty("--practice-ball-from-x", `${launch.fromX}px`);
  element.style.setProperty("--practice-ball-drop", `${launch.dropHeight}px`);
  element.style.setProperty("--practice-ball-spin", `${launch.spin}deg`);
}
