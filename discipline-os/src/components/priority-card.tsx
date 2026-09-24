"use client";

import { Check, RotateCcw, X } from "lucide-react";
import { useState } from "react";
import type { PriorityItem, PriorityStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const ORDINAL = ["First", "Second", "Third"] as const;

interface PriorityCardProps {
  priority: PriorityItem;
  /** Last night's "tomorrow's #1", offered while the first slot is empty. */
  suggestion?: string | null;
  disabled?: boolean;
  completedTime?: string | null;
  onSaveTitle: (title: string) => void;
  onSaveDescription: (description: string) => void;
  onStatus: (status: PriorityStatus) => void;
}

/** One of the day's three priorities: write it, finish it, or consciously drop it. */
export function PriorityCard({
  priority,
  suggestion,
  disabled,
  completedTime,
  onSaveTitle,
  onSaveDescription,
  onStatus,
}: PriorityCardProps) {
  const [title, setTitle] = useState(priority.title);
  const [detailOpen, setDetailOpen] = useState(Boolean(priority.description));
  const [detail, setDetail] = useState(priority.description ?? "");
  const filled = priority.title.trim().length > 0;
  const done = priority.status === "done";
  const dropped = priority.status === "dropped";
  const label = `${ORDINAL[priority.position - 1]} priority`;

  function commitTitle() {
    const next = title.trim();
    if (next !== priority.title) onSaveTitle(next);
  }

  return (
    <li className="flex gap-3.5 py-2.5">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={filled ? `Mark "${priority.title}" done` : `${label}: write it first`}
        disabled={disabled || !filled || dropped}
        onClick={() => onStatus(done ? "pending" : "done")}
        className="-mx-2.5 -my-0.5 grid size-12 shrink-0 touch-manipulation place-items-center rounded-full disabled:cursor-default"
      >
        <span
          aria-hidden
          className={cn(
            "grid size-7 place-items-center rounded-full border-[1.5px] transition-colors duration-200",
            done ? "border-primary bg-primary text-primary-foreground" : filled && !dropped ? "border-primary/70" : "border-input",
          )}
        >
          {done ? (
            <Check className="size-4 animate-in zoom-in-50 duration-200" strokeWidth={3} />
          ) : (
            <span className="text-xs text-muted-foreground">{priority.position}</span>
          )}
        </span>
      </button>

      <div className="min-w-0 flex-1">
        <input
          aria-label={label}
          value={title}
          disabled={disabled || done}
          maxLength={120}
          placeholder={`${label}`}
          enterKeyHint="done"
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className={cn(
            "h-11 w-full bg-transparent text-[19px] leading-tight font-medium tracking-tight outline-none placeholder:font-normal placeholder:text-faint",
            done && "text-muted-foreground",
            dropped && "text-faint line-through",
          )}
        />

        {!filled && suggestion && priority.position === 1 && !disabled && (
          <button
            type="button"
            onClick={() => {
              setTitle(suggestion);
              onSaveTitle(suggestion);
            }}
            className="mt-1 min-h-11 text-left text-sm text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground"
          >
            Use last night&apos;s #1: <span className="text-foreground">{suggestion}</span>
          </button>
        )}

        {filled && (
          <div className="mt-0.5 flex min-h-8 items-center gap-4 text-sm text-muted-foreground">
            {done && completedTime && <span className="text-faint">Done {completedTime}</span>}
            {dropped && <span className="text-faint">Dropped</span>}
            {!detailOpen && !disabled && !done && !dropped && (
              <button type="button" className="min-h-11 hover:text-foreground" onClick={() => setDetailOpen(true)}>
                Add detail
              </button>
            )}
            {!disabled && !done && (
              <button
                type="button"
                className="inline-flex min-h-11 items-center gap-1 hover:text-foreground"
                onClick={() => onStatus(dropped ? "pending" : "dropped")}
              >
                {dropped ? <RotateCcw className="size-3.5" aria-hidden /> : <X className="size-3.5" aria-hidden />}
                {dropped ? "Bring back" : "Drop"}
              </button>
            )}
          </div>
        )}

        {filled && detailOpen && (
          <textarea
            aria-label={`${label} detail`}
            value={detail}
            disabled={disabled}
            maxLength={500}
            placeholder="What does done look like?"
            onChange={(e) => setDetail(e.target.value)}
            onBlur={() => {
              if (detail.trim() !== (priority.description ?? "")) onSaveDescription(detail.trim());
            }}
            rows={2}
            className="mt-1 w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-[15px] text-foreground outline-none [field-sizing:content] placeholder:text-faint focus-visible:border-primary/70 disabled:opacity-60"
          />
        )}
      </div>
    </li>
  );
}
