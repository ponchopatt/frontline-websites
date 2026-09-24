"use client";

import { unstable_isUnrecognizedActionError as isUnrecognizedActionError } from "next/navigation";

/*
  A phone can keep an old copy of the app open across a new release (a home-screen app comes
  back exactly as it was left). Its buttons then call server functions that no longer exist,
  and every tap fails quietly. The fix is a reload, which fetches the current version.
*/

/** True for the error a stale copy gets from a server function; the page is reloaded. */
export function reloadIfStale(error: unknown): boolean {
  const stale = isUnrecognizedActionError(error) || (error instanceof Error && /Server Action|older or newer deployment/i.test(error.message));
  if (stale && typeof window !== "undefined") window.location.reload();
  return stale;
}

/** Runs once in the browser: a stale copy that fails anywhere else reloads too. */
export function watchForStaleCopy() {
  if (typeof window === "undefined") return;
  window.addEventListener("unhandledrejection", (e) => {
    if (reloadIfStale(e.reason)) e.preventDefault();
  });
}
