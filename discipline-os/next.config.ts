import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Local testing opens the dev server at 127.0.0.1 (the address Supabase's local auth uses).
  allowedDevOrigins: ["127.0.0.1"],
  poweredByHeader: false,
  devIndicators: false,
  // This app lives in a subfolder of a larger repo; keep Turbopack rooted here.
  turbopack: { root: path.resolve(".") },
};

export default nextConfig;
