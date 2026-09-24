"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { dbFail, invalid, ok } from "@/lib/action-helpers";
import { getViewer, recomputeBestStreak } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";

const timezoneSchema = z
  .string()
  .refine((tz) => Intl.supportedValuesOf("timeZone").includes(tz) || tz === "UTC", {
    message: "Pick a timezone from the list.",
  });

const credentialsSchema = z.object({
  email: z.email({ message: "Enter a valid email address." }),
  password: z.string().min(8, "Use at least 8 characters for your password."),
});

export interface AuthState {
  error?: string;
  notice?: string;
  email?: string;
}

export async function signIn(_prev: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "").trim();
  const parsed = credentialsSchema.safeParse({ email, password: form.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code === "email_not_confirmed") {
      return { error: "Confirm your email first. The link is in your inbox.", email };
    }
    return { error: "That email and password don't match an account.", email };
  }
  redirect("/");
}

export async function signUp(_prev: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "").trim();
  const parsed = credentialsSchema.safeParse({ email, password: form.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, email };

  // The browser's timezone, so the day boundary is right from the first tick.
  const tzInput = String(form.get("timezone") ?? "");
  const timezone = timezoneSchema.safeParse(tzInput).success ? tzInput : "Australia/Sydney";

  const origin = (await headers()).get("origin") ?? "";
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: {
      data: { timezone },
      emailRedirectTo: origin ? `${origin}/auth/confirm` : undefined,
    },
  });
  if (error) {
    if (error.code === "user_already_exists") {
      return { error: "There's already an account with that email. Sign in instead.", email };
    }
    if (error.code === "weak_password") {
      return { error: "Choose a stronger password: longer, and not a common one.", email };
    }
    return { error: "The account couldn't be created. Try again in a moment.", email };
  }
  if (!data.session) {
    return { notice: `Check ${email} for a link to confirm your account, then sign in.`, email };
  }
  redirect("/");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

const settingsSchema = z.object({
  displayName: z.string().trim().max(60, "Keep your name under 60 characters."),
  timezone: timezoneSchema,
  dayStartHour: z.number().int().min(0, "Pick an hour from 00 to 23.").max(23, "Pick an hour from 00 to 23."),
  workTargetHours: z
    .number()
    .min(0, "The work target can't be negative.")
    .max(16, "Keep the work target at 16 hours or less."),
  streakThreshold: z
    .number()
    .int()
    .min(1, "The streak line has to be at least 1%.")
    .max(100, "The streak line can't be over 100%."),
});

export async function saveSettings(input: z.input<typeof settingsSchema>): Promise<ActionResult> {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const viewer = await getViewer();
  const d = parsed.data;
  const { error } = await viewer.supabase
    .from("profiles")
    .update({
      display_name: d.displayName || null,
      timezone: d.timezone,
      day_start_hour: d.dayStartHour,
      work_target_hours: d.workTargetHours,
      streak_threshold: d.streakThreshold,
    })
    .eq("user_id", viewer.userId);
  if (error) return dbFail(error, "Your settings weren't saved. Try again.");

  // A new threshold or work target changes which past days count towards a streak.
  await recomputeBestStreak({
    ...viewer,
    profile: {
      ...viewer.profile,
      timezone: d.timezone,
      dayStartHour: d.dayStartHour,
      workTargetHours: d.workTargetHours,
      streakThreshold: d.streakThreshold,
    },
  });
  return ok();
}
