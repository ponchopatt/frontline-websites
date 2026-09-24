import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
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
  themeColor: "#5a7664",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geist.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full">
        <ThemeProvider attribute="class" themes={["sage", "spark", "dark", "light"]} defaultTheme="sage" enableSystem={false} disableTransitionOnChange>
          {children}
          <Toaster position="bottom-center" offset={96} mobileOffset={{ bottom: 96 }} />
        </ThemeProvider>
      </body>
    </html>
  );
}
