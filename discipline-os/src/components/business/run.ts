import { toast } from "sonner";
import type { ActionResult } from "@/lib/types";

export const SAVE_FAILED = "That didn't save. Check your connection and try again.";

/** Calls a server action and says what went wrong, so callers only decide what to undo. */
export async function run<T>(action: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    const res = await action();
    if (!res.ok) toast.error(res.error);
    return res;
  } catch {
    toast.error(SAVE_FAILED);
    return { ok: false, error: SAVE_FAILED };
  }
}
