"use client";

import { useEffect } from "react";

/** A readable message instead of a stack trace, with a way forward. */
export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const message =
    error.message && !error.message.startsWith("An error occurred in the Server Components render")
      ? error.message
      : "Something went wrong loading this page.";

  return (
    <div className="grid gap-4 py-10" role="alert">
      <h1 className="text-[28px] leading-tight font-medium tracking-tight">This page didn&apos;t load.</h1>
      <p className="text-[16px] text-muted-foreground">{message}</p>
      <p className="text-sm text-muted-foreground">Nothing you saved is lost. Check your connection, then try again.</p>
      <button type="button" onClick={() => retry()} className="h-12 w-fit rounded-full bg-primary px-6 text-[15px] font-medium text-primary-foreground">
        Try again
      </button>
    </div>
  );
}
