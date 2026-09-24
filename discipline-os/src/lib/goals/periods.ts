import { addDays, daysBetween, startOfWeek, type LocalDate } from "../day";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "2026-10-17" → "2026-10-01" */
export function monthStartOf(date: LocalDate): LocalDate {
  return `${date.slice(0, 7)}-01`;
}

export function addMonths(monthStart: LocalDate, n: number): LocalDate {
  const [y, m] = monthStart.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 10);
}

export function monthEndOf(monthStart: LocalDate): LocalDate {
  return addDays(addMonths(monthStart, 1), -1);
}

export function daysInMonth(monthStart: LocalDate): number {
  return daysBetween(monthStart, monthEndOf(monthStart)) + 1;
}

/** "October 2026" */
export function monthLabel(monthStart: LocalDate): string {
  const [y, m] = monthStart.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/** "Oct" */
export function monthShort(monthStart: LocalDate): string {
  return MONTHS[Number(monthStart.slice(5, 7)) - 1].slice(0, 3);
}

export function quarterOf(monthStart: LocalDate): 1 | 2 | 3 | 4 {
  return (Math.floor((Number(monthStart.slice(5, 7)) - 1) / 3) + 1) as 1 | 2 | 3 | 4;
}

export function monthsOfYear(year: number): LocalDate[] {
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}-01`);
}

export function yearStart(year: number): LocalDate {
  return `${year}-01-01`;
}

export function yearEnd(year: number): LocalDate {
  return `${year}-12-31`;
}

/**
 * The weeks that belong to a month: those whose Thursday falls in it (the ISO rule), so every
 * week belongs to exactly one month. Returns each week's Monday.
 */
export function weeksOfMonth(monthStart: LocalDate): LocalDate[] {
  const end = monthEndOf(monthStart);
  const month = monthStart.slice(0, 7);
  const out: LocalDate[] = [];
  for (let monday = startOfWeek(monthStart); monday <= end; monday = addDays(monday, 7)) {
    if (addDays(monday, 3).slice(0, 7) === month) out.push(monday);
  }
  return out;
}

/** The month a week belongs to (by its Thursday). */
export function monthOfWeek(weekStart: LocalDate): LocalDate {
  return monthStartOf(addDays(weekStart, 3));
}

export function weekEndOf(weekStart: LocalDate): LocalDate {
  return addDays(weekStart, 6);
}

/** "5–11 Oct" or "29 Sep – 5 Oct" */
export function weekRangeLabel(weekStart: LocalDate): string {
  const end = weekEndOf(weekStart);
  const a = Number(weekStart.slice(8));
  const b = Number(end.slice(8));
  const ma = monthShort(monthStartOf(weekStart));
  const mb = monthShort(monthStartOf(end));
  return ma === mb ? `${a}–${b} ${mb}` : `${a} ${ma} – ${b} ${mb}`;
}

/** 1-based position of a week within its month. */
export function weekNumberInMonth(weekStart: LocalDate): number {
  return weeksOfMonth(monthOfWeek(weekStart)).indexOf(weekStart) + 1;
}

export interface Period {
  start: LocalDate;
  end: LocalDate;
}

/** How much of a period has passed by the end of `today`, 0–1. Day 20 of 30 is 20/30. */
export function elapsedFraction(period: Period, today: LocalDate): number {
  if (today < period.start) return 0;
  if (today >= period.end) return 1;
  const total = daysBetween(period.start, period.end) + 1;
  return (daysBetween(period.start, today) + 1) / total;
}

/** Days left in a period including today. */
export function daysLeft(period: Period, today: LocalDate): number {
  if (today > period.end) return 0;
  const from = today < period.start ? period.start : today;
  return daysBetween(from, period.end) + 1;
}
