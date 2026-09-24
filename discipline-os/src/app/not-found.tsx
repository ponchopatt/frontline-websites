import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto grid min-h-dvh max-w-sm content-center gap-4 px-5">
      <h1 className="text-[28px] leading-tight font-medium tracking-tight">There&apos;s nothing here.</h1>
      <p className="text-muted-foreground">The page may have moved. Today is where everything starts.</p>
      <Link href="/" className="h-12 w-fit content-center rounded-full bg-primary px-6 text-[15px] font-medium text-primary-foreground">
        Go to today
      </Link>
    </main>
  );
}
