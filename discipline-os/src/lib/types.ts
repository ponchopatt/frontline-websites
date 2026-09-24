import type { LocalDate } from "./day";
import type { DayScore } from "./streak";

export type HabitCategory = "morning" | "body" | "discipline" | "god";
export type PriorityStatus = "pending" | "done" | "dropped";
export type BibleCheck = "reading" | "soap" | "prayer" | "application";
export type BibleTextField = "scripture_notes" | "observation" | "application" | "prayer" | "obey_today";

export const REVIEW_FIELDS = [
  "accomplished",
  "wasted_time_on",
  "broke_word_where",
  "sought_god",
  "grateful_for",
  "tomorrow_priority",
] as const;
export type ReviewField = (typeof REVIEW_FIELDS)[number];

export interface ProfileSettings {
  displayName: string | null;
  timezone: string;
  dayStartHour: number;
  workTargetHours: number;
  streakThreshold: number;
  bestStreak: number;
}

export interface HabitItem {
  id: string;
  name: string;
  category: HabitCategory;
  sortOrder: number;
  completedAt: string | null;
  editedAt: string | null;
}

export interface PriorityItem {
  position: 1 | 2 | 3;
  id: string | null;
  /** Set when the priority came from a goal's daily action. */
  dailyGoalId: string | null;
  title: string;
  description: string | null;
  status: PriorityStatus;
  completedAt: string | null;
}

export interface WorkBlockItem {
  id: string;
  task: string;
  plannedStart: string | null; // "HH:MM"
  plannedEnd: string | null;
}

export interface WorkSessionItem {
  id: string;
  blockId: string | null;
  localDate: LocalDate;
  startedAt: string;
  endedAt: string | null;
  note: string | null;
}

export interface BibleState {
  readingId: string | null;
  book: string;
  chapter: number;
  passage: string | null;
  /** True when no reading is saved for the day yet and this one is suggested. */
  suggested: boolean;
  checks: Record<BibleCheck, boolean>;
  obeyToday: string;
}

export type ReviewState = Record<ReviewField, string>;

/** What a daily action supports, all the way up. Plain data so it can cross to the browser. */
export interface GoalChain {
  weekly: { id: string; title: string; weekStart: LocalDate } | null;
  monthly: { id: string; title: string; monthStart: LocalDate } | null;
  yearly: { id: string; title: string; year: number } | null;
}

export interface PlanSuggestion {
  key: string;
  title: string;
  quantity: number | null;
  unit: string | null;
  estimatedMinutes: number;
  weeklyGoalId: string | null;
  carriedFromId: string | null;
  createsWorkBlock: boolean;
  reasons: string[];
  chain: GoalChain | null;
}

export interface PlanAction {
  id: string;
  title: string;
  quantity: number | null;
  unit: string | null;
  rank: 1 | 2 | 3 | null;
  status: "pending" | "done" | "dropped";
  chain: GoalChain | null;
}

/** Today's side of the goal system: suggestions from this week's goals, and accepted actions. */
export interface TodayPlan {
  big3: PlanSuggestion[];
  supporting: PlanSuggestion[];
  actions: PlanAction[];
  /** Any active goal exists at all. */
  hasGoals: boolean;
  /** This week has goals planned. */
  hasWeekPlan: boolean;
  weekStart: LocalDate;
}

export interface DayView {
  date: LocalDate;
  today: LocalDate;
  isToday: boolean;
  /** Set when the day was completed with Complete Day. */
  locked: { score: number; completedAt: string } | null;
  profile: ProfileSettings;
  habits: HabitItem[];
  priorities: [PriorityItem, PriorityItem, PriorityItem];
  /** Last night's "tomorrow's #1", offered for an empty first priority. */
  prioritySuggestion: string | null;
  blocks: WorkBlockItem[];
  sessions: WorkSessionItem[];
  /** The running session, whichever day it belongs to. */
  openSession: (WorkSessionItem & { task: string | null }) | null;
  bible: BibleState;
  review: ReviewState;
  streak: { current: number; best: number };
  /** The last 30 days, oldest first, ending with this view's today. */
  history: DayScore[];
  /** When the account started, so the day picker does not wander before it. */
  firstDay: LocalDate;
  plan: TodayPlan | null;
}

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };
