import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(
        new URL("./src/test-support/server-only.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: [
      "tests/integration/**/*.test.ts",
      "tests/auth/rate-limit.test.ts",
    ],
    setupFiles: ["tests/integration/setup-env.ts"],
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 30_000,
  },
});
