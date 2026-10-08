import type { Metadata } from "next";
import { og } from "@/lib/seo";
import Link from "next/link";
import { services, formatPrice } from "@/lib/services";
import { prices, site } from "@/lib/site";
import { SectionHeading } from "@/components/site/section-heading";
import { Booking } from "@/components/site/booking";

// Keeps the existing /car-detailing-canberra URL alive for search traffic.
export const metadata: Metadata = {
  title: `Car Detailing Canberra from ${formatPrice(prices.full)}`,
  description: `Mobile car detailing in Canberra: full details from ${formatPrice(prices.full)}, interior from ${formatPrice(prices.interior)}, exterior from ${formatPrice(prices.exterior)}. We come to your driveway or workplace, no call-out fee.`,
  alternates: { canonical: "/car-detailing-canberra/" }, openGraph: og("/car-detailing-canberra/"),
};

export default function CarDetailingCanberraPage() {
  return (
    <>
      <section className="container-x mx-auto max-w-6xl py-14 md:py-20">
        <SectionHeading as="h1" size="xl" title="Car detailing in Canberra." intro="A proper detail is hours of hand work: decontamination, clay, protection, steam and extraction. We do it at your place, and the price you're quoted is the price you pay." />
        <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <li key={s.slug}>
              <Link href={`/services/${s.slug}/`} className="block h-full rounded-lg border border-border bg-card p-5 no-underline hover:border-secondary-foreground/40">
                <h2 className="display-caps text-2xl">{s.name}</h2>
                <p className="mt-2 text-[15px] text-muted-foreground">{s.forWho}</p>
                <p className="mt-3 text-[15px] text-foreground">From {formatPrice(s.priceFrom)}</p>
                <p className="mt-1 text-sm text-muted-foreground">{site.afterpay}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <Booking />
    </>
  );
}
