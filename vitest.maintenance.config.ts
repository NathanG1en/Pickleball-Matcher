import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { environment: "node", include: ["tests/maintenance-postgres/**/*.test.ts"], fileParallelism: false, maxWorkers: 1, testTimeout: 30_000, hookTimeout: 60_000 },
});
