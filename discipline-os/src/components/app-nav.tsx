"use client";

import { BookOpen, CalendarCheck2, Mountain, ListChecks, Settings2, Timer } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "Today", icon: CalendarCheck2, wideOnly: false },
  { href: "/goals", label: "Goals", icon: Mountain, wideOnly: false },
  { href: "/habits", label: "Habits", icon: ListChecks, wideOnly: false },
  { href: "/bible", label: "Bible", icon: BookOpen, wideOnly: false },
  { href: "/work", label: "Work", icon: Timer, wideOnly: false },
  // On phones Settings sits in Today's header, keeping the tab bar to five.
  { href: "/settings", label: "Settings", icon: Settings2, wideOnly: true },
] as const;

/** Bottom tab bar on phones, a quiet top bar on wider screens. */
export function AppNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-md",
        "md:sticky md:top-0 md:bottom-auto md:border-t-0 md:border-b md:pb-0",
      )}
    >
      <ul className="mx-auto grid h-16 max-w-xl grid-cols-5 md:h-14 md:max-w-2xl md:grid-cols-6">
        {ITEMS.map(({ href, label, icon: Icon, wideOnly }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href} className={wideOnly ? "hidden md:block" : undefined}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-1 text-[11px] transition-colors md:flex-row md:gap-2 md:text-sm",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className={cn("size-5 md:size-4", active && "text-primary")} strokeWidth={active ? 2 : 1.6} aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
