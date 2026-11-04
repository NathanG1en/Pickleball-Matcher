/** No silent skips: a full gate must execute replay tests or reject its target. */
export function requireReplayTestUrl(value: string | undefined, allowDisposableLocal: boolean): string {
  const message = "Replay tests require the allowlisted direct test endpoint or an explicitly opted-in loopback test_db";
  if (!value) throw new Error(message);
  let url: URL;
  try { url = new URL(value); } catch { throw new Error(message); }
  const postgresProtocol = url.protocol === "postgres:" || url.protocol === "postgresql:";
  if ([...url.searchParams.keys()].some(key => !["sslmode", "channel_binding"].includes(key))) throw new Error(message);
  const directTest = url.hostname === "ep-cold-band-b491lrgj.c-6.us-east-2.aws.neon.tech" && url.pathname === "/neondb";
  const disposableLocal = allowDisposableLocal && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) && url.pathname === "/test_db";
  if (!postgresProtocol || (!directTest && !disposableLocal)) throw new Error(message);
  return value;
}
