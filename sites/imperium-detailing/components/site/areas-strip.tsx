import Link from "next/link";
import { areas } from "@/lib/areas";

// The nine districts as a plain link list near the foot of the home page, each
// to its own area page. Three across on a laptop, two on a phone.
export function AreasStrip() {
  return (
    <section id="areas" aria-labelledby="areas-heading" className="border-t border-border py-14 md:py-24">
      <div className="container-x mx-auto grid max-w-6xl items-start gap-5 md:grid-cols-12 md:gap-x-12 lg:gap-x-20">
        <div className="md:col-span-5">
          <h2 id="areas-heading" className="display-caps text-[40px] md:text-[64px]">
            Canberra and Queanbeyan.
          </h2>
          <p className="m-0 mt-3 text-[15px] text-muted-foreground md:mt-5 md:text-base">Nine service areas, one van. No call-out fee.</p>
        </div>
        <div className="md:col-span-7">
          <ul className="m-0 grid list-none grid-cols-2 gap-x-4 border-t border-border p-0 md:grid-cols-3 md:gap-x-6">
            {areas.map((a) => (
              <li key={a.slug} className="border-b border-border">
                <Link
                  href={`/service-areas/${a.slug}/`}
                  className="flex min-h-11 items-center py-3 text-base text-foreground no-underline hover:text-white hover:underline hover:underline-offset-4 md:py-[18px] md:text-lg"
                >
                  {a.name}
                </Link>
              </li>
            ))}
          </ul>
          {/* The fleet page had one contextual link into it, from /services/. A
              business owner landing here had no way of knowing the work exists. */}
          <p className="m-0 mt-6 max-w-[60ch] text-sm text-muted-foreground md:text-[15px]">
            More than one vehicle?{" "}
            <Link href="/fleet-detailing-canberra/" className="text-foreground underline underline-offset-4">
              Fleet and business detailing
            </Link>{" "}
            is priced per car, at your yard, your depot or the office car park. Utes, vans, pool cars and trucks.
          </p>
        </div>
      </div>
    </section>
  );
}
