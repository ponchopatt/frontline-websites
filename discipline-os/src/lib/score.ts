/**
 * The daily score: how much of the day's chosen practice was done. Nothing more.
 *
 *   God 25% · Work 30% · Body 20% · Discipline 20% · Reflection 5%
 *
 * Each category scores completed ÷ active items. Work scores actual ÷ target hours, capped
 * at 1. A category with nothing active that day (no body habits, a 0h work target) is left
 * out and its weight is shared proportionally across the others — never divided by zero,
 * never silently counted as 0%.
 *
 * What goes in each category:
 *   God        — the four Bible checks (reading, SOAP, prayer, application) + "god" habits
 *   Work       — minutes worked ÷ the work target
 *   Body       — body habits
 *   Discipline — morning routine + discipline habits (starting the day right is discipline)
 *   Reflection — how many of the six night-review questions are answered
 */

export const CATEGORIES = ["god", "work", "body", "discipline", "reflection"] as const;
export type ScoreCategory = (typeof CATEGORIES)[number];

export const WEIGHTS: Record<ScoreCategory, number> = {
  god: 25,
  work: 30,
  body: 20,
  discipline: 20,
  reflection: 5,
};

export const CATEGORY_LABELS: Record<ScoreCategory, string> = {
  god: "God",
  work: "Work",
  body: "Body",
  discipline: "Discipline",
  reflection: "Reflection",
};

export const BIBLE_ITEMS = 4;
export const REVIEW_ITEMS = 6;

export interface Tally {
  done: number;
  total: number;
}

export interface ScoreInput {
  god: Tally;
  body: Tally;
  discipline: Tally;
  reflection: Tally;
  work: { minutes: number; targetMinutes: number };
}

export interface CategoryResult {
  /** 0–1, or null when the category had nothing active and was left out. */
  ratio: number | null;
  /** Share of the score this category carried today, 0–100, after redistribution. */
  weight: number;
}

export interface ScoreResult {
  /** 0–100, whole number. */
  score: number;
  categories: Record<ScoreCategory, CategoryResult>;
}

function tallyRatio({ done, total }: Tally): number | null {
  if (!Number.isFinite(total) || total <= 0) return null;
  const clampedDone = Math.min(Math.max(done, 0), total);
  return clampedDone / total;
}

function workRatio({ minutes, targetMinutes }: ScoreInput["work"]): number | null {
  if (!Number.isFinite(targetMinutes) || targetMinutes <= 0) return null;
  return Math.min(Math.max(minutes, 0) / targetMinutes, 1);
}

export function computeScore(input: ScoreInput): ScoreResult {
  const ratios: Record<ScoreCategory, number | null> = {
    god: tallyRatio(input.god),
    work: workRatio(input.work),
    body: tallyRatio(input.body),
    discipline: tallyRatio(input.discipline),
    reflection: tallyRatio(input.reflection),
  };

  const activeWeight = CATEGORIES.reduce(
    (sum, c) => (ratios[c] === null ? sum : sum + WEIGHTS[c]),
    0,
  );

  const categories = {} as Record<ScoreCategory, CategoryResult>;
  let raw = 0;
  for (const c of CATEGORIES) {
    const ratio = ratios[c];
    const weight = ratio === null || activeWeight === 0 ? 0 : (WEIGHTS[c] / activeWeight) * 100;
    categories[c] = { ratio, weight };
    if (ratio !== null) raw += ratio * weight;
  }

  // Guard against float drift (e.g. 99.99999) before rounding.
  const score = Math.min(100, Math.max(0, Math.round(raw + 1e-9)));
  return { score, categories };
}

/** Plain, neutral words for a score. Never "failed", never a judgement of the person. */
export function scoreCaption(score: number, threshold: number): string {
  if (score >= 100) return "Everything you planned is done.";
  if (score >= threshold) return "Above your streak line.";
  if (score === 0) return "Nothing logged yet.";
  return `${threshold - score} points to your streak line.`;
}
