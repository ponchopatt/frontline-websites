"use client";

import { useState } from "react";
import { BOOKS, chaptersIn } from "@/lib/bible";
import { cn } from "@/lib/utils";

interface ReadingPickerProps {
  value: { book: string; chapter: number; passage: string | null };
  onSave: (book: string, chapter: number, passage: string | null) => void;
  onCancel: () => void;
  className?: string;
}

/** Book, chapter and optional verses for the day's reading. */
export function ReadingPicker({ value, onSave, onCancel, className }: ReadingPickerProps) {
  const [book, setBook] = useState(value.book);
  const [chapter, setChapter] = useState(String(value.chapter));
  const [passage, setPassage] = useState(value.passage ?? "");
  const max = chaptersIn(book) ?? 1;
  const n = Number(chapter);
  const valid = Number.isInteger(n) && n >= 1 && n <= max;
  const field = "h-12 rounded-lg border border-input bg-background px-3 text-[16px] outline-none focus-visible:border-primary/70";

  return (
    <form
      className={cn("grid gap-2", className)}
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSave(book, n, passage.trim() || null);
      }}
    >
      <div className="grid grid-cols-[1fr_5.5rem] gap-2">
        <label className="grid gap-1 text-sm text-muted-foreground">
          Book
          <select value={book} onChange={(e) => setBook(e.target.value)} className={field}>
            {BOOKS.map(([name]) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm text-muted-foreground">
          Chapter
          <input
            inputMode="numeric"
            value={chapter}
            onChange={(e) => setChapter(e.target.value.replace(/\D/g, ""))}
            className={field}
            aria-invalid={!valid}
            aria-describedby={valid ? undefined : "chapter-error"}
          />
        </label>
      </div>
      <label className="grid gap-1 text-sm text-muted-foreground">
        Verses (optional)
        <input value={passage} maxLength={80} onChange={(e) => setPassage(e.target.value)} placeholder="1–18" className={cn(field, "placeholder:text-faint")} />
      </label>
      {!valid && (
        <p id="chapter-error" className="text-sm text-primary">
          {book} has {max} chapters.
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={!valid} className="h-11 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">
          Save reading
        </button>
        <button type="button" onClick={onCancel} className="h-11 rounded-full px-4 text-sm text-muted-foreground hover:text-foreground">
          Cancel
        </button>
      </div>
    </form>
  );
}
