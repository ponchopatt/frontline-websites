import { AppNav } from "@/components/app-nav";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col md:flex-col-reverse md:justify-end">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <main id="main" className="mx-auto w-full max-w-xl flex-1 px-4 pt-6 pb-32 sm:px-6 md:max-w-2xl md:pt-10 md:pb-24">
        {children}
      </main>
      <AppNav />
    </div>
  );
}
