import "server-only";

import { cache } from "react";
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

export const getDatabase = cache((): postgres.Sql => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");
  return createDatabase(connectionString);
});

