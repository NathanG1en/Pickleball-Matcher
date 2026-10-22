import postgres from "postgres";
import type { MaintenanceTarget } from "./options";

export function createMaintenanceDatabase(target: MaintenanceTarget) {
  // Pin all routing fields to what the owner-managed target check will verify.
  // In particular, an omitted URL port must not inherit an ambient PGPORT.
  return postgres(target.url, {
    host: target.hostname, port: target.port, database: target.database,
    max: 1, prepare: false, connect_timeout: 15, idle_timeout: 5, onnotice: () => {},
  });
}
