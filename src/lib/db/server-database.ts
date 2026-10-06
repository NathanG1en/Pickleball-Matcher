import "server-only";

import postgres from "postgres";

let database: postgres.Sql | undefined;

export function createDatabase(connectionString: string): postgres.Sql {
  return postgres(connectionString, {
    prepare: false,
    max: 10,
    idle_timeout: 20,
    connect_timeout: 15,
  });
}

export function getDatabase(): postgres.Sql {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");
  database ??= createDatabase(connectionString);
  return database;
}
