import { describe, expect, it } from "vitest";

import {
  ORGANIZER_LOGIN_FAILURE,
  authenticateOrganizerPin,
  hashPin,
  verifyPin,
} from "@/lib/auth/pin";
import {
  createOrganizerSession,
  readOrganizerSession,
} from "@/lib/auth/session";
import {
  AuthorizationError,
  requireGroupOrganizer,
} from "@/lib/auth/authorize";

const sessionSecret = "a-test-secret-that-is-at-least-thirty-two-bytes";
const now = new Date("2026-10-06T12:00:00.000Z");

describe("organizer PINs", () => {
  it("uses a fresh salt for each PIN hash", async () => {
    const first = await hashPin("2468");
    const second = await hashPin("2468");

    expect(first).not.toBe(second);
    await expect(verifyPin("2468", first)).resolves.toBe(true);
    await expect(verifyPin("1357", first)).resolves.toBe(false);
  });

  it("returns the same generic failure for unknown and incorrect organizers", async () => {
    const hash = await hashPin("2468");

    await expect(authenticateOrganizerPin("1357", hash)).resolves.toEqual({
      ok: false,
      error: ORGANIZER_LOGIN_FAILURE,
    });
    await expect(authenticateOrganizerPin("1357", null)).resolves.toEqual({
      ok: false,
      error: ORGANIZER_LOGIN_FAILURE,
    });
  });
});

describe("organizer sessions", () => {
  it("creates a bounded signed cookie with secure production settings", async () => {
    const session = await createOrganizerSession({
      groupId: "group-1",
      secret: sessionSecret,
      now,
      ttlSeconds: 60 * 60,
      secure: true,
    });

    expect(session.cookie).toMatchObject({
      name: "organizer_session",
      value: session.token,
      options: {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60,
      },
    });
    await expect(
      readOrganizerSession(session.token, { secret: sessionSecret, now }),
    ).resolves.toMatchObject({
      groupId: "group-1",
      expiresAt: new Date("2026-10-06T13:00:00.000Z"),
    });
  });

  it("rejects expired and tampered session tokens", async () => {
    const session = await createOrganizerSession({
      groupId: "group-1",
      secret: sessionSecret,
      now,
      ttlSeconds: 60,
      secure: false,
    });

    await expect(
      readOrganizerSession(session.token, {
        secret: sessionSecret,
        now: new Date("2026-10-06T12:01:01.000Z"),
      }),
    ).resolves.toBeNull();

    const tampered = `${session.token.slice(0, -4)}xxxx`;
    await expect(
      readOrganizerSession(tampered, { secret: sessionSecret, now }),
    ).resolves.toBeNull();
  });

  it("rejects a session that does not own the requested group", () => {
    const organizer = {
      groupId: "group-1",
      expiresAt: new Date("2026-10-06T13:00:00.000Z"),
    };

    expect(requireGroupOrganizer("group-1", organizer, now)).toBe(organizer);
    expect(() => requireGroupOrganizer("group-2", organizer, now)).toThrow(
      AuthorizationError,
    );
    expect(() => requireGroupOrganizer("group-1", null, now)).toThrow(
      AuthorizationError,
    );
    expect(() =>
      requireGroupOrganizer(
        "group-1",
        { ...organizer, expiresAt: new Date("2026-10-06T11:59:59.000Z") },
        now,
      ),
    ).toThrow(AuthorizationError);
  });
});
