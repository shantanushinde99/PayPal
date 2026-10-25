// Run: npx tsx --env-file=.env scripts/check-site.mts https://example.com
import { checkWebsite } from "@/lib/verify/website";

const url = process.argv[2] ?? "https://example.com";
const verdict = await checkWebsite({
  url,
  checklist: [
    { id: "c1", requirement: "Page has a heading" },
    { id: "c2", requirement: "Page has a contact form with an email field" },
  ],
  log: async (m, img) => console.log(`• ${m}${img ? " [screenshot]" : ""}`),
});
console.table(verdict);
process.exit(0);
