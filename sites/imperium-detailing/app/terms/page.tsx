import type { Metadata } from "next";
import { og } from "@/lib/seo";
import Link from "next/link";
import { site, cancellationPolicy } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The plain-English terms for booking a mobile detail, paint correction or ceramic coating with Imperium Detailing.",
  alternates: { canonical: "/terms/" }, openGraph: og("/terms/"),
};

const P = ({ children }: { children: React.ReactNode }) => <p className="mt-4 max-w-[64ch] text-[17px] text-secondary-foreground">{children}</p>;
const H = ({ children }: { children: React.ReactNode }) => <h2 className="display-caps mt-10 text-3xl md:text-4xl">{children}</h2>;

export default function TermsPage() {
  return (
    <section className="container-x mx-auto max-w-6xl py-14 md:py-20">
      <h1 className="display-caps max-w-4xl text-5xl md:text-7xl">Terms, in plain English.</h1>
      <P>These are the terms that apply when you book Imperium Detailing. They&apos;re short because the way we work is simple.</P>

      <H>Quotes and prices</H>
      <P>Our from-prices are the starting price for each service on a hatch or sedan. Full and interior details are priced as a range for each vehicle size, and where your car lands in the range depends on its condition. Your price is fixed once we&apos;ve seen the car, either in photos or in person, and we confirm it before we start, never after. No surprise invoices.</P>

      <H>Bookings and access</H>
      <P>We work at your home, apartment car park or workplace. You need to give us access to the car, an outdoor tap and a standard 240V power point. Paint correction and ceramic coating also need an enclosed garage or covered space out of direct sun, wind and dust. If those aren&apos;t available on the day, we may need to reschedule.</P>

      <H>Cancellations</H>
      <P>{cancellationPolicy} Tell us as early as you can and we&apos;ll move the booking to a day that suits you.</P>

      <H>Weather</H>
      <P>Rain, frost and extreme heat affect what we can do safely and well. If the forecast makes the job unworkable we&apos;ll contact you as early as we can to move it, and there&apos;s no charge for a weather reschedule.</P>

      <H>Payment</H>
      <P>Payment is due on completion, once you&apos;ve seen the result. We take card, bank transfer and Afterpay. There are no card fees and no travel fees anywhere in the ACT or Queanbeyan.</P>

      <H>Our workmanship</H>
      <P>We&apos;re fully insured and we guarantee the finish we hand back. If something isn&apos;t right, tell us within a couple of days and we&apos;ll come back and fix it. Ceramic coatings carry a separate written warranty, explained on the <Link href="/warranty/" className="underline underline-offset-4">warranty page</Link>.</P>

      <H>What we can&apos;t promise</H>
      <P>We tell you before we start what will and won&apos;t come out. Scratches through the clear coat, deep etching, existing paint failure and mechanical faults are outside what detailing can fix, and we&apos;ll say so rather than guess.</P>

      <H>Contact</H>
      <P>Questions about these terms: {site.phoneDisplay} or <span className="wrap-anywhere">{site.email}</span>. Your rights under the Australian Consumer Law apply in addition to anything here.</P>
    </section>
  );
}
