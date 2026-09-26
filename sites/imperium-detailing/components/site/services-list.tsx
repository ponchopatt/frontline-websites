import Link from "next/link";
import { services, formatPrice } from "@/lib/services";
import { prices } from "@/lib/site";
import { LoopVideo } from "@/components/site/loop-video";

// Most expensive first, the order someone weighing up the work reads in.
const order = [
  "ceramic-coating-canberra",
  "paint-correction-canberra",
  "full-car-detail-canberra",
  "interior-car-detailing-canberra",
  "exterior-car-detailing-canberra",
];
const rows = order.map((slug) => services.find((s) => s.slug === slug)!).filter(Boolean);

// "About 3 hours for a sedan; longer for SUVs, utes and 4WDs." -> "About 3 hours for a sedan".
// The first clause of the service's own duration, so the column stays one line.
// (A full stop only ends a clause before a space, so "1.5 hours" survives.)
const firstClause = (d: string) => d.split(/[;,]|\.(?:\s|$)/)[0].trim();

const arrow = (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

// The five services as one list, one row each, every row a link to its page.
// It replaced the 3D carousel on the home page: a list can be scanned at a
// glance and tabbed through in order, which a carousel can't.
//
// Each thumbnail is the service's own clip. LoopVideo keeps them all on their
// poster until they are on screen, and only the two most visible play at once.
export function ServicesList() {
  return (
    <section id="services" aria-labelledby="services-heading" className="section-y">
      <div className="container-x mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-12">
          <h2 id="services-heading" className="display-caps max-w-[820px] text-[clamp(3.375rem,6.4vw,5.75rem)]" data-reveal="lines">
            What we do, and what it costs.
          </h2>
          {/* Every service page has its price table by vehicle size. */}
          <p className="m-0 max-w-[34ch] text-[15px] text-muted-foreground md:mb-2 md:text-lg">
            Prices are for a hatch or sedan.<span className="hidden md:inline"> Bigger cars are listed on each page.</span>
          </p>
        </div>

        <ul className="m-0 mt-7 list-none border-t border-border p-0 md:mt-14">
          {rows.map((s) => (
            <li key={s.slug} className="border-b border-border">
              <Link
                href={`/services/${s.slug}/`}
                className="group grid grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-3.5 py-4 text-foreground no-underline md:grid-cols-[96px_minmax(0,1fr)_auto_40px] md:gap-8 md:py-6 lg:grid-cols-[96px_minmax(0,1fr)_260px_180px_40px]"
              >
                <div aria-hidden="true" className="relative h-[84px] w-16 overflow-hidden rounded-md bg-card md:h-32 md:w-24 md:rounded-lg">
                  {s.video ? (
                    <LoopVideo base={s.video.base} poster={s.video.poster} label="" className="absolute inset-0 h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0">
                  <h3 className="display-caps m-0 text-[28px] md:text-5xl">{s.name}</h3>
                  <p className="m-0 mt-1 text-[13px] text-muted-foreground md:mt-2 md:text-[15px] md:text-secondary-foreground">{s.line}</p>
                </div>
                <span className="hidden text-[15px] text-muted-foreground lg:block">{firstClause(s.duration)}</span>
                <span className="text-right text-[15px]">
                  <span className="sr-only md:not-sr-only">from </span>
                  <span className="display-caps text-[30px] leading-none md:text-[44px]">{formatPrice(s.priceFrom)}</span>
                </span>
                <span className="hidden text-accent transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none md:block">
                  {arrow}
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <p className="m-0 mt-5 text-[15px] text-secondary-foreground md:mt-7 md:text-base">
          <span className="hidden md:inline">Keep it that way: </span>
          <Link href="/maintenance/" className="text-foreground underline underline-offset-4 hover:text-white">
            <span className="md:hidden">Maintenance plans</span>
            <span className="hidden md:inline">maintenance plans</span> from ${prices.maintenanceExterior} a month
          </Link>
          <span className="hidden md:inline">. Same number every month.</span>
        </p>
      </div>
    </section>
  );
}
