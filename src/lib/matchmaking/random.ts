import type { RandomSource } from "@/lib/matchmaking/types";

const UINT32_RANGE = 0x1_0000_0000;
const ZERO_SEED_FALLBACK = 0x9e37_79b9;

/** A compact xorshift32 source with stable output across JavaScript runtimes. */
export function createSeededRandom(seed: number): RandomSource {
  let state = (Number.isFinite(seed) ? Math.trunc(seed) : 0) >>> 0;
  if (state === 0) state = ZERO_SEED_FALLBACK;

  const next = (): number => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / UINT32_RANGE;
  };

  return {
    next,
    integer(maxExclusive: number): number {
      if (!Number.isSafeInteger(maxExclusive) || maxExclusive <= 0) {
        throw new RangeError("maxExclusive must be positive");
      }
      return Math.floor(next() * maxExclusive);
    },
    shuffle<T>(values: readonly T[]): T[] {
      const shuffled = [...values];
      for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(next() * (index + 1));
        [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
      }
      return shuffled;
    },
  };
}
