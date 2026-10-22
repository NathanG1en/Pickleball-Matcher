import { parseArgs } from "node:util";
import { z } from "zod";

const displayedRating = z.string().regex(/^\d+(?:\.\d+)?$/).transform(Number).pipe(z.number().min(2).max(8));
const schema = z.object({
  environment: z.enum(["test", "production"]),
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,24}$/),
  startingRating: displayedRating,
  reason: z.string().trim().min(1).max(500),
  apply: z.boolean(),
  expectedStartingRating: displayedRating.optional(),
  expectedStartingElo: z.string().regex(/^\d+(?:\.\d+)?$/).transform(Number).pipe(z.number().min(100).max(3000)).optional(),
  confirmProduction: z.string().optional(),
}).superRefine((request, ctx) => {
  const expectations = Number(request.expectedStartingRating !== undefined) + Number(request.expectedStartingElo !== undefined);
  if ((request.apply && expectations !== 1) || expectations > 1) {
    ctx.addIssue({ code: "custom", message: "Apply requires exactly one of --expected-starting-rating or --expected-starting-elo." });
  }
  if (request.apply && request.environment === "production" && request.confirmProduction !== `production:${request.username}`) {
    ctx.addIssue({ code: "custom", message: "Production apply requires --confirm-production production:USERNAME." });
  }
});

export type CorrectionRequest = z.infer<typeof schema>;
export type MaintenanceTarget = ReturnType<typeof maintenanceTarget>;

export class MaintenanceError extends Error {}

export function parseCorrectionArgs(args: string[]): CorrectionRequest {
  let values;
  try {
    const parsed = parseArgs({ args, strict: true, allowPositionals: false, tokens: true, options: {
      environment: { type: "string" }, username: { type: "string" },
      "starting-rating": { type: "string" }, reason: { type: "string" },
      apply: { type: "boolean", default: false },
      "expected-starting-rating": { type: "string" }, "confirm-production": { type: "string" },
      "expected-starting-elo": { type: "string" },
    } });
    const seen = new Set<string>();
    for (const token of parsed.tokens) {
      if (token.kind !== "option") continue;
      if (seen.has(token.name)) throw new Error("duplicate");
      seen.add(token.name);
    }
    values = parsed.values;
  } catch {
    throw new MaintenanceError("Invalid or repeated option. Run maintenance:correct-rating -- --help.");
  }
  const result = schema.safeParse({
    environment: values.environment, username: values.username, startingRating: values["starting-rating"],
    reason: values.reason, apply: values.apply, expectedStartingRating: values["expected-starting-rating"],
    expectedStartingElo: values["expected-starting-elo"],
    confirmProduction: values["confirm-production"],
  });
  if (!result.success) throw new MaintenanceError(result.error.issues.map(issue => issue.message).join(" "));
  return result.data;
}

export function maintenanceTarget(environment: CorrectionRequest["environment"], variables: Readonly<Record<string, string | undefined>>) {
  const variable = environment === "test" ? "MAINTENANCE_TEST_DATABASE_URL" : "MAINTENANCE_PRODUCTION_DATABASE_URL";
  const value = variables[variable];
  if (!value) throw new MaintenanceError(`${variable} is required; application database credentials are never used.`);
  try {
    const url = new URL(value);
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || !url.username || url.pathname.length < 2 || url.hash) throw new Error();
    if (url.hostname.includes("-pooler.") || /[,/%]/.test(url.hostname) || [...url.searchParams.keys()].some(key => key !== "sslmode")) throw new Error();
    return { url: value, environment, hostname: url.hostname, port: Number(url.port || 5432), database: decodeURIComponent(url.pathname.slice(1)) };
  } catch {
    throw new MaintenanceError("Maintenance requires a valid direct Postgres URL with only supported sslmode parameters; routing/role overrides and channel_binding are unsupported. Credentials were not printed.");
  }
}
