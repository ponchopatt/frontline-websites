import type { Metadata } from "next";
import Script from "next/script";
import { Big_Shoulders, Instrument_Sans } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/site/header";
import { Footer } from "@/components/site/footer";
import { JsonLd } from "@/components/site/json-ld";
import { Analytics } from "@/components/site/analytics";
import { SmoothScroll } from "@/components/site/smooth-scroll";
import { ScrollFx } from "@/components/site/scroll-fx";
import { MobileBar } from "@/components/site/mobile-bar";
import { site, prices } from "@/lib/site";
import { formatPrice } from "@/lib/services";

// Google folded "Big Shoulders Display" into the variable "Big Shoulders" family;
// the opsz axis gives the display cut automatically at headline sizes.
const display = Big_Shoulders({
  subsets: ["latin"],
  weight: "variable",
  axes: ["opsz"],
  variable: "--font-big-shoulders",
  display: "swap",
});

const sans = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-instrument",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: "Mobile Car Detailing Canberra | Imperium Detailing",
    template: "%s · Imperium Detailing",
  },
  description:
    `Canberra's premium mobile car detailing. Ceramic coatings from ${formatPrice(prices.ceramic)}, paint correction from ${formatPrice(prices.correction)}, full details from ${formatPrice(prices.full)}. We come to you, no call-out fee.`,
  openGraph: {
    type: "website",
    locale: "en_AU",
    siteName: site.name,
    images: [{ url: "/brand/og-image.jpg", width: 1200, height: 630, alt: "Imperium Detailing" }],
  },
  twitter: { card: "summary_large_image" },
  icons: {
    icon: [
      { url: "/brand/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/brand/apple-touch-icon.png",
    shortcut: "/brand/favicon.ico",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // data-scroll-behavior: the CSS smooth scroll is for in-page links. Next.js 16
    // only switches it off for page changes when this attribute is set.
    <html lang="en-AU" data-scroll-behavior="smooth" className={`${display.variable} ${sans.variable} dark h-full`}>
      <body className="flex min-h-full flex-col">
        {/* Runs before paint: marks that JS is on, so below-the-fold reveals may start hidden. */}
        <Script id="flags" strategy="beforeInteractive">{`document.documentElement.dataset.js="1";`}</Script>
        <SmoothScroll />
        <ScrollFx />
        <Header />
        <main id="content" className="flex-1">
          {children}
        </main>
        <Footer />
        <MobileBar />
        <JsonLd />
        <Analytics />
        {/* The pixel itself loads in <Analytics />. This only reaches browsers with
            JavaScript off, so PageView is never counted twice. */}
        {site.metaPixelId && (
          <noscript>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img height="1" width="1" style={{ display: "none" }} alt="" src={`https://www.facebook.com/tr?id=${site.metaPixelId}&ev=PageView&noscript=1`} />
          </noscript>
        )}
      </body>
    </html>
  );
}
