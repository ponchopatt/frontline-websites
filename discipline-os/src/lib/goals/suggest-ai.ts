import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { AREAS, type Area } from "../areas";
import type { Answers, GoalSuggestion, SuggestContext } from "./suggest-goals";

/**
 * Claude refines the rule-based suggestions: it reads the same history plus what the user wrote
 * about their aims, time and commitments, and returns concrete goals with a short reason.
 * Only runs when an API key is configured (ANTHROPIC_API_KEY, or ANTHROPIC_AUTH_TOKEN with
 * ANTHROPIC_BASE_URL for a gateway). Any failure falls back to the rules, never to an error.
 */

const MODEL = process.env.AI_GOALS_MODEL || "claude-opus-5";

export function aiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

const Output = z.object({
  suggestions: z
    .array(
      z.object({
        /** The key of the rule suggestion this refines (keeps its counter or habit), or null for a new one. */
        ref: z.string().nullable(),
        area: z.enum(AREAS),
        title: z.string(),
        target: z.number().nullable(),
        reason: z.string(),
        major: z.boolean(),
      }),
    )
    .max(10),
});

const SYSTEM = `You help one person set this week's goals in their personal execution app. He runs a car detailing business (Imperium), a website business (builds demo sites, cold calls, closes deals), is building an AI trading bot, and tracks faith, fitness and discipline.

Suggest at most 8 goals for this week. Every goal must be concrete: a number or a clear finish line and "this week". Bad: "Work harder on Imperium." Good: "Call 50 qualified leads this week." Bad: "Get fit." Good: "Complete 5 gym sessions and do cardio on 7 days this week."

Ground every number in the history you're given: a real step up from the weekly average (about 10-30%), never a leap, and cut it back if the stated hours or commitments leave less time. With no history, start from the stated weekly target. Honour what the person says they want, but keep the numbers achievable.

Prefer refining the provided rule suggestions: set "ref" to a rule suggestion's key to keep its tracking (counter or habit), and you may change its title, target and reason. Use ref null only for a goal the rules don't cover (it will be ticked off by hand). Mark at most 3 goals as major. Each reason is one or two short plain sentences a 10-year-old would understand, saying why that number.`;

export async function refineWithAI(ctx: SuggestContext, answers: Answers, rules: GoalSuggestion[]): Promise<GoalSuggestion[] | null> {
  if (!aiConfigured()) return null;
  const client = new Anthropic({ timeout: 45_000, maxRetries: 1 });
  const data = {
    weeks_of_history: ctx.weeks,
    work_days_a_week: ctx.workDays,
    counters: ctx.counters.map((c) => ({ area: c.area, counter: c.label, unit: c.unit, weekly_average: c.weeklyAvg, weekly_target: c.weeklyTarget })),
    habits: ctx.habits.map((h) => ({ habit: h.kind, days_a_week_average: h.daysPerWeek, due_days_a_week: h.dueDays })),
    ai_bot_milestone: ctx.milestone,
    their_aims: answers.aims,
    hours_free_this_week: answers.hoursPerWeek,
    already_booked_this_week: answers.commitments || null,
    rule_suggestions: rules.map((r) => ({ key: r.key, area: r.area, title: r.title, target: r.target, reason: r.reason })),
  };

  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      output_config: { effort: "medium", format: zodOutputFormat(Output) },
      messages: [{ role: "user", content: `Here is my history and what I want this week:\n\n${JSON.stringify(data, null, 2)}` }],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) return null;

    const byKey = new Map(rules.map((r) => [r.key, r]));
    const used = new Set<string>();
    const out: GoalSuggestion[] = [];
    for (const s of response.parsed_output.suggestions) {
      const title = s.title.trim().replace(/\.$/, "").slice(0, 140);
      if (!title) continue;
      // A rule suggestion can be refined once; a second use of it becomes a hand-ticked goal.
      const base = s.ref && !used.has(s.ref) ? byKey.get(s.ref) : undefined;
      if (base) used.add(base.key);
      const target = s.target !== null && Number.isFinite(s.target) && s.target > 0 ? Math.round(s.target * 100) / 100 : null;
      out.push({
        key: base ? base.key : `ai-${out.length}`,
        area: base ? base.area : (s.area as Area),
        title,
        target: base && base.target !== null && target === null ? base.target : target,
        unit: base ? base.unit : null,
        metricId: base?.metricId ?? null,
        habitId: base?.habitId ?? null,
        major: s.major,
        reason: s.reason.trim().slice(0, 400),
      });
    }
    // Keep at most three majors, whatever came back.
    let majors = 0;
    for (const s of out) if (s.major && (majors += 1) > 3) s.major = false;
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}
