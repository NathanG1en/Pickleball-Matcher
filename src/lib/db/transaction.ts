import type postgres from "postgres";

import { getDatabase } from "@/lib/db/server-database";

export async function withTransaction<T>(
  operation: (transaction: postgres.TransactionSql) => Promise<T>,
  database = getDatabase(),
): Promise<T> {
  return (await database.begin(operation)) as unknown as T;
}
