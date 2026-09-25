import type { Metadata } from "next";
import { og } from "@/lib/seo";
import { Hero } from "@/components/site/hero";
import { ProofBand } from "@/components/site/proof-band";
import { ServicesList } from "@/components/site/services-list";
import { Work } from "@/components/site/work";
import { BeforeAfter } from "@/components/site/before-after";
import { getService } from "@/lib/services";
import { prices } from "@/lib/site";
import { Process } from "@/components/site/process";
import { ReviewsGrid } from "@/components/site/reviews-grid";
import { AreasStrip } from "@/components/site/areas-strip";
import { Booking } from "@/components/site/booking";
import { PriceGuide } from "@/components/site/price-guide";
import { DetailSteps } from "@/components/site/detail-steps";

export const metadata: Metadata = {
  alternates: { canonical: "/" }, openGraph: og("/"),
};

// The 2026 order: what it costs comes straight after the proof, the work and the
// method after that, and the form near the end, once the page has made its case.
// ServicesCoverflow, ReviewsMarquee and RecentWork are kept as files but no
// longer used here.
export default function HomePage() {
  const correction = getService("paint-correction-canberra");
  return (
    <>
      <Hero />
      <ProofBand />
      <ServicesList />
      <PriceGuide />
      {correction?.compare && (
        <BeforeAfter
          {...correction.compare}
          title={correction.h1}
          note="Can you remove every scratch? No, and any detailer promising that isn't being straight with you. Scratches through the clear coat can't be polished out."
          cta={{ href: `/services/${correction.slug}/`, label: `Paint correction from $${prices.correction}` }}
        />
      )}
      <Work />
      <DetailSteps />
      <Process />
      <ReviewsGrid />
      <Booking />
      <AreasStrip />
    </>
  );
}
