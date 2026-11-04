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
