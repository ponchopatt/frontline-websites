"use client";

import { Camera, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { deleteProof, uploadProof } from "@/app/actions/proof";
import { SectionCard } from "@/components/section-card";
import { Sheet } from "@/components/sheet";
import type { LocalDate } from "@/lib/day";
import type { ProofItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAX_SIDE = 1600;

/** Shrinks a phone photo to at most 1600px as a JPEG, so it uploads fast on mobile data. */
async function shrink(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    return blob ?? file;
  } catch {
    return file; // the server checks the type and size
  }
}

interface ProofButtonProps {
  date: LocalDate;
  taskId?: string | null;
  habitId?: string | null;
  label?: string | null;
  disabled?: boolean;
  onUploaded: (proof: ProofItem) => void;
  className?: string;
  children?: React.ReactNode;
}

/** "Add proof": pick or take a photo, and it's saved against the day (and the task or habit). */
export function ProofButton({ date, taskId, habitId, label, disabled, onUploaded, className, children }: ProofButtonProps) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function send(file: File) {
    setBusy(true);
    try {
      const blob = await shrink(file);
      const form = new FormData();
      form.set("file", new File([blob], "proof.jpg", { type: blob.type || file.type }));
      form.set("date", date);
      if (taskId) form.set("taskId", taskId);
      if (habitId) form.set("habitId", habitId);
      if (label) form.set("label", label);
      const res = await uploadProof(form);
      if (!res.ok) toast.error(res.error);
      else {
        onUploaded(res.data);
        toast.success("Proof added.");
      }
    } catch {
      toast.error("The photo didn't upload. Check your connection and try again.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void send(file);
        }}
      />
      <button
        type="button"
        disabled={disabled || busy}
        onClick={() => input.current?.click()}
        className={cn("inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-60", className)}
      >
        <Camera className="size-4" aria-hidden />
        {busy ? "Uploading…" : children ?? "Add proof"}
      </button>
    </>
  );
}

/** The day's proof photos: small, optional, never in the way. */
export function ProofCard({
  date,
  proofs,
  readOnly,
  onAdd,
  onRemove,
}: {
  date: LocalDate;
  proofs: ProofItem[];
  readOnly: boolean;
  onAdd: (p: ProofItem) => void;
  onRemove: (id: string) => void;
}) {
  const [viewing, setViewing] = useState<ProofItem | null>(null);

  async function remove(p: ProofItem) {
    const res = await deleteProof({ id: p.id }).catch(() => ({ ok: false as const, error: "That didn't save. Check your connection and try again." }));
    if (!res.ok) toast.error(res.error);
    else {
      onRemove(p.id);
      setViewing(null);
    }
  }

  return (
    <SectionCard id="proof" title="Proof" meta={proofs.length ? `${proofs.length} today` : undefined}>
      {proofs.length > 0 && (
        <ul className="mb-2 grid grid-cols-3 gap-2">
          {proofs.map((p) => (
            <li key={p.id} className="min-w-0">
              <button
                type="button"
                onClick={() => setViewing(p)}
                aria-label={`Open proof${p.label ? `: ${p.label}` : ""}`}
                className="block aspect-square w-full overflow-hidden rounded-xl border border-border bg-card"
              >
                {p.url ? (
                  // Signed, short-lived URLs from private storage: next/image can't optimise them.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.url} alt="" className="size-full object-cover" loading="lazy" />
                ) : null}
              </button>
              {p.label && <p className="mt-1 truncate text-xs text-muted-foreground">{p.label}</p>}
            </li>
          ))}
        </ul>
      )}
      {!readOnly && <ProofButton date={date} onUploaded={onAdd} />}
      {proofs.length === 0 && readOnly && <p className="text-[15px] text-muted-foreground">No proof for this day.</p>}

      <Sheet open={viewing !== null} onClose={() => setViewing(null)} title={viewing?.label ?? "Proof"}>
        {viewing?.url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={viewing.url} alt={viewing.label ?? "Proof photo"} className="max-h-[65dvh] w-full rounded-xl object-contain" />
        )}
        {viewing && !readOnly && (
          <button
            type="button"
            onClick={() => void remove(viewing)}
            className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <Trash2 className="size-4" aria-hidden />
            Remove photo
          </button>
        )}
      </Sheet>
    </SectionCard>
  );
}
