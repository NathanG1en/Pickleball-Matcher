import "server-only";

import { hash } from "bcryptjs";

const PIN_HASH_COST = 12;

export async function hashPin(pin: string): Promise<string> {
  return hash(pin, PIN_HASH_COST);
}
