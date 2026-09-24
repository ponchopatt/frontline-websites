import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

/**
 * A calendar day in the user's life, as "YYYY-MM-DD". Never a Date: a Date is an instant,
 * and which day an instant belongs to depends on the user's timezone and when their day
 * starts. Everything that groups by day goes through `localDateAt`.
 */
export type LocalDate = string;

const LOCAL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isLocalDate(value: unknown): value is LocalDate {
  if (typeof value !== "string" || !LOCAL_DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
}

/**
 * The local day an instant belongs to. With a 04:00 start, 01:30 on Tuesday is still Monday.
 * Uses the wall clock in `timeZone`, so daylight-saving changes cannot move the boundary.
 * Mirrors public.local_date_at() in the database.
 */
export function localDateAt(instant: Date, timeZone: string, dayStartHour: number): LocalDate {
  const wall = formatInTimeZone(instant, timeZone, "yyyy-MM-dd HH");
  const date = wall.slice(0, 10);
  const hour = Number(wall.slice(11, 13));
  return hour < dayStartHour ? addDays(date, -1) : date;
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const [y, m, d] = date.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return next.toISOString().slice(0, 10);
}

/** Whole days from `a` to `b` (b − a). */
export function daysBetween(a: LocalDate, b: LocalDate): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

/** Every day from `from` to `to`, inclusive, oldest first. */
export function dateRange(from: LocalDate, to: LocalDate): LocalDate[] {
  const n = daysBetween(from, to);
  const out: LocalDate[] = [];
  for (let i = 0; i <= n; i += 1) out.push(addDays(from, i));
  return out;
}

/**
 * The instants a local day covers: from `dayStartHour` on that date to the same hour the next
 * day, in the user's timezone.
 */
export function dayBounds(
  date: LocalDate,
  timeZone: string,
  dayStartHour: number,
): { start: Date; end: Date } {
  const hh = String(dayStartHour).padStart(2, "0");
  const start = fromZonedTime(`${date}T${hh}:00:00`, timeZone);
  const end = fromZonedTime(`${addDays(date, 1)}T${hh}:00:00`, timeZone);
  return { start, end };
}

/** Monday of the week containing `date` (weeks start on Monday). */
export function startOfWeek(date: LocalDate): LocalDate {
  const [y, m, d] = date.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return addDays(date, -((weekday + 6) % 7));
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function parts(date: LocalDate) {
  const [y, m, d] = date.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return { y, m, d, weekday };
}

/** "Wednesday" */
export function weekdayName(date: LocalDate): string {
  return WEEKDAYS[parts(date).weekday];
}

/** "24 September" */
export function dayMonth(date: LocalDate): string {
  const { d, m } = parts(date);
  return `${d} ${MONTHS[m - 1]}`;
}

/** "Wed 24 Sep" */
export function shortDate(date: LocalDate): string {
  const { d, m, weekday } = parts(date);
  return `${WEEKDAYS[weekday].slice(0, 3)} ${d} ${MONTHS[m - 1].slice(0, 3)}`;
}

/** "Today", "Yesterday", or "Wed 24 Sep" relative to `today`. */
export function relativeDayLabel(date: LocalDate, today: LocalDate): string {
  const diff = daysBetween(date, today);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return shortDate(date);
}

/** "05:42" in the user's timezone. */
export function clockTime(instant: Date | string, timeZone: string): string {
  return formatInTimeZone(typeof instant === "string" ? new Date(instant) : instant, timeZone, "HH:mm");
}

/** "2:05:09" or "5:09" for a duration in milliseconds. */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(h > 0 ? 2 : 1, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** "3.5h", "45m", "0h" for a number of minutes. */
export function formatHours(minutes: number): string {
  if (minutes <= 0) return "0h";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.round((minutes / 60) * 10) / 10;
  return `${hours}h`;
}
