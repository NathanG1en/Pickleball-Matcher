import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { expect, it } from "vitest";

it("matches the frozen source after every session action with fixed IDs, clock, seeds, shared accounts and permissions", () => {
  const archive = resolve("tests/fixtures/session-control-50adab8.tar.gz");
  const manifest = JSON.parse(readFileSync(resolve("tests/fixtures/session-control-50adab8.json"), "utf8"));
  expect(createHash("sha256").update(readFileSync(archive)).digest("hex")).toBe(manifest.sha256);
  const control = mkdtempSync(resolve(tmpdir(), "pickleball-session-control-"));
  const runner = resolve("tests/fixtures/session-action-oracle-runner.ts");
  const run = (source: string) => JSON.parse(execFileSync(process.execPath, ["--conditions=react-server", "--import", "tsx", runner], {
    cwd: source,
    env: { ...process.env, SESSION_ORACLE_SOURCE: source, TSX_TSCONFIG_PATH: resolve(source, "tsconfig.json") },
    encoding: "utf8", maxBuffer: 10 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"],
  }));
  try {
    execFileSync("tar", ["-xzf", archive, "-C", control], { env: { ...process.env, LC_ALL: "C" }, stdio: "pipe" });
    symlinkSync(resolve("node_modules"), resolve(control, "node_modules"), "dir");
    const expected = run(control);
    const actual = run(process.cwd());
    expect(actual).toHaveLength(20);
    expect(actual).toEqual(expected);
    console.info("SESSION_STATE_EQUIVALENCE", JSON.stringify({
      control: manifest.commit, controlArchiveSha256: manifest.sha256,
      checkpoints: actual.map((item: { step: string }) => item.step),
      stateSha256: createHash("sha256").update(JSON.stringify(actual)).digest("hex"),
    }));
  } finally { rmSync(control, { recursive: true, force: true }); }
}, 60_000);
