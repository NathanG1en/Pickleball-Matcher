/**
 * Formats a session date using the current runtime’s timezone as "MMM D, YYYY".
 * Use in client components; server components should render ClientDate instead.
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

