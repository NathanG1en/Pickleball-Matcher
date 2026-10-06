import "server-only";

import { createHmac } from "node:crypto";

import type postgres from "postgres";

export type RateLimitOutcome = "check" | "failure" | "success";

export interface OrganizerRateLimitInput {
  readonly groupId: string;
  readonly clientFingerprint: string;
  readonly fingerprintSecret: string;
  readonly outcome: RateLimitOutcome;
  readonly now?: Date;
  readonly maxAttempts?: number;
  readonly windowSeconds?: number;
  readonly lockSeconds?: number;
}

export interface OrganizerRateLimitResult {
  readonly allowed: boolean;
  readonly remainingAttempts: number;
  readonly retryAfterSeconds: number;
}

interface RateLimitRow {
  readonly allowed: boolean;
  readonly remaining_attempts: number;
  readonly retry_after_seconds: number;
}

function boundedInteger(
  value: number,
  label: string,
  minimum: number,
  maximum: number,
): number {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${label} must be an integer from ${minimum} to ${maximum}`);
  }
  return value;
}

export function organizerFingerprint(
  clientFingerprint: string,
  secret: string,
): string {
  if (!clientFingerprint || clientFingerprint.length > 512) {
    throw new Error("Client fingerprint must contain 1 to 512 characters");
  }
  if (new TextEncoder().encode(secret).byteLength < 32) {
    throw new Error("Fingerprint secret must contain at least 32 bytes");
  }
  return createHmac("sha256", secret).update(clientFingerprint).digest("hex");
}

export async function checkOrganizerRateLimit(
  database: postgres.Sql,
  input: OrganizerRateLimitInput,
): Promise<OrganizerRateLimitResult> {
  if (!input.groupId || input.groupId.length > 128) {
    throw new Error("Group ID must contain 1 to 128 characters");
  }
  if (!["check", "failure", "success"].includes(input.outcome)) {
    throw new Error("Invalid rate-limit outcome");
  }

  const maxAttempts = boundedInteger(
    input.maxAttempts ?? 5,
    "Maximum attempts",
    1,
    100,
  );
  const windowSeconds = boundedInteger(
    input.windowSeconds ?? 15 * 60,
    "Attempt window",
    1,
    86_400,
  );
  const lockSeconds = boundedInteger(
    input.lockSeconds ?? 15 * 60,
    "Lock duration",
    1,
    86_400,
  );
  const fingerprintHash = organizerFingerprint(
    input.clientFingerprint,
    input.fingerprintSecret,
  );

  const [row] = await database<RateLimitRow[]>`
    select allowed, remaining_attempts, retry_after_seconds
    from check_organizer_rate_limit(
      ${input.groupId},
      ${fingerprintHash},
      ${input.outcome},
      ${input.now ?? new Date()},
      ${maxAttempts},
      ${windowSeconds},
      ${lockSeconds}
    )
  `;
  if (!row) throw new Error("Rate-limit check did not return a result");

  return {
    allowed: row.allowed,
    remainingAttempts: row.remaining_attempts,
    retryAfterSeconds: row.retry_after_seconds,
  };
}
