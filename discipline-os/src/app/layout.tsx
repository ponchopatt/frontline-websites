import type { Metadata, Viewport } from "next";
import { Jost } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const jost = Jost({
  variable: "--font-jost",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Discipline OS", template: "%s · Discipline OS" },
  description: "Start right. Seek God. Do the work. Keep your body. Keep your word.",
  applicationName: "Discipline OS",
  robots: { index: false, follow: false },
  // Opened from the home screen it runs full-screen, with the status bar over the dark ground.
  appleWebApp: { capable: true, title: "Discipline", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0e0d0b" },
    { media: "(prefers-color-scheme: light)", color: "#f3f2ee" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${jost.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
          {children}
          <Toaster position="bottom-center" offset={96} mobileOffset={{ bottom: 96 }} />
        </ThemeProvider>
      </body>
    </html>
  );
}
