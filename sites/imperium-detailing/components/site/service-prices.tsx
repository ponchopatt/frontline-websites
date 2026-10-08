import { sizes, tiers, ceramicTiers, jobs, guidePrice, rangeNote, type JobId } from "@/lib/pricing";
import { formatPrice } from "@/lib/services";
import { site } from "@/lib/site";

// Heading scale for the service pages' split sections (heading on the left, the
// content on the right): 48px on a phone to 80px on a laptop, as in the mockup.
export const splitHeading = "display-caps text-[clamp(3rem,5.6vw,5rem)]";

/** A fixed price, a "from" price, or a range (full and interior details). null is quoted. */
type Cell = { price: number; high: number | null; from: boolean } | null;
type Row = { label: string; cells: Cell[] };

const fixed = (price: number): Cell => ({ price, high: null, from: false });

function Money({ c }: { c: Cell }) {
  if (c === null) return <>Quoted</>;
  return (
    <>
      {c.from && <span className="font-sans text-sm normal-case text-muted-foreground">from </span>}
      {formatPrice(c.price)}
      {c.high !== null && `–${formatPrice(c.high)}`}
    </>
  );
}

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
    ? tiers.map((t) => ({ label: `${t}-year warranty`, cells: sizes.map((z) => fixed(ceramicTiers[z.id][t])) }))
    : [
        {
          label: name,
          cells: sizes.map((z) => {
            const g = guidePrice(job, z.id);
            return g.price === null ? null : { price: g.price, high: g.high, from: g.from };
          }),
        },
      ];
  const ranged = rows.some((r) => r.cells.some((c) => c !== null && c.high !== null));

  // TODO(pat): confirm heading. "Three tiers. One method." and the line under
  // it are new copy for the redesign; so is "What it costs." on the other four.
  const title = ceramic ? "Three tiers. One method." : "What it costs.";
  // The other four use the price guide's own line for a hatch or sedan, straight
  // from guidePrice. Full and interior details are a range, so the range note
  // sits under the table, as it does under the price guide.
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
              "7-seater" stays whole), bottom-aligned. */}
          <table className={`hidden w-full border-collapse text-base md:table ${ceramic ? "" : "table-fixed"}`}>
            <caption className="sr-only">
              {ceramic ? `${name} prices by written warranty and vehicle size` : `${name} prices by vehicle size`}
            </caption>
            {!ceramic && (
              <colgroup>
                <col />
                {sizes.map((z) => (
                  <col key={z.id} className={ranged ? "w-[18%]" : "w-[15%]"} />
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
                      className={`pl-4 text-right ${
                        c === null
                          ? "text-base text-muted-foreground"
                          : ranged
                            ? "display-caps whitespace-nowrap text-[clamp(1.25rem,1.75vw,1.625rem)]"
                            : "display-caps text-[clamp(1.75rem,2.5vw,2.25rem)]"
                      }`}
                    >
                      <Money c={c} />
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
                      <dd className={`m-0 text-right ${r.cells[i] === null ? "text-muted-foreground" : "font-semibold"}`}>
                        <Money c={r.cells[i]} />
                      </dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>

          {ranged && <p className="m-0 mt-4 text-[15px] text-foreground md:mt-5">{rangeNote}</p>}
          {job === "correction" && <p className="m-0 mt-4 text-[15px] text-foreground md:mt-5">{jobs.find((j) => j.id === "correction")!.note}</p>}
          {bikeNote && <p className="m-0 mt-4 text-sm text-muted-foreground md:mt-5 md:text-[15px]">{bikeNote}</p>}
          <p className="m-0 mt-2 text-sm text-muted-foreground md:text-[15px]">{site.afterpay}.</p>
        </div>
      </div>
    </section>
  );
}
