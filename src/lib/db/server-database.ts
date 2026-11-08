import "server-only";

import postgres from "postgres";

export function createDatabase(connectionString: string): postgres.Sql {
  return postgres(connectionString, {
    // Neon supports protocol-level prepared statements through its pooler.
    // Reusing them avoids describing the same parameterized SQL on every call.
    prepare: true,
    max: 10,
    idle_timeout: 20,
    connect_timeout: 15,
  });
}

declare global {
  var __appPostgresSql: postgres.Sql | undefined;
  var __appPostgresUrl: string | undefined;
}

export function getDatabase(): postgres.Sql {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");

  if (globalThis.__appPostgresSql && globalThis.__appPostgresUrl !== connectionString) {
    void globalThis.__appPostgresSql.end({ timeout: 5 });
    globalThis.__appPostgresSql = undefined;
  }

  if (!globalThis.__appPostgresSql) {
    globalThis.__appPostgresSql = createDatabase(connectionString);
    globalThis.__appPostgresUrl = connectionString;
  }

  return globalThis.__appPostgresSql;
}

