import { site } from "@/lib/site";
import { LinkButton } from "@/components/site/link-button";
import { splitHeading } from "@/components/site/service-prices";

// The warranty in three columns, for the ceramic coating page. Every sentence
// is taken from app/warranty/page.tsx, whole or with a clause dropped (the
// email address, which is too long for a column this narrow): if the warranty's
// wording changes there, change it here too. "Keeping it valid" shows three of
// the five conditions; the button leads to all of them.
const columns = [
  {
    title: "What it covers",
    body: [
      "Every ceramic coating we apply comes with a written warranty: 3, 5 or 7 years depending on the tier you choose.",
      "Loss of gloss and loss of hydrophobic behaviour (water beading and sheeting) on coated panels.",
    ],
  },
  {
    title: "Keeping it valid",
    body: [
      "Keeping the car undercover for 24 hours and out of rain for 48 hours after application, as advised on the day.",
      "No automatic car washes with spinning brushes.",
      "Hand washing with a pH-neutral shampoo and the two-bucket method described in the wash guide we give you.",
    ],
  },
  {
    title: "Making a claim",
    body: [
      `Text or call ${site.phoneDisplay} with your name, the car and a couple of photos.`,
      "We'll book an inspection at your place, confirm what's happened and, if it's covered, re-apply the affected panels.",
      "Your rights under the Australian Consumer Law sit alongside this warranty, not beneath it.",
    ],
  },
];

// Laptops: the heading and the button on the left (5 of 12), the three columns
// on the right, each under a blue rule. Phones: heading, columns, button.
export function WarrantyBand() {
  return (
    <section aria-labelledby="warranty-heading" className="border-t border-border bg-card/40 py-[72px] md:py-24">
      <div className="container-x mx-auto grid max-w-6xl gap-y-6 lg:grid-cols-12 lg:grid-rows-[auto_1fr] lg:gap-x-20">
        <h2 id="warranty-heading" className={`${splitHeading} lg:col-span-5`} data-reveal="lines">
          Local competitors don&apos;t publish theirs. We do.
        </h2>
        <div className="grid gap-5 md:grid-cols-3 md:gap-8 lg:col-span-7 lg:row-span-2">
          {columns.map((c) => (
            <div key={c.title} className="border-t border-primary pt-3.5 md:pt-5">
              <h3 className="display-caps m-0 text-[26px] md:text-[30px]">{c.title}</h3>
              <div className="mt-2 grid gap-2 text-sm text-muted-foreground md:mt-3 md:text-[15px]">
                {c.body.map((t) => (
                  <p key={t} className="m-0">
                    {t}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 lg:col-span-5 lg:row-start-2 lg:mt-2">
          <LinkButton href="/warranty/" variant="ghost" className="w-full md:w-auto">
            Read the full warranty
          </LinkButton>
        </div>
      </div>
    </section>
  );
}
