"use client";

import AppError from "../(app)/error";

/** The same plain message as the rest of the app, with this page's own margins. */
export default function WelcomeError(props: Parameters<typeof AppError>[0]) {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-xl px-4 pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-6">
      <AppError {...props} />
    </main>
  );
}
