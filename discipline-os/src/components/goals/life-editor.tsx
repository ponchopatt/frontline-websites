"use client";

import { Eye, EyeOff, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { addLifeArea, saveVision, updateLifeArea } from "@/app/actions/goals";
import { AutosaveField } from "@/components/autosave-field";
import { SectionCard } from "@/components/section-card";
import type { LifeArea } from "@/lib/goals/model";
import { cn } from "@/lib/utils";

export function LifeEditor({ vision, areas: initial }: { vision: { becoming: string; why: string }; areas: LifeArea[] }) {
  const [areas, setAreas] = useState(initial);
  const [name, setName] = useState("");

  return (
    <>
      <SectionCard title="Who am I becoming?">
        <AutosaveField
          label="In a few sentences"
          value={vision.becoming}
          multiline
          maxLength={4000}
          placeholder="A disciplined man who keeps his word, knows God, builds valuable businesses, takes care of his body, provides for his family, and uses his resources to serve others."
          inputClassName="min-h-[8rem]"
          onSave={(content) => saveVision({ kind: "becoming", content })}
        />
      </SectionCard>

      <SectionCard title="My why">
        <AutosaveField
          label="Why any of it matters"
          value={vision.why}
          multiline
          maxLength={4000}
          placeholder="The people I love, and the God I answer to."
          inputClassName="min-h-[6rem]"
          onSave={(content) => saveVision({ kind: "why", content })}
        />
      </SectionCard>

      <SectionCard title="Areas of life" description="Every goal belongs to one. Hide the ones that don't apply to you; goals keep their area.">
        <ul className="divide-y divide-border/70">
          {areas.map((a) => (
            <li key={a.id} className="flex min-h-12 items-center gap-2">
              <input
                aria-label={`Name of ${a.name}`}
                defaultValue={a.name}
                maxLength={40}
                onBlur={async (e) => {
                  const next = e.target.value.trim();
                  if (!next || next === a.name) return void (e.target.value = a.name);
                  const res = await updateLifeArea({ id: a.id, name: next });
                  if (!res.ok) {
                    toast.error(res.error);
                    e.target.value = a.name;
                  } else setAreas((list) => list.map((x) => (x.id === a.id ? { ...x, name: next } : x)));
                }}
                className={cn("h-11 min-w-0 flex-1 rounded-md bg-transparent px-1 text-[17px] outline-none focus-visible:bg-accent", !a.isActive && "text-faint")}
              />
              <button
                type="button"
                onClick={async () => {
                  const res = await updateLifeArea({ id: a.id, isActive: !a.isActive });
                  if (!res.ok) return void toast.error(res.error);
                  setAreas((list) => list.map((x) => (x.id === a.id ? { ...x, isActive: !a.isActive } : x)));
                }}
                aria-label={a.isActive ? `Hide ${a.name}` : `Show ${a.name}`}
                className="grid size-11 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                {a.isActive ? <Eye className="size-4" aria-hidden /> : <EyeOff className="size-4" aria-hidden />}
              </button>
            </li>
          ))}
        </ul>
        <form
          className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name.trim()) return;
            const res = await addLifeArea({ name });
            if (!res.ok) return void toast.error(res.error);
            setAreas((list) => [...list, { ...res.data, isActive: true }]);
            setName("");
          }}
        >
          <label className="sr-only" htmlFor="new-area">
            New area
          </label>
          <input
            id="new-area"
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            placeholder="Add an area"
            className="h-12 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-[16px] outline-none placeholder:text-faint focus-visible:border-primary/70"
          />
          <button type="submit" disabled={!name.trim()} className="inline-flex h-12 items-center gap-1.5 rounded-full border border-primary/70 px-4 text-sm font-medium text-primary disabled:opacity-50">
            <Plus className="size-4" aria-hidden /> Add
          </button>
        </form>
      </SectionCard>
    </>
  );
}
