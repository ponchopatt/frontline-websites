"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { reloadIfStale } from "@/lib/stale";
import type { ActionResult } from "@/lib/types";
import { cn } from "@/lib/utils";

interface AutosaveFieldProps {
  label: string;
  value: string;
  onSave: (value: string) => Promise<ActionResult<unknown>>;
  /** Called after a successful save, so the parent can keep its copy in step. */
  onSaved?: (value: string) => void;
  multiline?: boolean;
  placeholder?: string;
  maxLength?: number;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
}

type Status = "idle" | "saving" | "saved" | "error";

/** A pause in typing this long saves what's there. */
const TYPING_PAUSE = 900;

/**
 * A labelled field that saves itself: when typing pauses, when you leave it (or press Enter on
 * one line), and when it goes away mid-sentence (a tab tapped, the app put away). Phones don't
 * always blur a field when you tap beside it, so leaving it is never the only way to save.
 */
export function AutosaveField({
  label,
  value,
  onSave,
  onSaved,
  multiline,
  placeholder,
  maxLength,
  disabled,
  className,
  inputClassName,
}: AutosaveFieldProps) {
  const id = useId();
  const router = useRouter();
  const [draft, setDraft] = useState(value);
  const [status, setStatus] = useState<Status>("idle");
  const saved = useRef(value);
  const typed = useRef(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const live = useRef(false);
  const latest = useRef({ onSave, onSaved, router });
  useEffect(() => {
    latest.current = { onSave, onSaved, router };
  });

  // A newer copy from the server (saved on another screen): take it, unless something is
  // being typed here right now.
  useEffect(() => {
    if (value === saved.current) return;
    if (typed.current === saved.current) {
      typed.current = value;
      setDraft(value);
    }
    saved.current = value;
  }, [value]);

  // Saves run one at a time, each sending whatever is in the field when its turn comes.
  function commit() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    queue.current = queue.current.then(save);
    return queue.current;
  }

  async function save() {
    const next = typed.current;
    if (next.trim() === saved.current.trim()) return;
    if (live.current) setStatus("saving");
    try {
      const res = await latest.current.onSave(next);
      if (res.ok) {
        saved.current = next;
        latest.current.onSaved?.(next);
        if (live.current) setStatus(typed.current === next ? "saved" : "idle");
        // Saved on the way out: the screen now showing may have loaded before this landed.
        else latest.current.router.refresh();
      } else {
        if (live.current) setStatus("error");
        toast.error(res.error);
      }
    } catch (error) {
      if (reloadIfStale(error)) return;
      if (live.current) setStatus("error");
      toast.error("That didn't save. Check your connection and try again.");
    }
  }

  useEffect(() => {
    live.current = true;
    const away = () => {
      if (document.visibilityState === "hidden") void commit();
    };
    document.addEventListener("visibilitychange", away);
    return () => {
      live.current = false;
      document.removeEventListener("visibilitychange", away);
      if (timer.current || typed.current.trim() !== saved.current.trim()) void commit();
    };
    // commit reads only refs, so the first one serves for good.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function change(next: string) {
    typed.current = next;
    setDraft(next);
    setStatus("idle");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void commit(), TYPING_PAUSE);
  }

  const base = cn(
    "w-full rounded-lg border border-input bg-transparent px-3 text-[16px] leading-relaxed text-foreground",
    "placeholder:text-faint focus-visible:border-primary/70 focus-visible:outline-none disabled:opacity-60",
    inputClassName,
  );
  const common = {
    id,
    value: draft,
    placeholder,
    maxLength,
    disabled,
    "aria-describedby": `${id}-status`,
  };

  return (
    <div className={cn("grid gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm text-muted-foreground">
          {label}
        </label>
        <span id={`${id}-status`} aria-live="polite" className="text-[13px] text-muted-foreground">
          {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : status === "error" ? "Not saved" : ""}
        </span>
      </div>
      {multiline ? (
        <textarea
          {...common}
          onBlur={() => void commit()}
          rows={2}
          onChange={(e) => change(e.target.value)}
          className={cn(base, "min-h-[4.5rem] resize-none py-2.5 [field-sizing:content]")}
        />
      ) : (
        <input
          {...common}
          onBlur={() => void commit()}
          type="text"
          enterKeyHint="done"
          onChange={(e) => change(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className={cn(base, "h-12")}
        />
      )}
    </div>
  );
}
