import type { Metadata } from "next";
import { og } from "@/lib/seo";
import Link from "next/link";
import { notFound } from "next/navigation";
import { areas, getArea } from "@/lib/areas";
import { getService, services, formatPrice } from "@/lib/services";
import { site, smsHref, telHref } from "@/lib/site";
import { LinkButton } from "@/components/site/link-button";
import { QuoteCta } from "@/components/site/quote-cta";
import { Booking } from "@/components/site/booking";
import { Breadcrumbs } from "@/components/site/breadcrumbs";

type Params = { slug: string };

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
              <ul className="m-0 mt-2 list-none p-0 text-sm text-secondary-foreground md:mt-5 md:grid md:grid-cols-2 md:gap-x-6 md:text-[15px]">
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

      <section className="container-x mx-auto max-w-6xl py-14 md:py-20">
        {/* The substance of the page. Nine near-identical pages is how a set of
            location pages gets ignored, and this is what makes each its own. */}
        <div className="mt-12 grid gap-x-10 gap-y-10 md:grid-cols-3">
          {a.sections.map((sec) => (
            <section key={sec.h}>
              <h2 className="display-caps text-2xl md:text-[1.75rem]">{sec.h}</h2>
              {sec.p.map((t, i) => (
                <p key={i} className="mt-3 text-[15px] leading-relaxed text-secondary-foreground">
                  {t}
                </p>
              ))}
            </section>
          ))}
        </div>

        <div className="mt-12">
          <h2 className="text-lg font-semibold">Every service, at your door</h2>
          <ul className="mt-3 grid list-none gap-2 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s) => (
              <li key={s.slug}>
                <Link href={`/services/${s.slug}/`} className="flex items-center justify-between rounded-md border border-border px-4 py-3 text-[15px] no-underline hover:bg-card">
                  <span className="text-foreground">{s.name}</span>
                  <span className="text-muted-foreground">from {formatPrice(s.priceFrom)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <Booking title={`Book a detail in ${a.name}.`} />
    </>
  );
}
