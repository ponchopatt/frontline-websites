import Link from "next/link";
import { cn } from "@/lib/utils";

export const BUSINESS_TABS = [
  { key: "imperium", label: "Imperium" },
  { key: "websites", label: "Websites" },
  { key: "bot", label: "AI Bot" },
] as const;

export type BusinessTab = (typeof BUSINESS_TABS)[number]["key"];

export function isBusinessTab(value: unknown): value is BusinessTab {
  return BUSINESS_TABS.some((t) => t.key === value);
}

/**
 * A segmented control, after iOS: three links in one quiet track, the chosen one raised. The
 * page reads ?tab= and shows that business.
 */
export function BusinessTabs({ active }: { active: BusinessTab }) {
  return (
    <nav aria-label="Businesses" className="grid grid-cols-3 gap-0.5 rounded-full bg-accent p-[3px]">
      {BUSINESS_TABS.map((t) => {
        const on = t.key === active;
        return (
          <Link
            key={t.key}
            href={`/business?tab=${t.key}`}
            aria-current={on ? "page" : undefined}
            className={cn(
              "flex h-11 min-w-0 items-center justify-center rounded-full px-2 text-[15px] whitespace-nowrap transition-[background-color,color,box-shadow] duration-200",
              on
                ? "surface-light bg-popover font-medium text-foreground shadow-[0_1px_2px_rgb(0_0_0/0.1),0_6px_16px_-8px_rgb(0_0_0/0.4)]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
