import type { NextConfig } from "next";

// Served by GitHub Pages under the main repo, so every URL lives below this path.
const basePath = "/PayPal/demo-sites/hard-site";

const config: NextConfig = {
  output: "export",       // plain HTML/JS files, no server
  trailingSlash: true,    // /tours/ → tours/index.html, which GitHub Pages serves directly
  basePath,
  images: { unoptimized: true },
  turbopack: { root: process.cwd() }, // this folder, not the main Verifund app (which has its own lockfile above)
  env: { NEXT_PUBLIC_BASE_PATH: basePath }, // for fetch() of files in public/
};

export default config;
