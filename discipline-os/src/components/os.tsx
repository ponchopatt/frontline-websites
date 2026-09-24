import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/*
  The building blocks every screen shares, after iOS: a large title on the ground, then grouped
  lists of plain rows. One frosted panel per group, never a card inside a card.
*/

interface PageHeaderProps {
  title: ReactNode;
  /** A quiet line above the title: the date, the year, "Today". */
  eyebrow?: ReactNode;
  /** One sentence under the title. */
  subtitle?: ReactNode;
  /** A sub-page's way back: "‹ You". */
  back?: { href: string; label: string };
  /** At most one small control at the top right. */
  trailing?: ReactNode;
  className?: string;
}

export function PageHeader({ title, eyebrow, subtitle, back, trailing, className }: PageHeaderProps) {
  return (
    <header className={cn("grid gap-1", className)}>
      {(back || trailing) && (
        <div className="-mx-2 flex min-h-11 items-center justify-between gap-3">
          {back ? (
            <Link href={back.href} className="inline-flex min-h-11 items-center gap-0.5 rounded-full px-2 text-[17px] text-muted-foreground hover:text-foreground">
              <ChevronLeft className="size-5" aria-hidden />
              {back.label}
            </Link>
          ) : (
            <span />
          )}
          {trailing}
        </div>
      )}
      {eyebrow && <p className="text-[15px] text-muted-foreground">{eyebrow}</p>}
      <h1 className="text-[34px] leading-[1.08] font-light tracking-[-0.03em] text-balance">{title}</h1>
      {subtitle && <p className="mt-1 text-[15px] leading-snug text-muted-foreground">{subtitle}</p>}
    </header>
  );
}

interface GroupProps {
  id?: string;
  /** Sentence case, above the panel. */
  title?: ReactNode;
  /** A small text action on the title line: "See all". */
  action?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  /** No row dividers, for a panel holding one block of content. */
  plain?: boolean;
}

/** A titled group of rows in one frosted panel. */
export function Group({ id, title, action, footer, children, className, plain }: GroupProps) {
  const headingId = id && title ? `${id}-heading` : undefined;
  return (
    <section id={id} aria-labelledby={headingId} className={cn("grid scroll-mt-6 grid-cols-[minmax(0,1fr)] gap-2", className)}>
      {(title || action) && (
        <div className="glow-ink flex min-h-6 items-baseline justify-between gap-3 px-1">
          {title && (
            <h2 id={headingId} className="text-[15px] font-medium text-muted-foreground">
              {title}
            </h2>
          )}
          {action}
        </div>
      )}
      <div className={cn("surface overflow-hidden rounded-[22px] border", !plain && "divide-y divide-border")}>{children}</div>
      {footer && <p className="glow-ink px-1 text-[13px] leading-snug text-muted-foreground">{footer}</p>}
    </section>
  );
}

interface RowProps {
  href?: string;
  onClick?: () => void;
  /** An icon or a tick circle on the left. */
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** A number or short word on the right. */
  value?: ReactNode;
  /** A ring or small control on the far right. */
  trailing?: ReactNode;
  /** Shown for links and taps unless turned off. */
  chevron?: boolean;
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
}

/** One line in a group: at least 56 points tall, the whole row is the tap target. */
export function Row({ href, onClick, leading, title, subtitle, value, trailing, chevron, ariaLabel, className, disabled }: RowProps) {
  const tappable = Boolean(href || onClick) && !disabled;
  const body = (
    <>
      {leading && <span className="grid shrink-0 place-items-center text-muted-foreground">{leading}</span>}
      <span className="grid min-w-0 flex-1 gap-0.5 py-0.5">
        <span className="text-[17px] leading-snug text-foreground">{title}</span>
        {subtitle && <span className="text-[14px] leading-snug text-muted-foreground">{subtitle}</span>}
      </span>
      {value !== undefined && value !== null && <span className="shrink-0 text-[17px] text-muted-foreground tabular-nums">{value}</span>}
      {trailing}
      {tappable && chevron !== false && <ChevronRight className="-mr-1 size-[18px] shrink-0 text-faint" aria-hidden />}
    </>
  );
  const cls = cn("flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left", tappable && "transition-colors active:bg-accent", className);
  if (href && !disabled) {
    return (
      <Link href={href} aria-label={ariaLabel} className={cls}>
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-label={ariaLabel} disabled={disabled} className={cn(cls, "disabled:cursor-default")}>
        {body}
      </button>
    );
  }
  return <div className={cls}>{body}</div>;
}

/** A small progress ring: fills as things get done, turns "kept" when complete. */
export function Ring({ value, size = 28, label }: { value: number; size?: number; label?: string }) {
  const v = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const stroke = 3;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const done = v >= 1;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} className="shrink-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-foreground/10" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - v)}
        className={cn("transition-[stroke-dashoffset] duration-500 ease-out", done ? "text-kept" : "text-foreground")}
      />
    </svg>
  );
}

/** The one filled button on a screen. */
export function PrimaryButton({ children, onClick, disabled, className, type = "button" }: { children: ReactNode; onClick?: () => void; disabled?: boolean; className?: string; type?: "button" | "submit" }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-[52px] items-center justify-center gap-2 rounded-full bg-primary px-6 text-[17px] font-medium text-primary-foreground transition-transform active:scale-[0.98] disabled:opacity-60",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** A quiet text action: underlined on hover, 44 points tall. */
export function TextAction({ children, onClick, href, className }: { children: ReactNode; onClick?: () => void; href?: string; className?: string }) {
  const cls = cn("inline-flex min-h-11 items-center gap-1.5 text-[15px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline", className);
  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {children}
    </button>
  );
}
