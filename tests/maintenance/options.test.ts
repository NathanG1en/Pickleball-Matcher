import { describe, expect, it } from "vitest";
import { parseCorrectionArgs, maintenanceTarget } from "../../scripts/maintenance/options";

const args = ["--environment", "test", "--username", "N8themid", "--starting-rating", "4.0", "--reason", "Wrong signup rating"];

describe("rating maintenance command boundary", () => {
  it("defaults to preview and normalizes the exact account name", () => {
    expect(parseCorrectionArgs(args)).toMatchObject({ environment: "test", username: "n8themid", startingRating: 4, apply: false });
  });
  it("requires an explicit environment, valid displayed rating, and a reason", () => {
    expect(() => parseCorrectionArgs(args.slice(2))).toThrow();
    expect(() => parseCorrectionArgs([...args, "--starting-rating", "1000"])).toThrow();
    expect(() => parseCorrectionArgs(args.slice(0, -2))).toThrow();
    expect(() => parseCorrectionArgs([...args, "--actor", "someone-else"])).toThrow();
    expect(() => parseCorrectionArgs([...args, "--environment", "production"])).toThrow();
  });
  it("can confirm a legacy baseline outside the displayed scale using the exact raw Elo", () => {
    expect(parseCorrectionArgs([...args, "--apply", "--expected-starting-elo", "100"]).expectedStartingElo).toBe(100);
    expect(() => parseCorrectionArgs([...args, "--apply", "--expected-starting-elo", "100", "--expected-starting-rating", "2"])).toThrow();
  });
  it("requires an expected baseline before apply and explicit production confirmation", () => {
    expect(() => parseCorrectionArgs([...args, "--apply"])).toThrow();
    const apply = [...args, "--apply", "--expected-starting-rating", "3.5"];
    expect(parseCorrectionArgs(apply).apply).toBe(true);
    const production = apply.map(value => value === "test" ? "production" : value);
    expect(() => parseCorrectionArgs(production)).toThrow();
    expect(parseCorrectionArgs([...production, "--confirm-production", "production:n8themid"]).environment).toBe("production");
  });
  it("never falls back to application credentials, accepts only direct URLs, and binds the database", () => {
    expect(() => maintenanceTarget("test", { DATABASE_URL: "postgresql://owner:secret@prod/db" })).toThrow();
    expect(() => maintenanceTarget("test", { MAINTENANCE_TEST_DATABASE_URL: "postgresql://user:secret@ep-test-pooler.neon.tech/db" })).toThrow();
    expect(() => maintenanceTarget("test", { MAINTENANCE_TEST_DATABASE_URL: "postgresql://person:secret@test/db?host=production" })).toThrow();
    expect(() => maintenanceTarget("test", { MAINTENANCE_TEST_DATABASE_URL: "postgresql://person:secret@test/db?channel_binding=require" })).toThrow(/unsupported|direct/i);
    expect(maintenanceTarget("test", { MAINTENANCE_TEST_DATABASE_URL: "postgresql://person:secret@ep-test.neon.tech/neondb" })).toMatchObject({ hostname: "ep-test.neon.tech", database: "neondb" });
  });
});
