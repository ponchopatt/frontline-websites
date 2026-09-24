import type { Metadata } from "next";
import { signOut } from "@/app/actions/account";
import { MinimumForm } from "@/components/settings/minimum-form";
import { SettingsForm } from "@/components/settings/settings-form";
import { ThemeChoice } from "@/components/settings/theme-choice";
import { SectionCard } from "@/components/section-card";
import { getViewer } from "@/lib/data";
import Link from "next/link";

export const metadata: Metadata = { title: "Settings" };

const WHAT_COUNTS: Array<[string, string]> = [
  ["Habits", "Every habit due that day: the morning routine, faith, fitness and discipline. Gym only counts on its days."],
  ["Tasks", "Every task planned for the day. A dropped task counts as not kept. Tasks parked for later don't count."],
  ["Night review", "Kept when all four questions are answered."],
  ["Work", "Kept when your work hours are in."],
];

export default async function SettingsPage() {
  const viewer = await getViewer();
  const [{ data }, habitsRes] = await Promise.all([
    viewer.supabase.auth.getUser(),
    viewer.supabase.from("habits").select("id,name,minimum").eq("is_active", true).order("category").order("sort_order"),
  ]);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-10">
      <header className="grid gap-1">
        <h1 className="text-[34px] leading-tight font-medium tracking-tight">Settings</h1>
        {data.user?.email && <p className="text-muted-foreground">Signed in as {data.user.email}</p>}
      </header>

      <SettingsForm profile={viewer.profile} />

      <MinimumForm habits={habitsRes.data ?? []} workMinutes={viewer.profile.minimumWorkMinutes} fitness={viewer.profile.minimumFitness} />

      <SectionCard title="Appearance">
        <ThemeChoice />
      </SectionCard>

      <SectionCard title="Habits">
        <p className="text-[15px] text-muted-foreground">
          Add, rename, reorder or hide habits, and set which days each one is due.{" "}
          <Link href="/habits" className="text-foreground underline underline-offset-4">
            Edit habits
          </Link>
        </p>
      </SectionCard>

      <SectionCard title="How Keep My Word works" description="Of everything you said you'd do today, how much you did.">
        <dl className="divide-y divide-border/70">
          {WHAT_COUNTS.map(([label, text]) => (
            <div key={label} className="grid gap-0.5 py-3">
              <dt className="text-[17px]">{label}</dt>
              <dd className="text-sm text-muted-foreground">{text}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-sm text-muted-foreground">
          A day at or above your streak line extends the streak, and so does a secured minimum day. Close day locks the number, so changing habits later never rewrites it.
        </p>
      </SectionCard>

      <form action={signOut} className="border-t border-border pt-6">
        <button type="submit" className="h-12 w-full rounded-full border border-input text-[15px] text-muted-foreground hover:text-foreground">
          Sign out
        </button>
      </form>
    </div>
  );
}
