export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-sm content-center px-5 py-12">
      <div className="mb-10 grid gap-3">
        <svg viewBox="0 0 64 64" className="size-10" aria-hidden>
          <circle cx="32" cy="32" r="22" fill="none" stroke="var(--border)" strokeWidth="3" />
          <path d="M32 10a22 22 0 1 1-20.9 28.8" fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" />
        </svg>
        <p className="text-sm tracking-wide text-muted-foreground">Discipline OS</p>
      </div>
      {children}
    </main>
  );
}
