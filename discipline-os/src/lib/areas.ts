/**
 * The parts of life the dashboard tracks. One vocabulary for tasks, counters, work sessions
 * and goals (life_areas.key), mirrored by public.is_area() in SQL.
 */

export const AREAS = ["imperium", "websites", "trading", "faith", "fitness", "discipline", "money", "other"] as const;
export type Area = (typeof AREAS)[number];

/** The businesses work time is logged against. */
export const WORK_AREAS = ["imperium", "websites", "trading", "other"] as const;
export type WorkArea = (typeof WORK_AREAS)[number];

export const AREA_LABEL: Record<Area, string> = {
  imperium: "Imperium",
  websites: "Websites",
  trading: "AI Trading",
  faith: "Faith",
  fitness: "Fitness",
  discipline: "Discipline",
  money: "Money",
  other: "Other",
};

/** Short names for chips and tight rows. */
export const AREA_SHORT: Record<Area, string> = { ...AREA_LABEL, trading: "AI Bot" };

export function isArea(value: unknown): value is Area {
  return typeof value === "string" && (AREAS as readonly string[]).includes(value);
}

export function isWorkArea(value: unknown): value is WorkArea {
  return typeof value === "string" && (WORK_AREAS as readonly string[]).includes(value);
}

/** The area a task title is about, from the words in it. Null when it's not clear. */
export function detectArea(text: string): Area | null {
  const t = text.toLowerCase();
  if (/\bimperium\b|detail|ceramic|paint correction|\bpolish|\breels?\b|\bbooking|\bquote/.test(t)) return "imperium";
  if (/website|\bweb\b|\bdemos?\b|cold call|landing page|\bsite\b|\bdomain/.test(t)) return "websites";
  if (/\bbot\b|trading|backtest|tradingview|strateg|\balgo|\bfutures\b/.test(t)) return "trading";
  if (/\bgym\b|cardio|workout|\brun\b|protein|\bsteps\b|\bstretch/.test(t)) return "fitness";
  if (/bible|\bpray|church|scripture|devotion|\bworship/.test(t)) return "faith";
  if (/\binvoice|\btax|budget|\bbank|\bsuper\b|savings/.test(t)) return "money";
  return null;
}
