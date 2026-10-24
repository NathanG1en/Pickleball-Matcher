/**
 * Formats a session date consistently across the app as "MMM D, YYYY" (e.g. "Oct 23, 2026").
 */
export function formatSessionDate(date: Date | string | number): string {
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

