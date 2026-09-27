// Dates the way the team sees them: Canberra's calendar, whatever the server's clock says.
export const TZ = "Australia/Canberra";

const parts = (now) =>
  Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );

/** "2026-09-27" in Canberra. */
export function canberraDate(now = new Date()) {
  const p = parts(now);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Minutes past midnight in Canberra (07:25 → 445). */
export function canberraMinutes(now = new Date()) {
  const p = parts(now);
  return Number(p.hour) * 60 + Number(p.minute);
}

/** The Canberra date of a stored ISO time ("" when there isn't one). */
export function localDate(value) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value).slice(0, 10) : canberraDate(d);
}

export function addDays(date, n) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** "Thu 25 Sep", as the app writes it. */
export function dayName(date) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

/** "Saturday 27 September". */
export function longDay(date) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}
