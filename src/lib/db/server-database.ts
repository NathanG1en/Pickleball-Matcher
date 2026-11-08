import "server-only";

import { cache } from "react";
import postgres from "postgres";

export interface DatabaseOptions {
  max?: number;
  idle_timeout?: number;
  connect_timeout?: number;
  prepare?: boolean;
}

export function createDatabase(
  connectionString: string,
  options?: DatabaseOptions,
): postgres.Sql {
  return postgres(connectionString, {
    // Neon supports protocol-level prepared statements through its pooler.
    // Reusing them avoids describing the same parameterized SQL on every call.
    prepare: options?.prepare ?? true,
    max: options?.max ?? 10,
    idle_timeout: options?.idle_timeout ?? 20,
    connect_timeout: options?.connect_timeout ?? 15,
  });
}

declare global {
  var __appPostgresSql: postgres.Sql | undefined;
  var __appPostgresUrl: string | undefined;
}

function isCloudflareWorker(): boolean {
  return (
    typeof (globalThis as unknown as { WebSocketPair?: unknown }).WebSocketPair !== "undefined" ||
    (typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers")
  );
}

// In Cloudflare Workers, TCP sockets cannot be shared across multiple requests.
// React's cache() memoizes the database client for the duration of the current
// request (Server Component or Server Action) and discards it when the request ends.
const getCloudflareWorkerDatabase = cache((connectionString: string): postgres.Sql => {
  return createDatabase(connectionString, {
    max: 2,
    idle_timeout: 1,
    connect_timeout: 15,
  });
});

export function getDatabase(): postgres.Sql {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");

  // In Cloudflare Workers, use request-scoped database instances to prevent
  // "Cannot perform I/O on behalf of a different request" errors on button clicks and client navigation.
  if (isCloudflareWorker()) {
    return getCloudflareWorkerDatabase(connectionString);
  }

  // In Node.js (local dev, vitest, CI), use the shared global pool for maximum performance and connection reuse.
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

