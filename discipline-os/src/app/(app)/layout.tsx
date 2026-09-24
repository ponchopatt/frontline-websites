import { AppNav } from "@/components/app-nav";
import { GlobalBar } from "@/components/global-bar";
import { isWorkArea } from "@/lib/areas";
import { getViewer } from "@/lib/data";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const viewer = await getViewer();
  const [{ data: open }, { data: ranked }] = await Promise.all([
    viewer.supabase.from("work_sessions").select("id,area,started_at").is("ended_at", null).maybeSingle(),
    viewer.supabase.from("daily_goals").select("rank").eq("local_date", viewer.today).not("rank", "is", null),
  ]);

  return (
    <div className="flex min-h-dvh flex-col md:flex-col-reverse md:justify-end">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <main id="main" className="mx-auto w-full max-w-xl flex-1 px-4 pt-6 pb-44 sm:px-6 md:max-w-2xl md:pt-10 md:pb-28">
        {children}
      </main>
      <GlobalBar
        today={viewer.today}
        running={open ? { id: open.id, area: isWorkArea(open.area) ? open.area : null, startedAt: open.started_at } : null}
        big3Free={(ranked ?? []).length < 3}
      />
      <AppNav />
    </div>
  );
}
