"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { watchForStaleCopy } from "@/lib/stale";
import { replayEarlyTaps } from "@/lib/early-taps";

/** Away this long, the screen is fetched again on return: a new day may have started. */
const AWAY_MS = 5 * 60_000;

/**
 * Mounted once in the root layout. It keeps what's on screen current:
 * - a copy of the app left over from an old release reloads itself;
 * - Back and Forward show the server's numbers, not the ones from when the page was left;
 * - coming back to the app after a while fetches the screen again;
 * - taps made before the page was ready are played now that it is.
 */
export function FreshCopy() {
  const router = useRouter();

  useEffect(() => {
    watchForStaleCopy();
    replayEarlyTaps();
  }, []);

  useEffect(() => {
    let hiddenAt = 0;
    const back = () => setTimeout(() => router.refresh(), 0);
    const restored = (e: PageTransitionEvent) => {
      if (e.persisted) router.refresh();
    };
    const visibility = () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > AWAY_MS) router.refresh();
    };
    window.addEventListener("popstate", back);
    window.addEventListener("pageshow", restored);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("popstate", back);
      window.removeEventListener("pageshow", restored);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [router]);

  return null;
}
