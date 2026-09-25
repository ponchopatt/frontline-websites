"use client";

import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { useEffect, type ComponentProps } from "react";

export function ThemeProvider({ children, ...props }: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider {...props}>
      <ThemeColor />
      {children}
    </NextThemesProvider>
  );
}

/** The browser's bar takes the look's ground colour, not always Onyx's. */
function ThemeColor() {
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    // After the look's class is on the page (it's set in the provider's own effect).
    const frame = requestAnimationFrame(() => {
      const meta = document.querySelector('meta[name="theme-color"]');
      const ground = getComputedStyle(document.body).backgroundColor;
      if (meta && ground) meta.setAttribute("content", ground);
    });
    return () => cancelAnimationFrame(frame);
  }, [resolvedTheme]);
  return null;
}
