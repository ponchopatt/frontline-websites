"use client";

import { useSyncExternalStore } from "react";

let listeners: Array<() => void> = [];
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(listener: () => void) {
  listeners.push(listener);
  if (!timer) timer = setInterval(() => listeners.forEach((l) => l()), 1000);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
    if (listeners.length === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

/** Whole-second clock, shared by every timer on the page. 0 during server render. */
function getSnapshot() {
  return Math.floor(Date.now() / 1000) * 1000;
}

function getServerSnapshot() {
  return 0;
}

/**
 * The current time, ticking once a second. Used only to *display* elapsed time; which day
 * something belongs to is always decided on the server from the user's timezone.
 */
export function useNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
