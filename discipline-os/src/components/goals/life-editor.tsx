"use client";

import { Eye, EyeOff, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { addLifeArea, saveVision, updateLifeArea } from "@/app/actions/goals";
import { AutosaveField } from "@/components/autosave-field";
import { Group } from "@/components/os";
import type { LifeArea } from "@/lib/goals/model";
import { cn } from "@/lib/utils";

export function LifeEditor({ vision, areas: initial }: { vision: { becoming: string; why: string }; areas: LifeArea[] }) {
  const [areas, setAreas] = useState(initial);
  const [name, setName] = useState("");

  return (
    <>
      <Group title="Who am I becoming?" plain>
        <div className="p-4">
          <AutosaveField
            label="In a few sentences"
            value={vision.becoming}
            multiline
            maxLength={4000}
            placeholder="A disciplined man who keeps his word, knows God, builds valuable businesses, takes care of his body, provides for his family, and uses his resources to serve others."
            inputClassName="min-h-[8rem] text-[17px]"
            onSave={(content) => saveVision({ kind: "becoming", content })}
          />
        </div>
      </Group>

      <Group title="My why" plain>
        <div className="p-4">
          <AutosaveField
            label="Why any of it matters"
            value={vision.why}
            multiline
            maxLength={4000}
            placeholder="The people I love, and the God I answer to."
            inputClassName="min-h-[6rem] text-[17px]"
            onSave={(content) => saveVision({ kind: "why", content })}
          />
        </div>
      </Group>

      <Group title="Areas of life" footer="Every goal belongs to one. Hide the ones that don't apply to you; goals keep their area.">
        {areas.map((a) => (
          <div key={a.id} className="flex min-h-14 items-center gap-2 pr-2 pl-4">
            <input
              aria-label={`Name of ${a.name}`}
              defaultValue={a.name}
              maxLength={40}
              enterKeyHint="done"
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              onBlur={async (e) => {
                const next = e.target.value.trim();
                if (!next || next === a.name) return void (e.target.value = a.name);
                const res = await updateLifeArea({ id: a.id, name: next });
                if (!res.ok) {
                  toast.error(res.error);
                  e.target.value = a.name;
                } else setAreas((list) => list.map((x) => (x.id === a.id ? { ...x, name: next } : x)));
              }}
              className={cn("-ml-1.5 h-11 min-w-0 flex-1 rounded-lg bg-transparent px-1.5 text-[17px] outline-none focus-visible:bg-accent", !a.isActive && "text-muted-foreground")}
            />
            <button
              type="button"
              onClick={async () => {
                const res = await updateLifeArea({ id: a.id, isActive: !a.isActive });
                if (!res.ok) return void toast.error(res.error);
                setAreas((list) => list.map((x) => (x.id === a.id ? { ...x, isActive: !a.isActive } : x)));
              }}
              aria-label={a.isActive ? `Hide ${a.name}` : `Show ${a.name}`}
              className="grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              {a.isActive ? <Eye className="size-5" aria-hidden /> : <EyeOff className="size-5" aria-hidden />}
            </button>
          </div>
        ))}
        <form
          className="flex min-h-14 items-center gap-3 pr-2 pl-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name.trim()) return;
            const res = await addLifeArea({ name });
            if (!res.ok) return void toast.error(res.error);
            setAreas((list) => [...list, { ...res.data, key: null, isActive: true }]);
            setName("");
          }}
        >
          <Plus className="size-[22px] shrink-0 text-muted-foreground" aria-hidden />
          <label className="sr-only" htmlFor="new-area">
            New area
          </label>
          <input
            id="new-area"
            value={name}
            maxLength={40}
            enterKeyHint="done"
            onChange={(e) => setName(e.target.value)}
            placeholder="Add an area"
            className="h-11 min-w-0 flex-1 bg-transparent text-[17px] outline-none placeholder:text-muted-foreground"
          />
          {name.trim() && (
            <button type="submit" className="h-11 shrink-0 rounded-full px-3 text-[15px] font-medium text-foreground hover:bg-accent">
              Add
            </button>
          )}
        </form>
      </Group>
    </>
  );
}
