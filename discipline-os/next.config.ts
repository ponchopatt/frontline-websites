import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Local testing opens the dev server at 127.0.0.1 (the address Supabase's local auth uses).
  allowedDevOrigins: ["127.0.0.1"],
  poweredByHeader: false,
  devIndicators: false,
  // This app lives in a subfolder of a larger repo; keep Turbopack rooted here.
  turbopack: { root: path.resolve(".") },
  // Proof photos are shrunk in the browser first; this leaves room for one that can't be.
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  // Each release has an id, so a page left open from the release before reloads instead of
  // calling server functions that no longer exist.
  deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? process.env.NEXT_DEPLOYMENT_ID ?? undefined,
};

export default nextConfig;
