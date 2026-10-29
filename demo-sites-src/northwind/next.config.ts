import type { NextConfig } from "next";

// Served by GitHub Pages from the public verifund-demo-sites repo, so every URL lives below this path.
const basePath = "/verifund-demo-sites/hard-site";

const config: NextConfig = {
  output: "export",       // plain HTML/JS files, no server
  trailingSlash: true,    // /tours/ → tours/index.html, which GitHub Pages serves directly
  basePath,
  images: { unoptimized: true },
  turbopack: { root: process.cwd() }, // this folder, not the main Verifund app (which has its own lockfile above)
  env: { NEXT_PUBLIC_BASE_PATH: basePath }, // for fetch() of files in public/
};

export default config;
