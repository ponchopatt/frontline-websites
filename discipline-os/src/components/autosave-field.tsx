"use client";

import { useId, useRef, useState } from "react";
import { toast } from "sonner";
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

/** A labelled field that saves itself when you leave it (or press Enter on one line). */
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
  const [draft, setDraft] = useState(value);
  const [status, setStatus] = useState<Status>("idle");
  const saved = useRef(value);

  async function commit() {
    const next = draft;
    if (next.trim() === saved.current.trim()) return;
    setStatus("saving");
    const res = await onSave(next);
    if (res.ok) {
      saved.current = next;
      setStatus("saved");
      onSaved?.(next);
    } else {
      setStatus("error");
      toast.error(res.error);
    }
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
          onChange={(e) => {
            setDraft(e.target.value);
            setStatus("idle");
          }}
          className={cn(base, "min-h-[4.5rem] resize-none py-2.5 [field-sizing:content]")}
        />
      ) : (
        <input
          {...common}
          onBlur={() => void commit()}
          type="text"
          enterKeyHint="done"
          onChange={(e) => {
            setDraft(e.target.value);
            setStatus("idle");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className={cn(base, "h-12")}
        />
      )}
    </div>
  );
}
