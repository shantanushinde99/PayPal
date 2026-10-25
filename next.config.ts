import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["playwright-core"],
  // PayPal rejects localhost return URLs and Next rewrites 127.0.0.1 to localhost,
  // so local dev runs on lvh.me (public DNS → 127.0.0.1).
  allowedDevOrigins: ["lvh.me"],
};

export default nextConfig;
