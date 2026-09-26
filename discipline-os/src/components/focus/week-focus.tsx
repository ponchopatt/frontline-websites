"use client";

import { Crosshair } from "lucide-react";
import { useState } from "react";
import { Group, Row } from "@/components/os";
import type { LocalDate } from "@/lib/day";
import { FocusSheet } from "./focus-sheet";

interface WeekFocusProps {
  weekStart: LocalDate;
  /** "Imperium all week", "Imperium Mon–Wed, Websites Thu–Sat", or null. */
  line: string | null;
  /** Time on each business this week so far, in a line. */
  hours: string | null;
  /** How the focus went, once the week has some work in it. */
  footer: string | null;
  /** A week that's over can't be changed. */
  editable: boolean;
}

/** The week's focus on its page: which business gets the deep work, and where the time went. */
export function WeekFocus({ weekStart, line, hours, footer, editable }: WeekFocusProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Group id="focus" title="Focus" footer={footer ?? (editable ? "One business gets the deep work. The other two get a short keep-alive each day." : undefined)}>
        <Row
          onClick={editable ? () => setOpen(true) : undefined}
          leading={<Crosshair className="size-[22px]" />}
          title={line ?? (editable ? "Pick this week's focus" : "No focus that week")}
          subtitle={hours}
        />
      </Group>
      {editable && <FocusSheet open={open} onClose={() => setOpen(false)} weekStart={weekStart} />}
    </>
  );
}
