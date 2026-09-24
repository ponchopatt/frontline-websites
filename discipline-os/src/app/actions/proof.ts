"use server";

import { z } from "zod";
import { dbFail, fail, guardDate, invalid, localDateSchema, ok, uuidSchema } from "@/lib/action-helpers";
import { getViewer } from "@/lib/data";
import type { ActionResult, ProofItem, ProofTopic } from "@/lib/types";
import { PROOF_TOPICS } from "@/lib/types";

const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_BYTES = 4 * 1024 * 1024;

const metaSchema = z.object({
  date: localDateSchema,
  taskId: uuidSchema.nullable(),
  habitId: uuidSchema.nullable(),
  label: z.string().trim().max(120).nullable(),
  topic: z.enum(PROOF_TOPICS).nullable(),
});

const TASK_TOPIC: Record<string, ProofTopic> = { faith: "faith", fitness: "gym", imperium: "imperium", websites: "websites", trading: "work" };
const HABIT_TOPIC: Record<string, ProofTopic> = { bible: "faith", journal: "faith", prayer: "faith", evening_prayer: "faith", gym: "gym", cardio: "gym" };

/**
 * Saves a proof photo for a day, optionally tied to a task or habit. The photo goes to the
 * private "proof" bucket under the user's own folder; only they can read it back.
 */
export async function uploadProof(form: FormData): Promise<ActionResult<ProofItem>> {
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("Choose a photo first.");
  const ext = TYPES[file.type];
  if (!ext) return fail("Use a JPEG, PNG or WebP photo.");
  if (file.size > MAX_BYTES) return fail("That photo is too big. Try a smaller one.");
  const text = (key: string) => {
    const v = form.get(key);
    return typeof v === "string" && v ? v : null;
  };
  const parsed = metaSchema.safeParse({ date: text("date"), taskId: text("taskId"), habitId: text("habitId"), label: text("label"), topic: text("topic") });
  if (!parsed.success) return invalid(parsed.error);
  const { date, taskId, habitId, label } = parsed.data;

  const viewer = await getViewer();
  const refused = guardDate(viewer, date);
  if (refused) return refused;

  // What it's proof of: as chosen, else from the task's business or the habit.
  let topic: ProofTopic = parsed.data.topic ?? "other";
  if (!parsed.data.topic && taskId) {
    const { data: t } = await viewer.supabase.from("daily_goals").select("area").eq("id", taskId).maybeSingle();
    topic = (t?.area && TASK_TOPIC[t.area]) || "other";
  } else if (!parsed.data.topic && habitId) {
    const { data: h } = await viewer.supabase.from("habits").select("kind,category").eq("id", habitId).maybeSingle();
    topic = (h?.kind && HABIT_TOPIC[h.kind]) || (h?.category === "god" ? "faith" : h?.category === "body" ? "gym" : "other");
  }
  const path = `${viewer.userId}/${date}/${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await viewer.supabase.storage.from("proof").upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) return fail("The photo didn't upload. Check your connection and try again.");

  const { data, error } = await viewer.supabase
    .from("proof_uploads")
    .insert({ local_date: date, storage_path: path, task_id: taskId, habit_id: habitId, note: label, topic })
    .select("id,uploaded_at")
    .single();
  if (error || !data) {
    await viewer.supabase.storage.from("proof").remove([path]);
    return dbFail(error ?? {}, "The photo wasn't saved. Try again.");
  }
  const { data: signed } = await viewer.supabase.storage.from("proof").createSignedUrl(path, 60 * 60);
  return ok({ id: data.id, url: signed?.signedUrl ?? null, taskId, habitId, label, topic, uploadedAt: data.uploaded_at });
}

/** Removes a proof photo and its file. */
export async function deleteProof(input: { id: string }): Promise<ActionResult> {
  const parsed = z.object({ id: uuidSchema }).safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { supabase } = await getViewer();
  const { data: row } = await supabase.from("proof_uploads").select("storage_path").eq("id", parsed.data.id).maybeSingle();
  if (!row) return fail("That photo couldn't be found.");
  const { error } = await supabase.from("proof_uploads").delete().eq("id", parsed.data.id);
  if (error) return dbFail(error, "The photo wasn't removed. Try again.");
  await supabase.storage.from("proof").remove([row.storage_path]);
  return ok();
}
