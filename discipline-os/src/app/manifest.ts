import type { MetadataRoute } from "next";

/** Add to Home Screen: opens full-screen on Today, like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Discipline OS",
    short_name: "Discipline",
    description: "Today's Big 3, habits, business numbers and work hours. Keep your word.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0e0d0b",
    theme_color: "#0e0d0b",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
