import type { Metadata } from "next";
import { og } from "@/lib/seo";
import Link from "next/link";
import { notFound } from "next/navigation";
import { areas, getArea } from "@/lib/areas";
import { getService, services, formatPrice } from "@/lib/services";
import { site, prices, smsHref, telHref } from "@/lib/site";
import { LinkButton } from "@/components/site/link-button";
import { QuoteCta } from "@/components/site/quote-cta";
import { Booking } from "@/components/site/booking";
import { Breadcrumbs } from "@/components/site/breadcrumbs";

type Params = { slug: string };

// "Every service, at your door": the five services in the order lib/services.ts
// lists them, then the exterior maintenance plan, which is per month.
const priceCards = [
  ...services.map((s) => ({ name: s.name, href: `/services/${s.slug}/`, price: s.priceFrom, monthly: false })),
  { name: "Maintenance plan", href: "/maintenance/", price: prices.maintenanceExterior, monthly: true },
];

export function generateStaticParams(): Params[] {
  return areas.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const a = getArea(slug);
  if (!a) return {};
  return {
    title: `Mobile Car Detailing ${a.name}`,
    description: `Mobile detailing, ceramic coating and paint correction in ${a.name}: ${a.suburbs.slice(0, 3).join(", ")} and nearby. We come to you, no call-out fee.`,
    alternates: { canonical: `/service-areas/${a.slug}/` }, openGraph: og(`/service-areas/${a.slug}/`),
  };
}

export default async function AreaPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const a = getArea(slug);
  if (!a) notFound();
  const best = getService(a.bestForSlug);
  const sms = smsHref();

  return (
    <>
      {/* Hero. Laptops: the words on the left; the suburbs and the most-booked
          service in two cards on the right. Phones: the headline and the blurb,
          then the two cards, then the local intro under a hairline. The phone
          bar is the call to action there, so the buttons are laptop-only. */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-[200px] -top-[100px] -z-10 hidden size-[860px] bg-[radial-gradient(closest-side,rgba(31,111,196,0.22),rgba(15,61,110,0.08),rgba(5,6,8,0)_70%)] md:block"
        />
        <div className="container-x mx-auto grid max-w-6xl pb-10 pt-5 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:grid-rows-[auto_1fr] md:gap-x-12 md:pb-28 md:pt-12 lg:gap-x-24">
          <div className="md:col-start-1 md:row-start-1">
            <Breadcrumbs items={[{ href: "/service-areas/", label: "Areas we serve" }, { href: `/service-areas/${a.slug}/`, label: a.name }]} />
            <h1 className="display-caps mt-5 text-[clamp(3.75rem,7.8vw,7rem)] md:mt-10">Mobile car detailing in {a.name}.</h1>
            <p className="m-0 mt-4 max-w-[56ch] text-base text-secondary-foreground md:mt-8 md:text-[19px]">{a.blurb}</p>
          </div>

          <aside className="mt-5 grid content-start gap-5 md:col-start-2 md:row-span-2 md:row-start-1 md:mt-0 md:gap-4 md:pt-14">
            {best && (
              <Link
                href={`/services/${best.slug}/`}
                className="order-first flex items-center justify-between gap-4 rounded-xl border border-accent px-5 py-[18px] text-foreground no-underline shadow-[0_0_60px_rgba(31,111,196,0.18)] hover:bg-card md:order-last md:rounded-[14px] md:px-8 md:py-7 md:shadow-[0_0_80px_rgba(31,111,196,0.18)]"
              >
                <span>
                  <span className="block text-xs text-muted-foreground md:text-sm">Most booked in {a.name}</span>
                  <span className="display-caps mt-1 block text-[28px] md:mt-1.5 md:text-[40px]">{best.name}</span>
                </span>
                <span className="shrink-0 text-[13px] md:text-[15px]">
                  from <span className="display-caps text-4xl leading-none md:text-5xl">{formatPrice(best.priceFrom)}</span>
                </span>
              </Link>
            )}
            <div className="rounded-xl border border-border bg-card px-5 py-[18px] md:rounded-[14px] md:p-8">
              <h2 className="m-0 text-[15px] font-semibold md:text-lg">Suburbs we cover in {a.name}</h2>
              {/* One comma-separated line on a phone; a two-column list with hairlines
                  on a laptop, three for Belconnen's 25 so the most-booked card
                  still sits in the first screen. */}
              <ul
                className={`m-0 mt-2 list-none p-0 text-sm text-secondary-foreground md:mt-5 md:grid md:grid-cols-2 md:gap-x-6 md:text-[15px] ${
                  a.suburbs.length > 18 ? "lg:grid-cols-3" : ""
                }`}
              >
                {a.suburbs.map((sub) => (
                  <li key={sub} className="inline after:content-[',_'] last:after:content-none md:block md:border-t md:border-border md:py-[9px] md:after:content-none">
                    {sub}
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          <div className="mt-10 border-t border-border pt-10 max-md:-mx-[clamp(1.25rem,4vw,3.5rem)] max-md:px-[clamp(1.25rem,4vw,3.5rem)] md:col-start-1 md:row-start-2 md:mt-0 md:border-t-0 md:pt-0">
            {a.intro.map((t, i) => (
              <p key={i} className="m-0 mt-4 max-w-[64ch] text-[15px] text-muted-foreground first:mt-0 md:text-base md:first:mt-4">
                {t}
              </p>
            ))}
            <div className="mt-9 hidden gap-3 md:flex">
              <QuoteCta sms={sms} />
              <LinkButton href={telHref} variant="ghost">
                Call {site.phoneDisplay}
              </LinkButton>
            </div>
            <p className="m-0 mt-4 hidden text-[15px] text-muted-foreground md:block">{site.quotePromise}</p>
          </div>
        </div>
      </section>

      {/* The substance of the page. Nine near-identical pages is how a set of
          location pages gets ignored, and this is what makes each its own. Each
          section: the heading on the left, its paragraphs on the right. */}
      <section aria-label={`Detailing in ${a.name}`} className="section-y border-t border-border">
        <div className="container-x mx-auto grid max-w-6xl gap-12 md:gap-20">
          {a.sections.map((sec, i) => (
            <article
              key={sec.h}
              className={`grid gap-3.5 md:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] md:gap-12 lg:gap-20 ${i > 0 ? "border-t border-border pt-10 md:pt-20" : ""}`}
            >
              <h2 className="display-caps text-[clamp(2.5rem,4.5vw,4rem)]" data-reveal="lines">
                {sec.h}
              </h2>
              <div className="grid max-w-[66ch] content-start gap-3 text-[15px] text-secondary-foreground md:gap-[18px] md:text-[17px]">
                {sec.p.map((t, j) => (
                  <p key={j} className="m-0">
                    {t}
                  </p>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* The five services and the maintenance plan, each a small card with its
          from-price. Every number comes from lib/services.ts and lib/site.ts. */}
      <section aria-labelledby="every-service" className="border-t border-border bg-card/40 py-14 md:py-24">
        <div className="container-x mx-auto max-w-6xl">
          <h2 id="every-service" className="display-caps text-[clamp(2.5rem,4.5vw,4rem)]" data-reveal="lines">
            Every service, at your door
          </h2>
          <ul className="m-0 mt-5 grid list-none grid-cols-2 gap-2 p-0 md:mt-10 md:grid-cols-3 md:gap-3 lg:grid-cols-6">
            {priceCards.map((c) => (
              <li key={c.href}>
                <Link
                  href={c.href}
                  className="block h-full rounded-[10px] border border-border bg-card p-4 text-foreground no-underline transition-colors hover:border-secondary-foreground/40 motion-reduce:transition-none md:rounded-xl md:p-6"
                >
                  <span className="block text-[13px] text-muted-foreground md:text-sm">{c.name}</span>
                  <span className="display-caps mt-1.5 block text-[32px] md:mt-2.5 md:text-[40px]">
                    <span className="sr-only">from </span>
                    {formatPrice(c.price)}
                    {c.monthly && (
                      <span className="text-base md:text-xl">
                        {" "}
                        <span aria-hidden="true">/mo</span>
                        <span className="sr-only">a month</span>
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="m-0 mt-3.5 text-[13px] text-muted-foreground md:mt-5 md:text-sm">
            From-prices for a hatch or sedan. No call-out fee in {a.name}.
          </p>
        </div>
      </section>

      {/* The form opens on the district's most-booked service; a ?service= link still wins. */}
      <Booking title={`Book a detail in ${a.name}.`} defaultService={best?.name} />
    </>
  );
}
