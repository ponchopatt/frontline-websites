"use client";

import { BookOpen, BriefcaseBusiness, CalendarRange, ChartNoAxesColumn, House, ListChecks, Mountain, Plus, Settings2, Timer } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Sheet } from "@/components/sheet";
import { QuickAdd } from "@/components/today/quick-add";
import type { LocalDate } from "@/lib/day";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "Today", icon: House, wideOnly: false, match: ["/"] },
  { href: "/business", label: "Business", icon: BriefcaseBusiness, wideOnly: false, match: ["/business"] },
  { href: "/week", label: "Week", icon: CalendarRange, wideOnly: false, match: ["/week", "/goals/week"] },
  { href: "/goals", label: "Goals", icon: Mountain, wideOnly: false, match: ["/goals"] },
  { href: "/progress", label: "Progress", icon: ChartNoAxesColumn, wideOnly: false, match: ["/progress"] },
  // On phones these open from Today's "More" button, keeping the bar to five.
  { href: "/habits", label: "Habits", icon: ListChecks, wideOnly: true, match: ["/habits"] },
  { href: "/work", label: "Work log", icon: Timer, wideOnly: true, match: ["/work"] },
  { href: "/bible", label: "Bible", icon: BookOpen, wideOnly: true, match: ["/bible"] },
  { href: "/settings", label: "Settings", icon: Settings2, wideOnly: true, match: ["/settings"] },
] as const;

function isActive(pathname: string, match: readonly string[]) {
  if (match[0] === "/") return pathname === "/";
  // The week pages live under /goals/week; they belong to Week, not Goals.
  if (match[0] === "/goals" && pathname.startsWith("/goals/week")) return false;
  return match.some((m) => pathname.startsWith(m));
}

/**
 * A floating bar within thumb reach: one round button per page (the current one filled), and
 * a separate round + to add a task from anywhere.
 */
export function AppNav({ today, big3Free }: { today: LocalDate; big3Free: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [adding, setAdding] = useState(false);

  return (
    <>
      <nav aria-label="Main" className="pointer-events-none fixed inset-x-0 bottom-0 z-40 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-xl items-center gap-2.5 px-3 sm:px-6 md:max-w-2xl">
          <ul className="pointer-events-auto flex h-[68px] min-w-0 flex-1 items-center justify-between gap-1 nav-glass rounded-full border px-1.5 shadow-[0_18px_40px_-22px_rgb(0_0_0/0.6)] backdrop-blur-xl">
            {ITEMS.map(({ href, label, icon: Icon, wideOnly, match }) => {
              const active = isActive(pathname, match);
              return (
                <li key={href} className={wideOnly ? "hidden md:block" : undefined}>
                  <Link
                    href={href}
                    aria-label={label}
                    title={label}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "grid size-14 place-items-center rounded-full transition-colors",
                      active ? "bg-primary text-primary-foreground shadow-[0_8px_20px_-10px_rgb(0_0_0/0.5)]" : "text-foreground/85 hover:bg-accent",
                    )}
                  >
                    <Icon className="size-[22px]" strokeWidth={active ? 2.1 : 1.7} aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={() => setAdding(true)}
            aria-label="Add a task"
            className="pointer-events-auto grid size-[68px] shrink-0 place-items-center nav-glass rounded-full border text-foreground shadow-[0_18px_40px_-22px_rgb(0_0_0/0.6)] backdrop-blur-xl active:scale-95"
          >
            <Plus className="size-6" aria-hidden />
          </button>
        </div>
      </nav>

      <Sheet open={adding} onClose={() => setAdding(false)} title="Add a task">
        <QuickAdd
          date={today}
          big3Free={big3Free}
          autoFocus
          onAdded={(task) => {
            toast.success(task.localDate ? `Added to ${task.rank ? `Big 3 (#${task.rank})` : "today"}.` : "Saved for later.");
            router.refresh();
          }}
        />
        <p className="mt-3 text-xs text-faint">Type it and press Enter. Add as many as you like.</p>
      </Sheet>
    </>
  );
}
