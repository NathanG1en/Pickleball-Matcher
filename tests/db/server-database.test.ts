import { expect, it } from "vitest";
import { createDatabase } from "@/lib/db/server-database";

it("reuses protocol-level prepared statements while retaining the existing pool and timeout limits", async () => {
  // postgres.js is lazy: inspecting configuration opens no database connection.
  const sql = createDatabase("postgresql://fixture@127.0.0.1:1/unused");
  try {
    expect(sql.options.prepare).toBe(true);
    expect(sql.options.max).toBe(10);
    expect(sql.options.idle_timeout).toBe(20);
    expect(sql.options.connect_timeout).toBe(15);
  } finally { await sql.end(); }
});

it("allows overriding pool and timeout options for serverless/edge environments", async () => {
  const sql = createDatabase("postgresql://fixture@127.0.0.1:1/unused", {
    max: 2,
    idle_timeout: 1,
  });
  try {
    expect(sql.options.prepare).toBe(true);
    expect(sql.options.max).toBe(2);
    expect(sql.options.idle_timeout).toBe(1);
    expect(sql.options.connect_timeout).toBe(15);
  } finally {
    await sql.end();
  }
});

it("throws an error when DATABASE_URL is not set", async () => {
  const { getDatabase } = await import("@/lib/db/server-database");
  const original = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    expect(() => getDatabase()).toThrow("DATABASE_URL is required");
  } finally {
    process.env.DATABASE_URL = original;
  }
});

it("uses request-scoped client when running inside a Cloudflare Worker", async () => {
  const { getDatabase } = await import("@/lib/db/server-database");
  const originalNavigator = globalThis.navigator;
  const originalUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = "postgresql://fixture@127.0.0.1:1/unused";
  try {
    Object.defineProperty(globalThis, "navigator", {
      value: { userAgent: "Cloudflare-Workers" },
      configurable: true,
    });
    const sql1 = getDatabase();
    const sql2 = getDatabase();
    expect(sql1).toBeDefined();
    expect(sql1.options.max).toBe(2);
    expect(sql1.options.idle_timeout).toBe(1);
    expect(sql2.options.max).toBe(2);
    expect(sql2.options.idle_timeout).toBe(1);
  } finally {
    process.env.DATABASE_URL = originalUrl;
    Object.defineProperty(globalThis, "navigator", {
      value: originalNavigator,
      configurable: true,
    });
  }
});

