"use client";

import { BookOpen, CircleUserRound, House, Mountain } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/*
  Four places, one job each:
    Today  execute     Goals  direction     Faith  spiritual life     You  reflection and history
  Pages that used to have their own tab live under one of these, and the tab stays lit on them.
*/
const TABS = [
  { href: "/", label: "Today", icon: House, match: ["/"] },
  { href: "/goals", label: "Goals", icon: Mountain, match: ["/goals", "/business", "/week"] },
  { href: "/faith", label: "Faith", icon: BookOpen, match: ["/faith", "/bible"] },
  { href: "/you", label: "You", icon: CircleUserRound, match: ["/you", "/progress", "/habits", "/work", "/settings"] },
] as const;

function isActive(pathname: string, match: readonly string[]) {
  if (match[0] === "/") return pathname === "/";
  return match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
}

/** The id a page portals its one contextual action into (Today's +). */
export const TAB_ACTION_SLOT = "tab-action";

/**
 * A floating glass tab bar within thumb reach. Today adds its + beside it; no other page does.
 */
export function AppNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="pointer-events-none fixed inset-x-0 bottom-0 z-40 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto flex max-w-md items-center gap-2.5 px-4">
        <ul className="nav-glass pointer-events-auto flex h-16 min-w-0 flex-1 items-stretch rounded-full border p-1 shadow-[0_18px_40px_-22px_rgb(0_0_0/0.6)] backdrop-blur-xl">
          {TABS.map(({ href, label, icon: Icon, match }) => {
            const active = isActive(pathname, match);
            return (
              <li key={href} className="flex min-w-0 flex-1">
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[12px] leading-none font-medium transition-colors",
                    active ? "nav-active text-foreground" : "text-foreground/70 hover:text-foreground",
                  )}
                >
                  <Icon className="size-[22px]" strokeWidth={active ? 2.1 : 1.7} aria-hidden />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
        <div id={TAB_ACTION_SLOT} className="pointer-events-auto empty:hidden" />
      </div>
    </nav>
  );
}
