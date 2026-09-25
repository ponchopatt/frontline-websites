import { Counter } from "@/components/site/counter";
import { site } from "@/lib/site";

// The counter animates a number, but site.stats holds display strings like "400+",
// so split each one rather than retyping the figure and letting the two drift.
const num = (s: string) => parseFloat(s);
const tail = (s: string) => s.replace(/^[\d.]+/, "");

// The four numbers a careful owner asks about, big enough to read from across the room.
// 7 years is the longest of the three coating warranties (3, 5 or 7), so the label says top tier.
const stats = [
  { value: num(site.stats.cars), suffix: tail(site.stats.cars), label: "cars detailed in the last year" },
  { value: num(site.stats.rating), decimals: 1, label: "stars across Google reviews" },
  { value: site.stats.reviewCount, label: "reviews, every one from a real customer" },
  { value: site.stats.warrantyYears, suffix: " yr", label: "top-tier written warranty on ceramic coatings" },
];

export function ProofBand() {
  return (
    <section aria-label="Proof" className="relative border-y border-border bg-card/40">
      <div className="container-x mx-auto grid max-w-6xl grid-cols-2 gap-x-5 gap-y-8 py-10 md:grid-cols-4 md:gap-x-6 md:py-16">
        {stats.map((s, i) => (
          <div key={s.label} data-reveal="up" style={{ transitionDelay: `${i * 60}ms` }}>
            <Counter value={s.value} decimals={s.decimals} suffix={s.suffix} className="display-caps block text-[clamp(3.75rem,6.1vw,5.5rem)] leading-none text-foreground" />
            <p className="mt-2 max-w-[18ch] text-sm text-muted-foreground md:mt-3 md:text-[15px]">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
