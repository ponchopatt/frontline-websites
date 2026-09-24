"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}

/**
 * A bottom sheet on phones, a centred panel on wider screens. Built on <dialog>, so focus,
 * Escape and the backdrop behave like the platform's own.
 */
export function Sheet({ open, onClose, title, children, className }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "surface-light m-0 mt-auto max-h-[88dvh] w-full max-w-none overflow-y-auto rounded-t-[28px] border border-border bg-popover p-0 text-foreground",
        "backdrop:bg-black/60 backdrop:backdrop-blur-[2px] open:animate-in open:slide-in-from-bottom-8 open:duration-200",
        "sm:m-auto sm:max-w-lg sm:rounded-[28px]",
        className,
      )}
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-popover/95 px-5 pt-4 pb-2 backdrop-blur">
        <h2 className="text-lg font-medium tracking-tight">{title}</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="-mr-2 grid size-11 place-items-center rounded-full text-muted-foreground hover:bg-accent">
          <X className="size-5" aria-hidden />
        </button>
      </div>
      <div className="px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{children}</div>
    </dialog>
  );
}
