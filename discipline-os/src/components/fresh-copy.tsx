"use client";

import { useEffect } from "react";
import { watchForStaleCopy } from "@/lib/stale";

/** Mounted once in the root layout: a copy of the app left over from an old release reloads itself. */
export function FreshCopy() {
  useEffect(() => {
    watchForStaleCopy();
  }, []);
  return null;
}
