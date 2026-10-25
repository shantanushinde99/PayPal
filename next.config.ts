import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["playwright-core"],
  // PayPal rejects localhost return URLs and Next rewrites 127.0.0.1 to localhost,
  // so local dev runs on lvh.me (public DNS → 127.0.0.1).
  allowedDevOrigins: ["lvh.me"],
  // Before/after photos are resized in the browser but still exceed the 1MB default.
  experimental: { serverActions: { bodySizeLimit: "8mb" } },
  // Tailwind v4 via its Turbopack loader (from the create-next-app template).
  turbopack: {
    rules: { "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" } },
  },
};

export default nextConfig;
