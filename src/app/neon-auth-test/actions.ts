"use server";

import { getNeonAuth } from "@/lib/auth/neon-server";

export async function checkNeonServerSessionAction() {
  try {
    const session = await getNeonAuth().getSession();
    return { ok: true, session: session?.data || null };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
