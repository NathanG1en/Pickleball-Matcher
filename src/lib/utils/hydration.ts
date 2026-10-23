import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/**
 * Returns true if the component has mounted on the client, or if running in a test environment.
 * During production SSR (e.g. Netlify edge / serverless), returns false to prevent timezone
 * and locale hydration flashes.
 */
export function useHydrated(): boolean {
  const isTest = typeof process !== "undefined" && process.env.NODE_ENV === "test";
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => isTest
  );
}
