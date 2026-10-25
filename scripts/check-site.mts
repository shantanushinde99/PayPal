// Run: npx tsx --env-file=.env --tsconfig tsconfig.json scripts/check-site.mts <url> [bakery]
import { checkWebsite } from "@/lib/verify/website";

const url = process.argv[2] ?? "https://example.com";
const BAKERY = [
  "Site has Home, Menu, About and Contact pages",
  "Menu page lists items with prices",
  "All links on the site work (no broken links)",
  "Contact page shows the email hello@sunrisebakery.com",
  "Contact form can be submitted and shows a confirmation",
  "Pages fit a phone screen without sideways scrolling",
];
const checklist = (process.argv[3] === "bakery" ? BAKERY : ["Page has a heading", "Page has a contact form with an email field"])
  .map((requirement, i) => ({ id: `c${i + 1}`, requirement }));
const { verdict, report } = await checkWebsite({ url, checklist, log: async (m, img) => console.log(`• ${m}${img ? " [screenshot]" : ""}`) });
console.table(verdict.map((v) => ({ item: checklist.find((c) => c.id === v.checklistItemId)!.requirement.slice(0, 40), status: v.status, evidence: (v.evidence ?? "").slice(0, 60) })));
console.log(`pages ${report.pages.length}, links ${report.links.length}, broken ${report.links.filter((l) => !l.ok).length}`);
process.exit(0);
