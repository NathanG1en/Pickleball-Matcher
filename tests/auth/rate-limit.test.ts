import postgres from "postgres";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { checkOrganizerRateLimit } from "@/lib/auth/rate-limit";

const databaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const firstInstance = postgres(databaseUrl, {
  prepare: false,
  onnotice: () => undefined,
});
const secondInstance = postgres(databaseUrl, {
  prepare: false,
  onnotice: () => undefined,
});
const baseInput = {
  groupId: "group-1",
  clientFingerprint: "203.0.113.10|test-agent",
  fingerprintSecret: "a-dedicated-test-fingerprint-secret",
  now: new Date("2026-10-06T12:00:00.000Z"),
  maxAttempts: 3,
  windowSeconds: 15 * 60,
  lockSeconds: 15 * 60,
} as const;

describe("organizer login rate limiting", () => {
  beforeEach(async () => {
    await firstInstance`truncate organizer_login_attempts`;
  });

  afterAll(async () => {
    await Promise.all([firstInstance.end(), secondInstance.end()]);
  });

  it("shares the attempt window across application instances", async () => {
    await checkOrganizerRateLimit(firstInstance, {
      ...baseInput,
      outcome: "failure",
    });
    await checkOrganizerRateLimit(secondInstance, {
      ...baseInput,
      outcome: "failure",
    });
    const threshold = await checkOrganizerRateLimit(firstInstance, {
      ...baseInput,
      outcome: "failure",
    });
    const checkedElsewhere = await checkOrganizerRateLimit(secondInstance, {
      ...baseInput,
      outcome: "check",
    });

    expect(threshold).toMatchObject({ allowed: false, remainingAttempts: 0 });
    expect(checkedElsewhere).toMatchObject({
      allowed: false,
      remainingAttempts: 0,
      retryAfterSeconds: 15 * 60,
    });
  });

  it("clears accumulated failures after a successful login", async () => {
    await checkOrganizerRateLimit(firstInstance, {
      ...baseInput,
      outcome: "failure",
    });
    await checkOrganizerRateLimit(secondInstance, {
      ...baseInput,
      outcome: "success",
    });

    await expect(
      checkOrganizerRateLimit(firstInstance, {
        ...baseInput,
        outcome: "check",
      }),
    ).resolves.toEqual({
      allowed: true,
      remainingAttempts: 3,
      retryAfterSeconds: 0,
    });
  });

  it("stores only a keyed fingerprint rather than the raw client value", async () => {
    await checkOrganizerRateLimit(firstInstance, {
      ...baseInput,
      outcome: "failure",
    });

    const [attempt] = await firstInstance<
      { fingerprint_hash: string }[]
    >`select fingerprint_hash from organizer_login_attempts`;
    expect(attempt.fingerprint_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(attempt.fingerprint_hash).not.toContain("203.0.113.10");
  });

  it("does not expose the privileged rate-limit function to the anonymous role", async () => {
    const [permission] = await firstInstance<
      { can_execute: boolean }[]
    >`select has_function_privilege(
      'anon',
      'check_organizer_rate_limit(text,text,text,timestamptz,integer,integer,integer)',
      'EXECUTE'
    ) as can_execute`;

    expect(permission.can_execute).toBe(false);
  });
});
