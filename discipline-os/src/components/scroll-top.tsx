"use client";

import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef } from "react";

/**
 * A new page opens at its top. Back and Forward keep the place the browser restores, and a link
 * to a spot on a page (#review) goes there.
 */
export function ScrollTop() {
  const pathname = usePathname();
  const first = useRef(true);
  const back = useRef(false);

  useEffect(() => {
    const pop = () => {
      back.current = true;
    };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);

  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (back.current) {
      back.current = false;
      return;
    }
    if (window.location.hash) return;
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);

  return null;
}
