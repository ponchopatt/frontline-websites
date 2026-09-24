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

/** Three plain links, one per business. The page reads ?tab= and shows that one. */
export function BusinessTabs({ active }: { active: BusinessTab }) {
  return (
    <nav aria-label="Businesses" className="grid grid-cols-3 gap-1 rounded-full border border-border p-1">
      {BUSINESS_TABS.map((t) => {
        const on = t.key === active;
        return (
          <Link
            key={t.key}
            href={`/business?tab=${t.key}`}
            aria-current={on ? "page" : undefined}
            className={cn(
              "flex h-11 min-w-0 items-center justify-center rounded-full px-2 text-[15px] whitespace-nowrap transition-colors",
              on ? "bg-lamp-soft font-medium text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
