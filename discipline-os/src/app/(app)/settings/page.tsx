import type { Metadata } from "next";
import { signOut } from "@/app/actions/account";
import { SettingsForm } from "@/components/settings/settings-form";
import { ThemeChoice } from "@/components/settings/theme-choice";
import { SectionCard } from "@/components/section-card";
import { getViewer } from "@/lib/data";
import { CATEGORY_LABELS, CATEGORIES, WEIGHTS } from "@/lib/score";

export const metadata: Metadata = { title: "Settings" };

const WHAT_COUNTS: Record<(typeof CATEGORIES)[number], string> = {
  god: "The four Bible checks, plus any God habits.",
  work: "Hours worked against your target, capped at the target.",
  body: "Your body habits.",
  discipline: "Your morning routine and discipline habits.",
  reflection: "How many of the six night-review questions you answered.",
};

export default async function SettingsPage() {
  const viewer = await getViewer();
  const { data } = await viewer.supabase.auth.getUser();

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-10">
      <header className="grid gap-1">
        <h1 className="text-[34px] leading-tight font-medium tracking-tight">Settings</h1>
        {data.user?.email && <p className="text-muted-foreground">Signed in as {data.user.email}</p>}
      </header>

      <SettingsForm profile={viewer.profile} />

      <SectionCard title="Appearance">
        <ThemeChoice />
      </SectionCard>

      <SectionCard title="How the score works" description="Each part scores what you did out of what was active that day. A part with nothing active is left out and its share goes to the others.">
        <dl className="divide-y divide-border/70">
          {CATEGORIES.map((c) => (
            <div key={c} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 py-3">
              <dt className="text-[17px]">{CATEGORY_LABELS[c]}</dt>
              <dd className="text-right text-[17px]">{WEIGHTS[c]}%</dd>
              <dd className="col-span-2 text-sm text-muted-foreground">{WHAT_COUNTS[c]}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-sm text-muted-foreground">
          A day at or above your streak line extends the streak. Complete day locks the score, so changing habits later never rewrites it.
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
