import { ListChecks, RotateCcw } from "lucide-react";
import type { Metadata } from "next";
import { signOut } from "@/app/actions/account";
import { Group, PageHeader, Row } from "@/components/os";
import { MinimumForm } from "@/components/settings/minimum-form";
import { PasscodeForm } from "@/components/settings/passcode-form";
import { SettingsForm } from "@/components/settings/settings-form";
import { ThemeChoice } from "@/components/settings/theme-choice";
import { getViewer } from "@/lib/data";

export const metadata: Metadata = { title: "Settings" };

const WHAT_COUNTS: Array<[string, string]> = [
  ["Habits", "Every habit due that day: the morning routine, faith, fitness and discipline. Gym only counts on its days."],
  ["Tasks", "Every task planned for the day. A dropped task counts as not kept. Tasks parked for later don't count."],
  ["Night review", "Kept when all four questions are answered."],
  ["Work", "Kept when your work hours are in."],
];

const icon = "size-[22px]";

/** Settings: grouped rows that open a sheet to change them, the passcode, and the look. */
export default async function SettingsPage() {
  const viewer = await getViewer();
  const [{ data }, habitsRes] = await Promise.all([
    viewer.supabase.auth.getUser(),
    viewer.supabase.from("habits").select("id,name,minimum").eq("is_active", true).order("category").order("sort_order"),
  ]);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-7">
      <PageHeader
        back={{ href: "/you", label: "You" }}
        title="Settings"
        subtitle={data.user?.email ? <span className="break-words">Signed in as {data.user.email}</span> : undefined}
      />

      <SettingsForm profile={viewer.profile} />

      <MinimumForm habits={habitsRes.data ?? []} workMinutes={viewer.profile.minimumWorkMinutes} fitness={viewer.profile.minimumFitness} />

      <PasscodeForm passcodeSet={viewer.passcodeSet} />

      <Group id="appearance" title="Appearance" plain>
        <ThemeChoice />
      </Group>

      <Group id="setup" title="Setup">
        <Row href="/welcome" leading={<RotateCcw className={icon} />} title="Redo setup" subtitle="Your goals for the year, why they matter, and your daily and weekly numbers" />
        <Row href="/habits" leading={<ListChecks className={icon} />} title="Habits" subtitle="Add, rename, reorder or hide habits, and set the days each is due" />
      </Group>

      <Group
        id="keep-my-word"
        title="How Keep My Word works"
        footer="A day at or above your streak line extends the streak, and so does a secured minimum day. Close day locks the number, so changing habits later never rewrites it."
      >
        <p className="px-4 py-3.5 text-[15px] leading-snug text-muted-foreground">Of everything you said you&apos;d do today, how much you did.</p>
        {WHAT_COUNTS.map(([label, text]) => (
          <Row key={label} title={label} subtitle={text} />
        ))}
      </Group>

      <Group>
        <form action={signOut}>
          <button type="submit" className="flex min-h-14 w-full items-center justify-center px-4 text-[17px] text-destructive transition-colors active:bg-accent">
            Sign out
          </button>
        </form>
      </Group>
    </div>
  );
}
