import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/*
  The small parts the goal and business screens share inside their panels and sheets: one field
  style, one label style, an iOS switch and a quiet note. Everything is 44 points or more.
*/

/** A text field inside a panel or sheet: 48 points tall, 17-point type, no zoom on iOS. */
export const field =
  "min-h-12 w-full min-w-0 rounded-xl border border-input bg-transparent px-3.5 text-[17px] text-foreground outline-none placeholder:text-faint focus-visible:border-foreground/45 disabled:opacity-60";

/** A multi-line field that grows with what's typed. */
export const area = cn(field, "min-h-[5.5rem] resize-none py-3 leading-snug [field-sizing:content]");

/** A label sitting above its field. */
export const fieldLabel = "grid gap-1.5 text-[15px] text-muted-foreground";

/** A segmented control's track, and one of its segments (a button, or a label round a radio). */
export const segTrack = "grid gap-0.5 rounded-[14px] bg-accent p-[3px]";
export function segItem(on: boolean) {
  return cn(
    "flex min-h-11 min-w-0 cursor-pointer items-center justify-center rounded-[11px] px-2 text-center text-[15px] leading-tight transition-[background-color,color,box-shadow] duration-200 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-foreground/30",
    on ? "bg-card font-medium text-foreground shadow-[0_1px_2px_rgb(0_0_0/0.08),0_3px_10px_-4px_rgb(0_0_0/0.28)]" : "text-muted-foreground hover:text-foreground",
  );
}

/** The track and knob, drawn at the platform's size (51 × 31). */
export function SwitchTrack({ on }: { on: boolean }) {
  return (
    <span aria-hidden className={cn("relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200", on ? "bg-kept" : "bg-foreground/15")}>
      <span
        className={cn(
          "absolute top-[2px] size-[27px] rounded-full bg-white shadow-[0_2px_6px_rgb(0_0_0/0.22)] transition-[left] duration-200 ease-(--ease-out-quart)",
          on ? "left-[22px]" : "left-[2px]",
        )}
      />
    </span>
  );
}

/** A whole row that flips a switch: the title on the left, the switch on the right. */
export function SwitchRow({
  title,
  subtitle,
  on,
  onChange,
  ariaLabel,
  disabled,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  on: boolean;
  onChange: (on: boolean) => void;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cn("flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors active:bg-accent disabled:opacity-60", className)}
    >
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="text-[17px] leading-snug text-foreground">{title}</span>
        {subtitle && <span className="text-[14px] leading-snug text-muted-foreground">{subtitle}</span>}
      </span>
      <SwitchTrack on={on} />
    </button>
  );
}

/** A quiet warning line inside a panel. */
export function Note({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p role="note" className={cn("flex gap-3 px-4 py-3 text-[15px] leading-snug text-foreground", className)}>
      <AlertTriangle className="mt-0.5 size-[18px] shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0">{children}</span>
    </p>
  );
}
