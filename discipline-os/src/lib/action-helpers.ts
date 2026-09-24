import "server-only";
import { z } from "zod";
import { isLocalDate, type LocalDate } from "./day";
import type { ActionResult } from "./types";
import type { Viewer } from "./data";

export const localDateSchema = z
  .string()
  .refine(isLocalDate, { message: "That date isn't valid." }) as z.ZodType<LocalDate>;

export const uuidSchema = z.uuid({ message: "That item couldn't be found." });

export function ok(): ActionResult;
export function ok<T>(data: T): ActionResult<T>;
export function ok<T>(data?: T): ActionResult<T | undefined> {
  return { ok: true, data };
}

export function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

/** The first validation message, in plain words. */
export function invalid(error: z.ZodError): { ok: false; error: string } {
  return fail(error.issues[0]?.message ?? "Some of that input isn't valid.");
}

interface DbError {
  code?: string;
  message?: string;
  hint?: string | null;
}

/** Turns a database error into a sentence someone half-awake can act on. */
export function dbFail(error: DbError, fallback = "That didn't save. Check your connection and try again.") {
  if (error.hint === "future_day") return fail("You can't log a day that hasn't started yet.");
  if (error.hint === "day_locked") return fail("This day is completed. Reopen it to make changes.");
  if (error.code === "42501") return fail("You don't have access to that.");
  if (error.code === "23514") return fail("That value isn't allowed.");
  return fail(fallback);
}

/** Past and present days only. Tomorrow is refused here and again by the database. */
export function guardDate(viewer: Viewer, date: LocalDate): { ok: false; error: string } | null {
  if (date > viewer.today) return fail("You can't log a day that hasn't started yet.");
  return null;
}
