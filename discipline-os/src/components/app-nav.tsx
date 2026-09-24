"use client";

import { BookOpen, BriefcaseBusiness, CalendarCheck2, CalendarRange, ListChecks, Mountain, Settings2, Timer } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "Today", icon: CalendarCheck2, wideOnly: false, match: ["/"] },
  { href: "/business", label: "Business", icon: BriefcaseBusiness, wideOnly: false, match: ["/business"] },
  { href: "/week", label: "Week", icon: CalendarRange, wideOnly: false, match: ["/week", "/goals/week"] },
  { href: "/goals", label: "Goals", icon: Mountain, wideOnly: false, match: ["/goals"] },
  { href: "/bible", label: "Bible", icon: BookOpen, wideOnly: false, match: ["/bible"] },
  // On phones these sit in Settings and Today's header, keeping the tab bar to five.
  { href: "/habits", label: "Habits", icon: ListChecks, wideOnly: true, match: ["/habits"] },
  { href: "/work", label: "Work log", icon: Timer, wideOnly: true, match: ["/work"] },
  { href: "/settings", label: "Settings", icon: Settings2, wideOnly: true, match: ["/settings"] },
] as const;

function isActive(pathname: string, match: readonly string[]) {
  if (match[0] === "/") return pathname === "/";
  // The week pages live under /goals/week; they belong to Week, not Goals.
  if (match[0] === "/goals" && pathname.startsWith("/goals/week")) return false;
  return match.some((m) => pathname.startsWith(m));
}

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
      <ul className="mx-auto grid h-16 max-w-xl grid-cols-5 md:h-14 md:max-w-3xl md:grid-cols-8">
        {ITEMS.map(({ href, label, icon: Icon, wideOnly, match }) => {
          const active = isActive(pathname, match);
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
