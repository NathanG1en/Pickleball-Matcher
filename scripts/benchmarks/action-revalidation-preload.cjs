// Test-only Node preload. Loaded explicitly by action-revalidation-server.mjs.
// Logs counts and request metadata only: no bodies, cookies, SQL, or parameters.
/* eslint-disable @typescript-eslint/no-require-imports -- Node --require preloads execute as CommonJS. */
const { AsyncLocalStorage } = require("node:async_hooks");
const { appendFileSync } = require("node:fs");
const http = require("node:http");
const { createRequire, registerHooks } = require("node:module");
const { resolve } = require("node:path");
const { pathToFileURL } = require("node:url");

const target = process.env.SESSION_REVALIDATION_TRACE;
if (!target) throw new Error("A trace file is required");
const url = process.env.DATABASE_URL;
if (!url || !/^ep-cold-band-b491lrgj(?:-pooler)?\./.test(new URL(url).hostname)) throw new Error("Expected allowlisted Neon test branch");
const context = new AsyncLocalStorage();
const write = event => appendFileSync(target, `${JSON.stringify(event)}\n`);
const emit = http.Server.prototype.emit;
let sequence = 0;
http.Server.prototype.emit = function (event, ...args) {
  if (event !== "request") return emit.call(this, event, ...args);
  const [request, response] = args;
  const record = { type: "request", process: process.pid, id: ++sequence, method: request.method,
    path: new URL(request.url, "http://localhost").pathname,
    rsc: request.headers.rsc === "1", prefetch: request.headers["next-router-prefetch"] === "1",
    action: Boolean(request.headers["next-action"]), startedAt: Date.now(), queries: 0 };
  const step = request.headers["x-session-benchmark-step"];
  if (typeof step === "string" && /^[a-z-]{1,40}$/.test(step)) record.step = step;
  response.once("finish", () => write({ ...record, status: response.statusCode, ms: Date.now() - record.startedAt }));
  return context.run(record, () => emit.call(this, event, ...args));
};

// Count each executed lazy Query once in its caller's request context. A socket
// debug hook can inherit a pooled connection's context when draining queued SQL.
// Nothing below inspects SQL text, bound parameters, or returned rows.
const projectRequire = createRequire(resolve(process.cwd(), "package.json"));
const modulePath = projectRequire.resolve("postgres");
if (typeof registerHooks !== "function") throw new Error("Benchmark tracing needs Node.js 22.15+ registerHooks");
const queryFiles = new Set([
  pathToFileURL(resolve(modulePath, "../query.js")).href,
  pathToFileURL(resolve(modulePath, "../../../src/query.js")).href,
]);
globalThis[Symbol.for("pickleball.benchmark.countQuery")] = () => {
  const record = context.getStore();
  if (record) record.queries++;
  else write({ type: "unattributed-query", process: process.pid });
};
registerHooks({ load(url, options, nextLoad) {
  const result = nextLoad(url, options);
  if (!queryFiles.has(url)) return result;
  const source = String(result.source);
  const anchor = "!this.executed && (this.executed = true) && await 1 && this.handler(this)";
  if (!source.includes(anchor)) throw new Error("postgres Query execution changed; update the benchmark hook");
  write({ type: "query-hook", process: process.pid });
  return { ...result, source: source.replace(anchor,
    '!this.executed && (this.executed = true) && (globalThis[Symbol.for("pickleball.benchmark.countQuery")](), true) && await 1 && this.handler(this)') };
} });
