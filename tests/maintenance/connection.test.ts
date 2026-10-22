import { afterEach, expect, it, vi } from "vitest";
import { createMaintenanceDatabase } from "../../scripts/maintenance/connection";
import { maintenanceTarget } from "../../scripts/maintenance/options";

afterEach(() => vi.unstubAllEnvs());

it("pins the connection to the validated target despite ambient Postgres variables", async () => {
  vi.stubEnv("PGPORT", "6543");
  vi.stubEnv("PGHOST", "unexpected-host");
  vi.stubEnv("PGDATABASE", "unexpected-database");
  const target = maintenanceTarget("test", { MAINTENANCE_TEST_DATABASE_URL: "postgresql://maintainer:example@db.example/ratings%2Dtest" });
  const database = createMaintenanceDatabase(target);
  try {
    expect(database.options.host).toEqual(["db.example"]);
    expect(database.options.port).toEqual([5432]);
    expect(database.options.database).toBe("ratings-test");
    expect(database.options.user).toBe("maintainer");
  } finally { await database.end(); }
});
