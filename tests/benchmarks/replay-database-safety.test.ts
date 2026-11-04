import { describe, expect, it } from "vitest";
import { requireReplayTestUrl } from "../fixtures/replay-database";

describe("temporary replay test database safety", () => {
  it("admits only the existing direct test endpoint without local opt-in", () => {
    const direct = "postgresql://fixture:example@ep-cold-band-b491lrgj.c-6.us-east-2.aws.neon.tech/neondb";
    expect(requireReplayTestUrl(direct, false)).toBe(direct);
    expect(() => requireReplayTestUrl(direct.replace("b491lrgj.", "b491lrgj-pooler."), true)).toThrow();
    expect(() => requireReplayTestUrl(direct.replace("b491lrgj", "production"), true)).toThrow();
  });

  it("admits an explicitly opted-in disposable loopback database so CI executes every replay case", () => {
    for (const host of ["127.0.0.1", "localhost", "[::1]"]) {
      const url = `postgresql://postgres@${host}:54322/test_db`;
      expect(requireReplayTestUrl(url, true)).toBe(url);
      expect(() => requireReplayTestUrl(url, false)).toThrow();
    }
  });

  it("rejects missing, malformed, unrelated remote and application database targets without exposing credentials", () => {
    for (const url of [undefined, "invalid", "postgresql://private-secret@localhost/postgres", "postgresql://private-secret@localhost/development", "postgresql://private-secret@localhost.evil/test_db", "postgresql://private-secret@192.168.1.1/test_db", "postgresql://private-secret@localhost/test_db?host=production", "postgresql://private-secret@localhost/test_db?options=-csearch_path%3Dpublic"]) {
      expect(() => requireReplayTestUrl(url, true)).toThrow("Replay tests require the allowlisted direct test endpoint or an explicitly opted-in loopback test_db");
      try { requireReplayTestUrl(url, true); } catch (error) { expect(String(error)).not.toContain("private-secret"); }
    }
  });
});
