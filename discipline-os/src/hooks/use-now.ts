"use client";

import { useSyncExternalStore } from "react";

let listeners: Array<() => void> = [];
let timer: ReturnType<typeof setInterval> | null = null;
let current = 0;

function tick() {
  current = Date.now();
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.push(listener);
  if (!timer) {
    current = Date.now();
    timer = setInterval(tick, 1000);
  }
  return () => {
    listeners = listeners.filter((l) => l !== listener);
    if (listeners.length === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

/** The same value until the next tick, as useSyncExternalStore requires. */
function getSnapshot() {
  return current || Date.now();
}

function getServerSnapshot() {
  return 0;
}

/**
 * The current time, refreshed once a second and shared by every timer on the page. 0 during
 * the server render. Used only to *display* elapsed time; which day something belongs to is
 * always decided on the server from the user's timezone.
 */
export function useNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
