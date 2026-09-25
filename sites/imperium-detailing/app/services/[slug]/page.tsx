import type { Metadata } from "next";
import { og } from "@/lib/seo";
import Link from "next/link";
import { notFound } from "next/navigation";
import { services, getService, formatPrice } from "@/lib/services";
import { site, smsHref, telHref, anA } from "@/lib/site";
import { Picture } from "@/components/site/picture";
import { LoopVideo } from "@/components/site/loop-video";
import { BeforeAfter } from "@/components/site/before-after";
import { Faq } from "@/components/site/faq";
import { LinkButton } from "@/components/site/link-button";
import { QuoteCta } from "@/components/site/quote-cta";
import { Booking } from "@/components/site/booking";
import { SectionHeading } from "@/components/site/section-heading";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { ServicePrices } from "@/components/site/service-prices";
import { articles } from "@/lib/articles";

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return services.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const s = getService(slug);
  if (!s) return {};
  return { title: s.title, description: s.description, alternates: { canonical: `/services/${s.slug}/` }, openGraph: og(`/services/${s.slug}/`) };
}

export default async function ServicePage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const s = getService(slug);
  if (!s) notFound();
  const related = s.related.map(getService).filter(Boolean);

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: s.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
  const serviceLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: s.name,
    serviceType: s.name,
    description: s.description,
    url: `${site.url}/services/${s.slug}/`,
    provider: { "@id": `${site.url}/#business` },
    areaServed: "Canberra and Queanbeyan",
    offers: { "@type": "Offer", priceCurrency: "AUD", price: s.priceFrom, priceSpecification: { "@type": "PriceSpecification", minPrice: s.priceFrom, priceCurrency: "AUD" } },
  };
  const reading = {
    "ceramic-coating-canberra": ["dealer-paint-protection-vs-ceramic-coating", "ceramic-coating-vs-paint-correction"],
    "paint-correction-canberra": ["ceramic-coating-vs-paint-correction", "car-detailing-cost-canberra"],
  }[s.slug] ?? ["car-detailing-cost-canberra"];
  const guides = reading.map((slug) => articles.find((a) => a.slug === slug)).filter((a) => a !== undefined);
  const more =
    s.slug === "ceramic-coating-canberra"
      ? [{ href: "/tesla-ev-detailing-canberra/", label: "Tesla and EV detailing" }, { href: "/warranty/", label: "The coating warranty" }]
      : [{ href: "/maintenance/", label: "Maintenance plans" }, { href: "/service-areas/", label: "Where we go" }];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceLd) }} />

      {/* Hero. Laptops: the words on the left, the service's own 9:16 clip in a
          glow panel on the right. Phones: breadcrumb, headline, intro and the
          price strip, then the clip, then who it's for. A phone gets no buttons
          here: the phone bar is the call to action from the first screen.
          The entrance reuses the home hero's CSS (globals.css, "The hero is the
          intro"), so it starts on first paint and leaves nothing hidden. */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-40 top-0 -z-10 hidden size-[860px] bg-[radial-gradient(closest-side,rgba(31,111,196,0.28),rgba(15,61,110,0.1),rgba(5,6,8,0)_70%)] lg:block"
        />
        <div className="container-x mx-auto flex max-w-6xl flex-col pb-14 pt-5 md:pb-24 md:pt-12 lg:grid lg:grid-cols-[minmax(0,1fr)_clamp(300px,27.8vw,400px)] lg:grid-rows-[repeat(5,auto)_1fr] lg:gap-x-24 lg:pb-28">
          <div className="lg:col-start-1 lg:row-start-1">
            <Breadcrumbs items={[{ href: "/services/", label: "Services" }, { href: `/services/${s.slug}/`, label: s.name }]} />
            <h1 className="display-caps mt-5 max-w-[760px] text-[min(13.85vw,3.375rem)] md:mt-10 md:text-[clamp(3.375rem,7.2vw,6.5rem)]">{s.h1}</h1>
            <p className="hero-sub m-0 mt-4 max-w-[58ch] text-base text-secondary-foreground md:mt-8 md:text-[19px]">{s.intro}</p>
          </div>
          <p className="hero-sub order-4 m-0 mt-5 max-w-[60ch] text-[15px] text-muted-foreground md:text-base lg:order-none lg:col-start-1 lg:row-start-2 lg:mt-4">
            {s.forWho}
          </p>
          <div className="hero-strip order-2 mt-[18px] flex max-w-[700px] items-baseline justify-between gap-6 border-y border-border py-3.5 md:mt-9 md:items-center md:justify-start md:gap-10 md:py-5 lg:order-none lg:col-start-1 lg:row-start-3">
            <span className="shrink-0 text-sm md:text-[15px]">
              from <span className="display-caps text-[44px] leading-none md:text-[56px]">{formatPrice(s.priceFrom)}</span>
            </span>
            <span className="max-w-[22ch] text-right text-[13px] text-muted-foreground md:max-w-none md:text-left md:text-[15px]">{s.duration}</span>
          </div>
          <div className="hero-cta order-5 mt-8 hidden gap-3 md:flex lg:order-none lg:col-start-1 lg:row-start-4">
            <QuoteCta sms={smsHref(`Hi Imperium, I'd like a quote for ${anA(s.name.toLowerCase())}.\nCar: \nSuburb: `)} />
            <LinkButton href={telHref} variant="ghost">
              Call {site.phoneDisplay}
            </LinkButton>
          </div>
          <p className="hero-note order-6 m-0 mt-4 hidden text-[15px] text-muted-foreground md:block lg:order-none lg:col-start-1 lg:row-start-5">{site.quotePromise}</p>
          <div className="hero-panel order-3 mt-5 md:mt-10 lg:order-none lg:col-start-2 lg:row-span-6 lg:row-start-1 lg:mt-0">
            {s.video ? (
              <LoopVideo
                base={s.video.base}
                poster={s.video.poster}
                label={s.imageAlt}
                className="panel-glow block h-[300px] w-full rounded-xl bg-card object-cover object-[50%_30%] md:h-[440px] lg:aspect-[9/16] lg:h-auto lg:rounded-[14px] lg:object-center"
                lazyPoster={false}
              />
            ) : (
              <Picture
                name={s.image}
                alt={s.imageAlt}
                sizes="(min-width: 1024px) 400px, 100vw"
                priority
                className="panel-glow block h-[300px] w-full rounded-xl object-cover md:h-[440px] lg:aspect-[9/16] lg:h-auto lg:rounded-[14px]"
              />
            )}
          </div>
        </div>
      </section>

      <ServicePrices slug={s.slug} name={s.name} />

      {s.showcase && (
        <section className="border-t border-border py-16 md:py-24">
          <div className="container-x mx-auto max-w-6xl">
            <SectionHeading title={s.showcase.title} intro={s.showcase.caption} />
          </div>
          <div className="container-x mx-auto max-w-5xl">
            <div className="overflow-hidden rounded-2xl border border-border bg-[#0a0e14]">
              <LoopVideo base={s.showcase.base} poster={s.showcase.poster} label={s.showcase.label} className="block aspect-[1200/456] w-full" webm={false} spin />
            </div>
          </div>
        </section>
      )}

      {s.compare && <BeforeAfter {...s.compare} title="Swirls in. Gloss out." />}

      <section className="border-t border-border">
        <div className="container-x mx-auto grid max-w-6xl gap-12 py-14 md:grid-cols-12 md:py-20">
          <div className="md:col-span-7">
            <h2 className="display-caps text-3xl md:text-5xl">How we do it</h2>
            <div className="mt-6 grid max-w-[64ch] gap-4 text-[17px] text-secondary-foreground">
              {s.why.map((p) => (
                <p key={p.slice(0, 40)} className="m-0">
                  {p}
                </p>
              ))}
            </div>
          </div>
          <aside className="md:col-span-5">
            <div className="rounded-lg border border-border bg-card p-6">
              <h2 className="text-lg font-semibold">Every job, every time</h2>
              <ul className="mt-4 grid list-none gap-2.5 p-0 text-[15px] text-secondary-foreground">
                {s.included.map((i) => (
                  <li key={i} className="flex gap-3">
                    <span aria-hidden="true" className="mt-[.55em] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    {i}
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-4 rounded-lg border border-border p-6">
              <h2 className="text-lg font-semibold">On the day, we need</h2>
              <ul className="mt-4 grid list-none gap-2.5 p-0 text-[15px] text-muted-foreground">
                {s.needs.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </section>

      <section className="border-t border-border">
        <div className="container-x mx-auto max-w-6xl py-14 md:py-20">
          <Faq items={s.faq} />
          <div className="mt-12 grid gap-6 border-t border-border pt-8 md:grid-cols-2">
            <div>
              <h2 className="text-lg font-semibold">Keep reading</h2>
              <ul className="m-0 mt-3 grid list-none gap-2 p-0 text-[15px]">
                {guides.map((g) => (
                  <li key={g.slug}>
                    <Link href={`/learn/${g.slug}/`} className="link-slide text-secondary-foreground no-underline hover:text-foreground">
                      {g.h1}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="text-lg font-semibold">Also useful</h2>
              <ul className="m-0 mt-3 grid list-none gap-2 p-0 text-[15px]">
                {more.map((m) => (
                  <li key={m.href}>
                    <Link href={m.href} className="link-slide text-secondary-foreground no-underline hover:text-foreground">
                      {m.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          {related.length > 0 && (
            <p className="mt-10 text-[15px] text-muted-foreground">
              Also see:{" "}
              {related.map((r, i) => (
                <span key={r!.slug}>
                  <Link href={`/services/${r!.slug}/`} className="text-foreground underline underline-offset-4">
                    {r!.name}
                  </Link>
                  {i < related.length - 1 ? " and " : ""}
                </span>
              ))}
              .
            </p>
          )}
        </div>
      </section>

      <Booking title={`Book ${anA(s.name.toLowerCase())}.`} defaultService={s.name} />
    </>
  );
}
