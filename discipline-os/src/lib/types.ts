import type { Area, WorkArea } from "./areas";
import type { PlanKey } from "./bible";
import type { CloseSummary } from "./close-day";
import type { LocalDate } from "./day";
import type { MemoryCard, Momentum, RecordBaseline } from "./history";
import type { DayScore } from "./streak";

export type HabitCategory = "morning" | "body" | "discipline" | "god";
export type HabitKind = "bible" | "journal" | "prayer" | "evening_prayer" | "gym" | "cardio";
export type TaskStatus = "pending" | "done" | "dropped";

/** The night review: four questions, then Close Day. */
export const REVIEW_FIELDS = ["accomplished", "wasted_time_on", "broke_word_where", "tomorrow_priority"] as const;
export type ReviewField = (typeof REVIEW_FIELDS)[number];
export type ReviewState = Record<ReviewField, string>;

export interface ProfileSettings {
  displayName: string | null;
  timezone: string;
  dayStartHour: number;
  workTargetHours: number;
  /** Keep My Word line for the streak, 0–100. */
  streakThreshold: number;
  bestStreak: number;
  /** ISO weekdays that are work days. */
  workDays: number[];
  /** Hours a day to give a business, e.g. { trading: 2 }. */
  hourTargets: Partial<Record<WorkArea, number>>;
  biblePlan: PlanKey;
  /** Minimum Day: minutes of focused work (0: not part of it), and whether gym or cardio is. */
  minimumWorkMinutes: number;
  minimumFitness: boolean;
}

export interface HabitItem {
  id: string;
  name: string;
  category: HabitCategory;
  kind: HabitKind | null;
  /** ISO weekdays it's due; null for every day. */
  days: number[] | null;
  /** Due on the day being shown. */
  due: boolean;
  /** One of the Minimum Day's non-negotiables. */
  minimum: boolean;
  sortOrder: number;
  completedAt: string | null;
  editedAt: string | null;
}

/** What a task supports, all the way up. Plain data so it can cross to the browser. */
export interface GoalChain {
  weekly: { id: string; title: string; weekStart: LocalDate } | null;
  monthly: { id: string; title: string; monthStart: LocalDate } | null;
  yearly: { id: string; title: string; year: number } | null;
}

export interface TaskItem {
  id: string;
  /** Null: parked for later. */
  localDate: LocalDate | null;
  title: string;
  area: Area | null;
  category: string | null;
  /** 1–3: today's Big 3. */
  rank: 1 | 2 | 3 | null;
  status: TaskStatus;
  priority: 1 | 2 | 3;
  dueDate: LocalDate | null;
  notes: string | null;
  quantity: number | null;
  unit: string | null;
  metricId: string | null;
  weeklyGoalId: string | null;
  carriedFromId: string | null;
  completedAt: string | null;
  chain: GoalChain | null;
  proofCount: number;
}

export interface CounterItem {
  id: string;
  area: Area;
  key: string;
  label: string;
  grp: string | null;
  unit: string | null;
  aggregation: "sum" | "latest";
  pinned: boolean;
  /** Today's entry (a level shows its latest value). */
  value: number;
  /** Today's target, or null. */
  target: number | null;
  weekTotal: number;
  weekTarget: number | null;
}

export interface WorkBlockItem {
  id: string;
  task: string;
  area: WorkArea | null;
  plannedStart: string | null; // "HH:MM"
  plannedEnd: string | null;
}

export interface WorkSessionItem {
  id: string;
  blockId: string | null;
  area: WorkArea | null;
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
  /** True when no reading is saved for the day yet and this one comes from the plan. */
  suggested: boolean;
  journal: string;
  plan: PlanKey;
}

export interface MilestoneStep {
  title: string;
  done: boolean;
}

export interface MilestoneItem {
  id: string;
  title: string;
  steps: MilestoneStep[];
}

export const PROOF_TOPICS = ["faith", "gym", "imperium", "websites", "work", "other"] as const;
export type ProofTopic = (typeof PROOF_TOPICS)[number];

export interface ProofItem {
  id: string;
  /** A short-lived link to the photo. */
  url: string | null;
  taskId: string | null;
  habitId: string | null;
  label: string | null;
  topic: ProofTopic;
  uploadedAt: string;
}

/** Today → Week → Month → Year for one yearly goal. */
export interface GoalLadder {
  area: Area | null;
  yearly: { id: string; title: string; year: number; ratio: number | null };
  monthly: { id: string; title: string; monthStart: LocalDate; ratio: number | null } | null;
  weekly: { id: string; title: string; weekStart: LocalDate; ratio: number | null } | null;
  /** Today's part, e.g. "10 leads called" or "$1,000 revenue target". */
  today: string | null;
}

export interface DayView {
  date: LocalDate;
  today: LocalDate;
  isToday: boolean;
  /** Set when the day was closed with Close Day. */
  locked: { score: number; completedAt: string } | null;
  profile: ProfileSettings;
  habits: HabitItem[];
  /** Today's tasks: the Big 3 (ranked) and the rest. */
  tasks: TaskItem[];
  /** Pending tasks from the last week that haven't been moved on. */
  unfinished: TaskItem[];
  /** Tasks parked for later. */
  later: TaskItem[];
  /** Last night's answer to "tomorrow's #1". */
  lastNightPriority: string | null;
  counters: CounterItem[];
  blocks: WorkBlockItem[];
  sessions: WorkSessionItem[];
  /** The running session, whichever day it belongs to. */
  openSession: (WorkSessionItem & { task: string | null }) | null;
  bible: BibleState;
  review: ReviewState;
  milestone: MilestoneItem | null;
  /** Monday to Sunday of this week. */
  gymWeek: Array<{ date: LocalDate; due: boolean; done: boolean }>;
  cardioWeek: { done: number; days: number };
  proofs: ProofItem[];
  streak: { current: number; best: number };
  /** The last 30 days of Keep My Word, oldest first, ending with this view's today. */
  history: DayScore[];
  firstDay: LocalDate;
  ladders: GoalLadder[];
  weekStart: LocalDate;
  /** When Minimum Day was switched on for this day, or null. */
  minimumAt: string | null;
  /** The summary stored when the day was closed. */
  closed: CloseSummary | null;
  /** Today only: the last seven days, what today's records have to beat, and a now-and-then card. */
  momentum: Momentum | null;
  baseline: RecordBaseline | null;
  memory: MemoryCard | null;
}

/** The Weekly Boss in one line: targets hit this week, and how far through them. */
export interface BossSummary {
  hit: number;
  total: number;
  ratio: number;
  state: "fighting" | "defeated" | "survived";
}

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };
