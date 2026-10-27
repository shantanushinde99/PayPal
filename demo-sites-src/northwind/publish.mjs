// Replaces demo-sites/hard-site with the fresh static export.
import { cpSync, rmSync, writeFileSync } from "node:fs";
const target = new URL("../../demo-sites/hard-site/", import.meta.url);
rmSync(target, { recursive: true, force: true });
cpSync(new URL("./out/", import.meta.url), target, { recursive: true });
writeFileSync(new URL(".nojekyll", target), ""); // keep _next/ (underscore folders are hidden by Jekyll)
console.log("published to demo-sites/hard-site");
