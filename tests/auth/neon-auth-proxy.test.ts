import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const forwarded = vi.fn(async () => new Response("forwarded", { status: 200 }));
vi.mock("@/lib/auth/neon-server", () => ({
  neonAuth: { handler: () => ({ GET: forwarded, POST: forwarded, PUT: forwarded, DELETE: forwarded, PATCH: forwarded }) },
}));

const route = await import("@/app/api/auth/[...path]/route");
const call = (method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH", path: string) =>
  route[method](new NextRequest(`http://localhost:3000/api/auth/${path}`, { method }), { params: Promise.resolve({ path: path.split("/") }) } as never);

describe("/api/auth proxy", () => {
  it("passes through only what Google sign-in needs", async () => {
    for (const [method, path] of [["POST", "sign-in/social"], ["GET", "get-session"], ["POST", "sign-out"]] as const) {
      expect((await call(method, path)).status).toBe(200);
    }
    expect(forwarded).toHaveBeenCalledTimes(3);
  });

  it("blocks Neon email sign-in and sign-up, which would let a Neon session stand in for a player", async () => {
    forwarded.mockClear();
    for (const [method, path] of [
      ["POST", "sign-in/email"],
      ["POST", "sign-up/email"],
      ["POST", "email-otp/send-verification-otp"],
      ["POST", "email-otp/verify-email"],
      ["GET", "sign-in/social"],
      ["DELETE", "get-session"],
    ] as const) {
      expect((await call(method, path)).status).toBe(404);
    }
    expect(forwarded).not.toHaveBeenCalled();
  });
});
