import type { Metadata } from "next";
import { og } from "@/lib/seo";
import Link from "next/link";
import { site, prices, smsHref, telHref } from "@/lib/site";
import { formatPrice, type Faq as FaqItem } from "@/lib/services";
import { LoopVideo } from "@/components/site/loop-video";
import { Picture } from "@/components/site/picture";
import { Faq } from "@/components/site/faq";
import { LinkButton, pill, buttonVariants } from "@/components/site/link-button";
import { QuoteCta } from "@/components/site/quote-cta";
import { CtaBand } from "@/components/site/cta-band";
import { Breadcrumbs } from "@/components/site/breadcrumbs";

export const metadata: Metadata = {
  title: "Maintenance Plans Canberra from $90",
  description:
    "Monthly car maintenance in Canberra. Exterior from $90 a month, inside and out from $150. A coating-safe hand wash at your place, monthly or fortnightly.",
  alternates: { canonical: "/maintenance/" }, openGraph: og("/maintenance/"),
};

// The three plans, cheapest first. The middle one is the one we recommend, so it
// carries the accent border, the glow and the filled button (and leads on a phone).
type Plan = {
  every: string;
  who: string;
  /** A monthly from-price, or null when it's quoted per car. */
  price: number | null;
  note: string;
  featured?: boolean;
  /** The words on the card's button. */
  cta: string;
  sms: string;
};

// TODO(pat): "Get it quoted" and "Text us the car" are new button labels for the
// redesign. Confirm them. On a laptop, where an sms: link does nothing, every
// card's button goes to the quote form instead, so "Text us the car" reads
// "Get it quoted" there.
const plans: Plan[] = [
  {
    every: "Exterior, monthly",
    who: "The outside kept the way we left it. The cheapest way onto a schedule, and enough for a car that lives in a garage and carries nobody but you.",
    price: prices.maintenanceExterior,
    note: "Quoted for your car",
    cta: "Get it quoted",
    sms: "Hi Imperium, I'd like a quote for the monthly exterior maintenance plan.\nCar: \nSuburb: ",
  },
  {
    every: "Inside and out, monthly",
    who: "The exterior visit plus the interior reset. Most cars that carry people every day sit here, and it is the rhythm we recommend for coated cars.",
    price: prices.maintenanceMonthly,
    note: "Quoted for your car",
    featured: true,
    cta: "Get it quoted",
    sms: "Hi Imperium, I'd like a quote for the monthly inside and out maintenance plan.\nCar: \nSuburb: ",
  },
  {
    every: "Every 2 weeks",
    who: "Daily drivers that live on the street, dark colours that show every mark, cars that carry kids or dogs. It never looks washed. It looks detailed.",
    price: null,
    note: "Quote on request",
    cta: "Text us the car",
    sms: "Hi Imperium, I'd like a quote for a fortnightly maintenance plan.\nCar: \nSuburb: ",
  },
];

// Laptops go to the quote form with the plan already picked; phones get a text.
const formHref = `/book/?service=${encodeURIComponent("Regular maintenance plan")}`;

// Split so the two prices mean something: the first list is the $90 visit, the
// second is what the extra $60 buys.
const outside = [
  "Pre-rinse and snow foam, so grit lifts off before anything touches the paint",
  "Two-bucket, pH-neutral hand wash with clean mitts, never a brush",
  "Wheels, tyres and arches cleaned, tyres dressed",
  "Door jambs and exterior glass",
  "Bonded contamination checked and spot-treated",
  "Protection topped up: a coating booster on coated cars, a sealant on the rest",
  "A quick note on anything we notice: stone chips, swirl marks, coating health",
];

const inside = [
  "Interior vacuum, front and back",
  "Dash, console and door cards wiped down",
  "Interior glass",
];

const faq: FaqItem[] = [
  {
    q: "Does the car need a full detail first?",
    a: "Usually, unless we've detailed it in the last few months. A plan keeps a finish; it doesn't chase one. We start with a full detail so every visit after that is maintenance, not recovery.",
  },
  {
    q: "How is it priced?",
    a: "The exterior plan starts at $90 a month and inside and out starts at $150, quoted for your car from its size, colour and how it's used. Fortnightly visits are quoted on request. It's the same number every month, and the number you're quoted is the number you pay.",
  },
  {
    q: "What's the difference between the $90 plan and the $150 one?",
    a: "The $90 plan is the outside: snow foam, a two-bucket hand wash, wheels and arches, glass, and the protection topped up. The $150 plan is that visit plus the interior reset, so the vacuum, the dash, console and door cards, and the inside of the glass. Both are the same two people, the same month, at your place.",
  },
  {
    q: "Do I need to be home?",
    a: "No. As long as we can reach a tap, a power point and the car, we can do the visit while you're at work and text you when it's done.",
  },
  {
    q: "Is it only for ceramic-coated cars?",
    a: "No. Coated cars get the most out of it, because the coating gets washed the way the warranty asks and topped up as it needs. But any car we've detailed can go on a plan.",
  },
  {
    q: "Can I change how often you come?",
    a: "Yes. Start monthly and move to fortnightly as the seasons change, or the other way. Winter grit and spring pollen usually call for closer visits.",
  },
];

export default function MaintenancePage() {
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
  const sms = smsHref("Hi Imperium, I'd like a quote for a maintenance plan.\nCar: \nSuburb: \nHow often: ");

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />

      {/* Hero. Laptops: the words on the left, the photo in a glow panel on the
          right. Phones: the headline, one line, the two monthly prices, then the
          photo; the phone bar is the call to action, so no buttons here.
          Below 1400px wide the photo reaches the chat bubble's corner, so on a
          laptop there it sits at the top of the row and is no taller than the
          screen allows: it ends 100px above the bottom of the first screen
          (72px header + 48px top padding + 100px, plus 8px to spare = 228px). */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-40 top-0 -z-10 hidden size-[860px] bg-[radial-gradient(closest-side,rgba(31,111,196,0.26),rgba(15,61,110,0.1),rgba(5,6,8,0)_70%)] md:block"
        />
        <div className="container-x mx-auto grid max-w-6xl gap-5 pb-10 pt-5 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:items-center md:gap-x-12 md:pb-28 md:pt-12 lg:gap-x-24">
          <div>
            <Breadcrumbs items={[{ href: "/services/", label: "Services" }, { href: "/maintenance/", label: "Maintenance plans" }]} />
            <h1 className="display-caps mt-5 text-[clamp(3.875rem,8.4vw,7.5rem)] md:mt-10">Detailed once. Kept that way.</h1>
            <p className="m-0 mt-4 max-w-[58ch] text-base text-secondary-foreground md:mt-8 md:text-[19px]">
              A maintenance plan is us coming back on a schedule: a proper hand wash, the interior reset, the protection topped up. The car never slides back to needing a full detail, and a coated car gets the life it was promised.
            </p>
            <p className="m-0 mt-4 hidden max-w-[60ch] text-base text-muted-foreground md:block">
              {"For daily drivers that live outside, dark cars that show every wash mark, family cars, and anyone who'd rather spend Saturday morning on something other than a bucket."}
            </p>

            {/* Phones only: the two monthly prices, where a laptop has the buttons. */}
            <ul className="m-0 mt-[18px] grid list-none grid-cols-2 border-y border-border p-0 md:hidden">
              {[
                { label: "Exterior, monthly", price: prices.maintenanceExterior },
                { label: "Inside and out", price: prices.maintenanceMonthly },
              ].map((c, i) => (
                <li key={c.label} className={`py-3 ${i > 0 ? "border-l border-border pl-3.5" : ""}`}>
                  <span className="block text-xs text-muted-foreground">{c.label}</span>
                  <span className="sr-only">from </span>
                  <span className="display-caps text-[32px] leading-none">{formatPrice(c.price)}</span>
                  <span className="text-xs text-muted-foreground"> a month</span>
                </li>
              ))}
            </ul>

            <div className="mt-9 hidden gap-3 md:flex">
              <QuoteCta sms={sms} formHref={formHref} />
              <LinkButton href={telHref} variant="ghost">
                Call {site.phoneDisplay}
              </LinkButton>
            </div>
            <p className="m-0 mt-4 hidden text-[15px] text-muted-foreground md:block">{site.quotePromise}</p>
          </div>
          <Picture
            name="m4-mitt"
            alt="A wash mitt on the bonnet of a BMW M4 during a maintenance wash"
            sizes="(min-width: 768px) 40vw, 100vw"
            priority
            className="panel-glow h-[250px] w-full rounded-xl object-cover object-[50%_60%] md:h-[600px] md:rounded-[14px] md:object-center lg:max-[1400px]:h-[min(600px,max(360px,calc(100svh-228px)))] lg:max-[1400px]:self-start"
          />
        </div>
      </section>

      <section aria-labelledby="plans-heading" className="section-y border-t border-border">
        <div className="container-x mx-auto max-w-6xl">
          <div className="flex flex-col gap-3.5 md:flex-row md:items-end md:justify-between md:gap-12">
            <h2 id="plans-heading" className="display-caps text-[clamp(3.25rem,6.4vw,5.75rem)]" data-reveal="lines">
              Pick a plan.
            </h2>
            <p className="m-0 max-w-[40ch] text-[15px] text-muted-foreground md:mb-2 md:text-[17px]">
              {"We'll suggest one when we quote. You can change it any time."}
            </p>
          </div>
          <ul className="m-0 mt-6 grid list-none gap-3 p-0 md:mt-14 md:grid-cols-3 md:gap-4">
            {plans.map((r) => (
              <li
                key={r.every}
                className={`flex flex-col rounded-[14px] border bg-card p-6 lg:p-9 ${
                  r.featured
                    ? "order-first border-accent shadow-[0_0_60px_rgba(31,111,196,0.2)] md:order-none md:shadow-[0_30px_80px_rgba(0,0,0,0.6),0_0_100px_rgba(31,111,196,0.22)]"
                    : "border-border"
                }`}
              >
                <h3 className="display-caps m-0 text-[32px] md:text-[clamp(2rem,2.8vw,2.5rem)]">{r.every}</h3>
                <p className="m-0 mt-3.5 md:mt-7">
                  {r.price === null ? (
                    <span className="display-caps text-[56px] leading-none md:text-[clamp(3.5rem,5.6vw,5rem)]">Quoted</span>
                  ) : (
                    <>
                      <span className="text-sm text-muted-foreground md:text-[15px]">from </span>
                      <span className="display-caps text-[56px] leading-none md:text-[clamp(3.5rem,5.6vw,5rem)]">{formatPrice(r.price)}</span>
                      <span className="whitespace-nowrap text-sm text-muted-foreground md:text-[15px]"> a month</span>
                    </>
                  )}
                </p>
                <p className="m-0 mt-3.5 grow text-sm text-secondary-foreground md:mt-6 md:text-[15px]">{r.who}</p>
                <Link href={formHref} className={`mt-7 hidden md:inline-flex ${pill} ${buttonVariants[r.featured ? "primary" : "ghost"]}`}>
                  Get it quoted
                </Link>
                <a href={smsHref(r.sms)} className={`mt-[18px] inline-flex md:hidden ${pill} ${buttonVariants[r.featured ? "primary" : "ghost"]}`}>
                  {r.cta}
                </a>
                <p className="m-0 mt-3 hidden text-center text-[13px] text-muted-foreground md:block">{r.note}</p>
              </li>
            ))}
          </ul>
          <p className="m-0 mt-[18px] text-sm text-secondary-foreground md:mt-7 md:text-base">
            {"Same number every month. The number you're quoted is the number you pay."}
          </p>
        </div>
      </section>

      <section aria-labelledby="covers-heading" className="section-y border-t border-border">
        <div className="container-x mx-auto grid max-w-6xl gap-6 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:gap-12 lg:gap-20">
          <div>
            <h2 id="covers-heading" className="display-caps text-[clamp(3rem,5.6vw,5rem)]" data-reveal="lines">
              What a visit covers
            </h2>
            <div className="mt-5 grid gap-5 md:mt-10 md:grid-cols-2 md:gap-12">
              <div>
                <h3 className="m-0 text-sm font-semibold md:text-[15px]">Every visit, from {formatPrice(prices.maintenanceExterior)} a month</h3>
                <ul className="m-0 mt-2.5 grid list-none p-0 text-sm text-secondary-foreground md:mt-4 md:gap-3 md:text-[15px]">
                  {outside.map((t) => (
                    <li key={t} className="border-t border-border py-2.5 md:pb-0 md:pt-3">
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="m-0 text-sm font-semibold md:text-[15px]">Inside and out adds, from {formatPrice(prices.maintenanceMonthly)} a month</h3>
                <ul className="m-0 mt-2.5 grid list-none border-b border-border p-0 text-sm text-secondary-foreground md:mt-4 md:gap-3 md:border-b-0 md:text-[15px]">
                  {inside.map((t) => (
                    <li key={t} className="border-t border-border py-2.5 md:pb-0 md:pt-3">
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
          <aside className="grid content-start gap-4">
            <div className="rounded-xl border border-border bg-card p-5 md:p-8">
              <h3 className="m-0 text-base font-semibold md:text-lg">Why not a car wash?</h3>
              <p className="m-0 mt-2.5 text-sm text-secondary-foreground md:mt-3 md:text-[15px]">
                Spinning brushes are the fastest way to put swirl marks back into corrected paint, and they void a coating warranty. A plan is the same two people and the same method as the day it was detailed, on your driveway.
              </p>
            </div>
            <div className="rounded-xl border border-border p-5 md:p-8">
              <h3 className="m-0 text-base font-semibold md:text-lg">On the day, we need</h3>
              <ul className="m-0 mt-4 grid list-none gap-2.5 p-0 text-sm text-muted-foreground md:text-[15px]">
                <li>Access to water: an outdoor tap we can hook a hose to.</li>
                <li>Access to power: a standard 240V power point within reach.</li>
                <li>Somewhere to park the car that we can walk around.</li>
              </ul>
            </div>
          </aside>
        </div>
      </section>

      {/* The one clip on the page: LoopVideo plays it only while it is on screen,
          and shows the poster alone for reduced motion. */}
      <section aria-labelledby="visit-heading" className="section-y border-t border-border">
        <div className="container-x mx-auto grid max-w-6xl items-center gap-8 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-12 lg:gap-20">
          <LoopVideo
            base="/media/maintenance-wash-720"
            poster="/media/maintenance-wash-poster.webp"
            label="A monthly maintenance wash on a work ute: snow foam, a hand wash with a mitt, the wheels, then dried by hand"
            className="panel-glow aspect-[4/5] w-full rounded-[14px] bg-card object-cover"
          />
          <div>
            <h2 id="visit-heading" className="display-caps text-[clamp(3rem,5.6vw,5rem)]" data-reveal="lines">
              One visit, start to finish.
            </h2>
            <p className="m-0 mt-5 max-w-[56ch] text-base text-secondary-foreground md:mt-8 md:text-lg">
              Snow foam first so the grit lifts off, then a hand wash with a clean mitt, the wheels and arches, and a hand dry. No brushes touch the
              paint. That is the whole visit, and it looks the same every month.
            </p>
            <p className="m-0 mt-4 max-w-[56ch] text-[15px] text-muted-foreground md:text-base">
              This one is a work ute on a monthly exterior plan. The exterior maintenance plan starts at{" "}
              <b className="font-medium text-foreground">{formatPrice(prices.maintenanceExterior)} a month</b>, quoted for your vehicle.
            </p>
            <div className="mt-8 hidden gap-3 md:flex">
              <QuoteCta sms={sms} formHref={formHref} />
            </div>
          </div>
        </div>
      </section>

      {/* FAQ in a 4/8 split on laptops: the heading on the left, the questions on
          the right. Faq draws its own heading and list; `contents` lets the two
          sit straight in this grid without changing the shared component. */}
      <section className="section-y border-t border-border">
        <div className="container-x mx-auto max-w-6xl">
          <div className="md:grid md:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] md:gap-12 lg:gap-20 [&>div>h2]:text-[clamp(2.75rem,5.6vw,5rem)] [&>div]:contents md:[&>div>div]:mt-0">
            <Faq items={faq} />
          </div>
          <p className="m-0 mt-10 text-[15px] text-muted-foreground md:ml-[calc((100%-3rem)/3+3rem)] lg:ml-[calc((100%-5rem)/3+5rem)]">
            Also see:{" "}
            <Link href="/services/ceramic-coating-canberra/" className="text-foreground underline underline-offset-4">
              Ceramic coating
            </Link>{" "}
            and the{" "}
            <Link href="/warranty/" className="text-foreground underline underline-offset-4">
              coating warranty
            </Link>
            .
          </p>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
