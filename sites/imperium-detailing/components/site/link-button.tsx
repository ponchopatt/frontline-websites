import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  href: string;
  children: ReactNode;
  variant?: "primary" | "ghost";
  className?: string;
  external?: boolean;
  newTab?: boolean;
};

/**
 * The site's two buttons, shared so every pill on every page matches: a filled
 * blue one with a soft glow, and a ghost one with a hairline edge. The display
 * rule (inline-flex) is kept out of `pill` so a caller that needs to hide the
 * button at one size (QuoteCta) can set its own without two display utilities
 * fighting on one element.
 */
export const pill =
  "lift min-h-[52px] whitespace-nowrap items-center justify-center rounded-full px-7 text-base font-semibold no-underline";
export const buttonVariants = {
  primary: "cta-glow bg-accent text-accent-foreground hover:bg-[#5aa6f0]",
  ghost: "border border-border-strong bg-transparent text-foreground hover:border-secondary-foreground/60",
};
export const buttonClass = (variant: keyof typeof buttonVariants = "primary") => `inline-flex ${pill} ${buttonVariants[variant]}`;

export function LinkButton({ href, children, variant = "primary", className = "", external, newTab }: Props) {
  const cls = `${buttonClass(variant)} ${className}`;
  if (external || href.startsWith("tel:") || href.startsWith("sms:") || href.startsWith("mailto:") || href.startsWith("http")) {
    return (
      <a href={href} className={cls} target={newTab ? "_blank" : undefined} rel={newTab ? "noopener" : undefined}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}
