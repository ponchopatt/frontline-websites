"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { site } from "@/lib/site";
import { track } from "@/lib/track";

// The chat button sits 20px in from the bottom-right corner. Below 1400px wide
// the page's own prices, buttons and links reach that corner as you scroll, so
// the widget only loads from there up (globals.css hides it if the window is
// then made narrower). Measured on every page: from 1376px nothing passes under it.
export const CHAT_MIN_WIDTH = 1400;

// The widget draws in an open shadow root that page CSS can't reach. This one
// rule goes inside it: no greeting bubble popping up, just the small button.
const QUIET_CHAT = ".lc_text-widget--prompt{display:none!important}";

function quietChat() {
  const root = document.querySelector("chat-widget")?.shadowRoot;
  if (!root) return false;
  if (!root.querySelector("style[data-quiet-chat]")) {
    const style = document.createElement("style");
    style.dataset.quietChat = "";
    style.textContent = QUIET_CHAT;
    root.appendChild(style);
  }
  return true;
}

// Google Ads tag (existing), Meta Pixel (when an ID is set), and the chat widget.
// The widget loads last, only on screens wide enough that it can't cover anything.
// Every call and text link on the site reports a contact event, tagged with the section it came from.
export function Analytics() {
  const [wide, setWide] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${CHAT_MIN_WIDTH}px)`);
    const update = () => setWide(mq.matches);
    update();
    mq.addEventListener("change", update);

    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      const href = a.getAttribute("href") || "";
      const section = a.closest("[id]")?.id || "page";
      if (href.startsWith("tel:")) track("contact_call", { section });
      else if (href.startsWith("sms:")) track("contact_text", { section });
    };
    document.addEventListener("click", onClick, { capture: true, passive: true });
    return () => {
      mq.removeEventListener("change", update);
      document.removeEventListener("click", onClick, { capture: true });
    };
  }, []);

  // The widget adds its element, then fills its shadow root and marks the element
  // "hydrated". Watching for both catches the root as soon as it exists.
  useEffect(() => {
    if (!wide || quietChat()) return;
    const watch = new MutationObserver(() => {
      if (quietChat()) watch.disconnect();
    });
    watch.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    return () => watch.disconnect();
  }, [wide]);

  return (
    <>
      {site.googleAdsId && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${site.googleAdsId}`} strategy="afterInteractive" />
          <Script id="gtag-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${site.googleAdsId}');`}
          </Script>
        </>
      )}
      {site.metaPixelId && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${site.metaPixelId}');fbq('track','PageView');`}
        </Script>
      )}
      {site.chatWidgetId && wide && (
        <Script
          src="https://widgets.leadconnectorhq.com/loader.js"
          strategy="lazyOnload"
          data-resources-url="https://widgets.leadconnectorhq.com/chat-widget/loader.js"
          data-widget-id={site.chatWidgetId}
        />
      )}
    </>
  );
}
