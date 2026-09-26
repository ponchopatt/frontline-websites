import { site } from "@/lib/site";
import { SectionHeading } from "@/components/site/section-heading";

// A real sequence, so the numbering carries information.
const steps = [
  {
    n: "1",
    h: "Text us your car and suburb",
    p: `A photo helps. ${site.quotePromise} The quote is fixed once we've seen the car: no surprise invoices.`,
  },
  {
    n: "2",
    h: "We arrive with everything",
    p: "An unmarked van with the gear, the product and the people. You need an outdoor tap and a 240V power point within reach; correction and coating also need a garage or covered space.",
  },
  {
    n: "3",
    h: "Handover",
    p: "We send a photo when we're done, walk you through the finish, and take card or transfer once you're happy. Coated cars leave with a wash guide and a written warranty.",
  },
];

// Three columns under a hairline each on a laptop; on a phone the number sits to
// the left of its step. The areas list that used to close this section is now
// its own strip near the foot of the page.
export function Process() {
  return (
    <section id="how" className="section-y relative border-t border-border">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_40%_at_15%_20%,rgba(31,111,196,0.12),transparent_70%)]" />
      <div className="container-x relative mx-auto max-w-6xl">
        <SectionHeading title="We come to you." intro="No shop to drop the car at. Your driveway, your apartment car park or your workplace, anywhere in Canberra and Queanbeyan, for the same price." />
        <ol className="m-0 grid list-none gap-7 p-0 md:grid-cols-3 md:gap-12">
          {steps.map((s) => (
            <li key={s.n} data-reveal="up" className="grid grid-cols-[44px_minmax(0,1fr)] gap-3 md:block md:border-t md:border-border md:pt-7">
              <span aria-hidden="true" className="display-caps block text-5xl leading-none text-primary md:text-7xl">
                {s.n}
              </span>
              <div>
                <h3 className="m-0 text-lg font-semibold md:mt-4 md:text-[22px]">{s.h}</h3>
                <p className="m-0 mt-1.5 max-w-[38ch] text-sm text-muted-foreground md:mt-2.5 md:text-[15px]">{s.p}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
