/** A real first name from the display name, or null (an email-style name like "pat123" isn't one). */
export function firstName(displayName: string | null): string | null {
  const first = displayName?.trim().split(/\s+/)[0] ?? "";
  return /^[\p{L}'-]{2,14}$/u.test(first) ? first[0].toUpperCase() + first.slice(1) : null;
}
