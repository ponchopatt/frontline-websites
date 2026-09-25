import { sizes, tiers, ceramicTiers, jobs, guidePrice, type JobId } from "@/lib/pricing";
import { formatPrice } from "@/lib/services";

// Heading scale for the service pages' split sections (heading on the left, the
// content on the right): 48px on a phone to 80px on a laptop, as in the mockup.
export const splitHeading = "display-caps text-[clamp(3rem,5.6vw,5rem)]";

type Row = { label: string; cells: (number | null)[] };

const money = (n: number | null) => (n === null ? "Quoted" : formatPrice(n));

/**
 * The price table on a service page, every number from lib/pricing.ts.
 *
 * Ceramic: one row per warranty tier across the four vehicle sizes. Every other
 * service: one row across the four sizes, "Quoted" where the table has no
 * number. Laptops get a real table; on a phone each row becomes a card with the
 * four sizes listed under it (the table is display:none there, so a screen
 * reader meets the prices once).
 */
export function ServicePrices({ slug, name }: { slug: string; name: string }) {
  const job = jobs.find((j) => j.slug === `/services/${slug}/`)?.id as Exclude<JobId, "maintenance"> | undefined;
  if (!job) return null;
  const ceramic = job === "ceramic";

  const rows: Row[] = ceramic
    ? tiers.map((t) => ({ label: `${t}-year warranty`, cells: sizes.map((z) => ceramicTiers[z.id][t]) }))
    : [{ label: name, cells: sizes.map((z) => guidePrice(job, z.id).price) }];

  // TODO(pat): confirm heading. "Three tiers. One method." and the line under
  // it are new copy for the redesign; so is "What it costs." on the other four.
  const title = ceramic ? "Three tiers. One method." : "What it costs.";
  // The other four use the price guide's own line for a hatch or sedan. For the
  // full and interior details that is the condition note (up to $75, agreed
  // before we start), straight from guidePrice.
  const intro = ceramic
    ? "Every tier gets the same prep, polish and coating by the same two people. The warranty length is what changes."
    : guidePrice(job, "sedan").why;
  // Where a bike is quoted, the price guide's reason why (e.g. part of the full detail on a bike).
  const bikeNote = !ceramic && guidePrice(job, "bike").price === null ? guidePrice(job, "bike").why : null;

  return (
    <section aria-labelledby="prices-heading" className="section-y border-t border-border">
      <div className="container-x mx-auto grid max-w-6xl gap-y-6 lg:grid-cols-12 lg:gap-x-20">
        <div className="lg:col-span-4">
          <h2 id="prices-heading" className={splitHeading} data-reveal="lines">
            {title}
          </h2>
          <p className="m-0 mt-3.5 max-w-[46ch] text-[15px] text-muted-foreground md:mt-6 md:text-[17px]">{intro}</p>
        </div>

        <div className="lg:col-span-8">
          {/* The single-row tables (every service but ceramic) have one price per
              column, so with automatic widths each column was only as wide as
              its own header and the four prices sat at uneven gaps. There the
              table is fixed: four equal size columns, the service name gets the
              rest, and a long size header wraps onto a second line (balanced, so
              "8-seater" stays whole), bottom-aligned. */}
          <table className={`hidden w-full border-collapse text-base md:table ${ceramic ? "" : "table-fixed"}`}>
            <caption className="sr-only">
              {ceramic ? `${name} prices by written warranty and vehicle size` : `${name} prices by vehicle size`}
            </caption>
            {!ceramic && (
              <colgroup>
                <col />
                {sizes.map((z) => (
                  <col key={z.id} className="w-[15%]" />
                ))}
              </colgroup>
            )}
            <thead>
              <tr className="text-left text-sm text-muted-foreground">
                <th scope="col" className="pb-4 align-bottom font-medium">
                  {ceramic ? "Written warranty" : "Service"}
                </th>
                {sizes.map((z) => (
                  <th key={z.id} scope="col" className="pb-4 pl-4 text-right align-bottom font-medium text-balance">
                    {z.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-y border-border">
                  <th scope="row" className="display-caps py-6 pr-4 text-left text-[clamp(1.75rem,2.8vw,2.5rem)]">
                    {ceramic ? r.label.replace("-year warranty", " years") : r.label}
                  </th>
                  {r.cells.map((c, i) => (
                    <td
                      key={sizes[i].id}
                      className={`pl-4 text-right ${c === null ? "text-base text-muted-foreground" : "display-caps text-[clamp(1.75rem,2.5vw,2.25rem)]"}`}
                    >
                      {money(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          <ul className="m-0 grid list-none gap-3 p-0 md:hidden">
            {rows.map((r) => (
              <li key={r.label} className="rounded-xl border border-border bg-card p-5">
                <h3 className="display-caps m-0 text-[32px]">{r.label}</h3>
                <dl className="m-0 mt-3.5 grid grid-cols-[1fr_auto] gap-y-2 text-[15px]">
                  {sizes.map((z, i) => (
                    <div key={z.id} className="contents">
                      <dt className="text-muted-foreground">{z.label}</dt>
                      <dd className={`m-0 text-right ${r.cells[i] === null ? "text-muted-foreground" : "font-semibold"}`}>{money(r.cells[i])}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>

          {bikeNote && <p className="m-0 mt-4 text-sm text-muted-foreground md:mt-5 md:text-[15px]">{bikeNote}</p>}
        </div>
      </div>
    </section>
  );
}
