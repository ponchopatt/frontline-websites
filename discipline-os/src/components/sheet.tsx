"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** A short line under the title: "3 of 5 done". */
  subtitle?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** How long a sheet takes to slide away; matches `sheet-out` in globals.css. */
const LEAVE_MS = 220;

/**
 * A bottom sheet on phones, a centred panel on wider screens. Built on <dialog>, so focus,
 * Escape and the backdrop behave like the platform's own. Drag the top down to close it.
 */
export function Sheet({ open, onClose, title, subtitle, children, className }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ y: number; id: number } | null>(null);
  const [dy, setDy] = useState(0);
  // What was showing, kept while the sheet slides away: its parent has usually cleared it by
  // then, and an empty sheet sliding out looks broken.
  const [shown, setShown] = useState({ title, subtitle, children });
  if (open && (shown.title !== title || shown.subtitle !== subtitle || shown.children !== children)) {
    setShown({ title, subtitle, children });
  }
  const [wasOpen, setWasOpen] = useState(open);
  const [leaving, setLeaving] = useState(false);
  if (wasOpen !== open) {
    setWasOpen(open);
    setLeaving(!open);
  }
  const view = leaving ? shown : { title, subtitle, children };

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      // The platform focuses the first button (×), which a phone then rings. Focus the sheet
      // itself instead, unless something inside asked for focus.
      if (document.activeElement === closeRef.current) d.focus({ preventScroll: true });
    }
    if (!open && d.open) {
      // Slide out first, from wherever a drag left it; the dialog closes once that's done.
      d.classList.add("sheet-closing");
      const t = setTimeout(() => {
        d.classList.remove("sheet-closing");
        if (d.open) d.close();
        setLeaving(false);
        setDy(0);
      }, LEAVE_MS);
      return () => {
        clearTimeout(t);
        d.classList.remove("sheet-closing");
      };
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      tabIndex={-1}
      aria-label={view.title}
      // Escape and the phone's back gesture: slide out like any other close. A sheet opened from
      // inside this one gets its own; React passes these events up the tree, so only this
      // sheet's own count here.
      onCancel={(e) => {
        if (e.target !== e.currentTarget) return;
        e.preventDefault();
        onClose();
      }}
      onClose={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      style={dy ? { transform: `translateY(${dy}px)`, transition: "none" } : undefined}
      className={cn(
        "surface-light m-0 mt-auto max-h-[90dvh] w-full max-w-none overflow-y-auto overscroll-contain rounded-t-[28px] border border-border bg-popover p-0 text-foreground outline-none transition-transform duration-200",
        "backdrop:bg-black/55 backdrop:backdrop-blur-[2px] open:animate-in open:fade-in-0 open:slide-in-from-bottom-10 open:duration-300",
        "sm:m-auto sm:max-w-lg sm:rounded-[28px]",
        className,
      )}
    >
      <div
        className="sticky top-0 z-10 touch-none bg-popover/95 px-5 pt-2 pb-2 backdrop-blur select-none"
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest("button")) return;
          drag.current = { y: e.clientY, id: e.pointerId };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (drag.current?.id === e.pointerId) setDy(Math.max(0, e.clientY - drag.current.y));
        }}
        onPointerUp={(e) => {
          if (drag.current?.id !== e.pointerId) return;
          drag.current = null;
          // Far enough: carry on down from the finger. Otherwise spring back.
          if (dy > 90) onClose();
          else setDy(0);
        }}
        onPointerCancel={() => {
          drag.current = null;
          setDy(0);
        }}
      >
        <span aria-hidden className="mx-auto mb-2 block h-[5px] w-9 rounded-full bg-foreground/20 sm:hidden" />
        <div className="flex items-center justify-between gap-3">
          <div className="grid min-w-0 gap-0.5">
            <h2 className="truncate text-[20px] font-medium tracking-tight">{view.title}</h2>
            {view.subtitle && <p className="text-[14px] text-muted-foreground">{view.subtitle}</p>}
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="-mr-2 grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-accent">
            <X className="size-5" aria-hidden />
          </button>
        </div>
      </div>
      <div className="px-5 pt-2 pb-[max(1.5rem,env(safe-area-inset-bottom))]">{view.children}</div>
    </dialog>
  );
}
