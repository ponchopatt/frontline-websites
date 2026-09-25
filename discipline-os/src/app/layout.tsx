import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { FreshCopy } from "@/components/fresh-copy";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { EARLY_TAPS_SCRIPT } from "@/lib/early-taps";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Discipline OS", template: "%s · Discipline OS" },
  description: "Start right. Seek God. Do the work. Keep your body. Keep your word.",
  applicationName: "Discipline OS",
  robots: { index: false, follow: false },
  // Opened from the home screen it runs full-screen, with the status bar over the ground.
  appleWebApp: { capable: true, title: "Discipline", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0d1218",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geist.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* Notes taps made before the page is ready, so they aren't lost (see lib/early-taps). */}
        <script dangerouslySetInnerHTML={{ __html: EARLY_TAPS_SCRIPT }} />
      </head>
      <body className="min-h-full">
        <ThemeProvider attribute="class" themes={["onyx", "sage", "spark", "dark", "light"]} defaultTheme="onyx" enableSystem={false} disableTransitionOnChange>
          {children}
          <FreshCopy />
          <Toaster position="top-center" offset={{ top: 16 }} mobileOffset={{ top: "max(12px, env(safe-area-inset-top))" }} />
        </ThemeProvider>
      </body>
    </html>
  );
}
