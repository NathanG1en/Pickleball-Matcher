import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  serverExternalPackages: ["postgres"],
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
