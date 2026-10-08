import { prices } from "./site";
import { formatPrice } from "./services";

export type SizeId = "sedan" | "suv" | "large" | "bike";
export type JobId = "full" | "exterior" | "interior" | "correction" | "ceramic" | "maintenance";
export type Tier = 3 | 5 | 7;

export const sizes: { id: SizeId; label: string; eg: string }[] = [
  { id: "sedan", label: "Hatch or sedan", eg: "Corolla, Model 3, 3 Series" },
  { id: "suv", label: "SUV or ute", eg: "RAV4, Model Y, Ranger" },
  { id: "large", label: "4WD, van or 7-seater", eg: "LandCruiser, Patrol, Carnival" },
  { id: "bike", label: "Motorbike", eg: "Any make, any size" },
];

// Same order as the services everywhere else on the site.
export const jobs: { id: JobId; label: string; slug: string; note: string }[] = [
  { id: "ceramic", label: "Ceramic coating", slug: "/services/ceramic-coating-canberra/", note: "Decontamination, a single-stage polish, then the coating. Around 5 hours on site; leave the car undercover for 24 hours after." },
  { id: "correction", label: "Paint correction", slug: "/services/paint-correction-canberra/", note: "Single-stage machine correction for swirl marks and haze. Deep scratches need a multi-stage job, quoted from photos." },
  { id: "full", label: "Full detail", slug: "/services/full-car-detail-canberra/", note: "Inside and out in one visit: decontamination wash, sealant, steam, extraction, leather and trim. About 3 hours for a sedan." },
  { id: "interior", label: "Interior detail", slug: "/services/interior-car-detailing-canberra/", note: "Vacuum, steam, hot-water extraction, leather and trim conditioned. About 1.5 hours for a tidy interior." },
  { id: "exterior", label: "Exterior detail", slug: "/services/exterior-car-detailing-canberra/", note: "Two-bucket hand wash, chemical decontamination, spray sealant, wheels, tyres and glass. About an hour." },
  { id: "maintenance", label: "Maintenance plan", slug: "/maintenance/", note: `A visit on a schedule, at your place. Exterior only from ${formatPrice(prices.maintenanceExterior)} a month; inside and out from ${formatPrice(prices.maintenanceMonthly)}. Fortnightly visits are quoted on request.` },
];

/** A fixed price, or a range where the car's condition on the day sets the final number. */
export type Price = number | { low: number; high: number };

// Real prices by vehicle size, in AUD. null means it's quoted for the vehicle.
// The sedan column reads lib/site.ts, which holds each service's "from" price.
const table: Record<Exclude<JobId, "ceramic">, Record<SizeId, Price | null>> = {
  full: { sedan: { low: prices.full, high: 300 }, suv: { low: 280, high: 350 }, large: { low: 320, high: 400 }, bike: 150 },
  exterior: { sedan: prices.exterior, suv: 140, large: 160, bike: null },
  interior: { sedan: { low: prices.interior, high: 220 }, suv: { low: 190, high: 250 }, large: { low: 220, high: 280 }, bike: null },
  // Single stage. These are floors: deeper scratches are quoted from photos.
  correction: { sedan: prices.correction, suv: 597, large: 697, bike: null },
  // The exterior-only plan, the entry point to a schedule. Inside and out is
  // prices.maintenanceMonthly, set out on /maintenance/.
  maintenance: { sedan: prices.maintenanceExterior, suv: null, large: null, bike: null },
};

// Ceramic tiers by warranty length. Bike coatings skip the correction stage.
export const ceramicTiers: Record<SizeId, Record<Tier, number>> = {
  sedan: { 3: prices.ceramic, 5: 1197, 7: 1397 },
  suv: { 3: 1097, 5: 1297, 7: 1497 },
  large: { 3: 1197, 5: 1397, 7: 1697 },
  bike: { 3: 245, 5: 325, 7: 400 },
};
export const tiers: Tier[] = [3, 5, 7];

/** Shown under every full and interior detail range. */
export const rangeNote = "Where your car lands in the range depends on its condition. We confirm the price before we start, never after.";

export type Guide = {
  /** The fixed price, or the low end of a range. null means it's quoted for the vehicle. */
  price: number | null;
  /** The top of the range for full and interior details; null when the price is fixed. */
  high: number | null;
  /** A floor rather than the price, shown as "from $X". */
  from: boolean;
  suffix: string;
  why: string;
  cta: string;
};

const quoted = (why: string): Guide => ({ price: null, high: null, from: false, suffix: "", why, cta: "Get it quoted by text" });

export function guidePrice(job: JobId, size: SizeId, tier: Tier = 3): Guide {
  const lock = "Lock it in by text";
  if (job === "ceramic") {
    const p = ceramicTiers[size][tier];
    return size === "bike"
      ? { price: p, high: null, from: false, suffix: "", why: `${tier}-year written warranty on the tank and panels. No correction stage on a bike.`, cta: lock }
      : { price: p, high: null, from: false, suffix: "", why: `${tier}-year written warranty. Prep, polish and coating by the same two people.`, cta: lock };
  }
  if (size === "bike" && job !== "full") {
    return quoted(`On a bike, this is part of the full detail at ${guideText(guidePrice("full", "bike"))}. Text us the bike and we'll sort the rest.`);
  }
  const p = table[job][size];
  if (p === null) {
    return job === "maintenance"
      ? quoted("Monthly plans for larger vehicles are quoted for the vehicle. Text us the model and how it's used.")
      : quoted("Text us the vehicle and we'll quote it the same day.");
  }
  const low = typeof p === "number" ? p : p.low;
  const high = typeof p === "number" ? null : p.high;
  if (job === "maintenance") {
    return {
      price: low,
      high,
      from: true,
      suffix: " a month",
      why: `Exterior only: wash, wheels, glass, protection topped up. Inside and out is ${formatPrice(prices.maintenanceMonthly)} a month. Same number every month.`,
      cta: lock,
    };
  }
  if (job === "correction") {
    return { price: low, high, from: true, suffix: "", why: "Single-stage correction, then a sealant. Coating it afterwards is the most common package we do.", cta: lock };
  }
  return {
    price: low,
    high,
    from: false,
    suffix: "",
    why:
      high === null
        ? "Mobile anywhere in Canberra and Queanbeyan, no call-out fee. The number you're quoted is the number you pay."
        : "Mobile anywhere in Canberra and Queanbeyan, no call-out fee.",
    cta: lock,
  };
}

/** A guide price as words: a range ("$low–$high"), "from $N", a fixed "$N", "from $N a month", or "quoted". */
export function guideText(g: Guide): string {
  if (g.price === null) return "quoted";
  const n = g.high === null ? formatPrice(g.price) : `${formatPrice(g.price)}–${formatPrice(g.high)}`;
  return `${g.from ? "from " : ""}${n}${g.suffix}`;
}
