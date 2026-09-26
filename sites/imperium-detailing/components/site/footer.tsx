import Link from "next/link";
import { site, telHref } from "@/lib/site";
import { services } from "@/lib/services";
import { areas } from "@/lib/areas";

// py-2.5 on a 19px line is a 44px target on a phone; laptops pack them closer.
const link = "link-slide inline-flex min-h-11 items-center py-2.5 text-[15px] text-secondary-foreground no-underline hover:text-foreground md:min-h-0 md:py-[5px]";
const heading = "m-0 mb-2 text-[13px] font-normal text-muted-foreground md:mb-3";

type Col = { title: string; links: { href: string; label: string; external?: boolean }[] };

const columns: Col[] = [
  {
    title: "Services",
    links: [
      ...services.map((s) => ({ href: `/services/${s.slug}/`, label: s.name })),
      { href: "/maintenance/", label: "Maintenance plans" },
      { href: "/fleet-detailing-canberra/", label: "Fleet detailing" },
      { href: "/tesla-ev-detailing-canberra/", label: "Tesla and EV detailing" },
      { href: "/services/", label: "All services and prices" },
    ],
  },
  {
    // Every area page is linked from every page, as it was before the redesign.
    title: "Areas",
    links: [
      ...areas.map((a) => ({ href: `/service-areas/${a.slug}/`, label: a.name })),
      // This page targets the broadest local search there is; it needs a way in.
      { href: "/car-detailing-canberra/", label: "Car detailing Canberra" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/reviews/", label: "Reviews" },
      { href: site.googleWriteReviewUrl, label: "Write a Google review", external: true },
      { href: "/warranty/", label: "Warranty" },
      { href: "/learn/", label: "Guides" },
      { href: "/service-areas/", label: "Areas" },
      { href: "/book/", label: "Get a quote" },
      { href: "/privacy/", label: "Privacy" },
      { href: "/terms/", label: "Terms" },
    ],
  },
];

// Logo, the line, the hours, the links, the ABN, then the name at a size you
// can't miss, fading out at the foot of the page.
export function Footer() {
  return (
    <footer id="site-footer" className="relative overflow-hidden border-t border-border bg-background">
      <div className="container-x mx-auto max-w-6xl pt-12 md:pt-20">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4 lg:grid-cols-[minmax(0,4fr)_minmax(0,2fr)_minmax(0,2fr)_minmax(0,2fr)_minmax(0,3fr)] lg:gap-10">
          <div className="col-span-2 md:col-span-4 lg:col-span-1">
            <img src="/brand/logo-full-dark-192.webp" width={225} height={192} alt="Imperium Detailing" loading="lazy" decoding="async" className="h-20 w-auto md:h-24" />
            <p className="m-0 mt-4 text-[15px] text-secondary-foreground md:mt-5">Showroom finish. Every time.</p>
            <p className="m-0 mt-1.5 text-sm text-muted-foreground md:mt-2">{site.hours}</p>
          </div>

          {columns.map((c) => (
            <nav key={c.title} aria-label={`Footer: ${c.title.toLowerCase()}`}>
              <h2 className={heading}>{c.title}</h2>
              <ul className="m-0 flex list-none flex-col items-start p-0">
                {c.links.map((l) => (
                  <li key={l.href}>
                    {l.external ? (
                      <a href={l.href} target="_blank" rel="noopener" className={link}>
                        {l.label}
                      </a>
                    ) : (
                      <Link href={l.href} className={link}>
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          <div>
            <h2 className={heading}>Contact</h2>
            <ul className="m-0 flex list-none flex-col items-start p-0">
              <li>
                <a href={telHref} className={link}>
                  {site.phoneDisplay}
                </a>
              </li>
              <li className="max-w-full">
                <a href={`mailto:${site.email}`} className={`${link} break-all`}>
                  {site.email}
                </a>
              </li>
              <li>
                <a href={site.instagram} rel="noopener" className={link}>
                  {site.instagramHandle}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <p className="m-0 mt-12 text-xs text-muted-foreground md:mt-14 md:text-[13px]">
          © {new Date().getFullYear()} {site.legalName}. ABN {site.abn}.
        </p>
      </div>

      <div aria-hidden="true" className="container-x mx-auto max-w-6xl">
        <div className="wordmark-fade display-caps mt-4 select-none whitespace-nowrap text-[clamp(4rem,24vw,20.6rem)] leading-[0.8] tracking-[-0.01em] md:mt-6">
          Imperium
        </div>
      </div>
    </footer>
  );
}
