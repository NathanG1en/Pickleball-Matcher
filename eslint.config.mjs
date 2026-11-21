import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  globalIgnores([".agents/**", ".next/**", ".next-test/**", ".next-audit/**", ".next-dev3000/**", ".next-goal-gate/**", ".open-next/**", ".worktrees/**", "coverage/**", "playwright-report/**", ".venv/**", "**/.venv/**"]),
]);
