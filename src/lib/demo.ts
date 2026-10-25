import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { and, count, eq, gt, inArray, lt, or } from "drizzle-orm";
import { db } from "@/db";
import { checklistItems, events, jobs, milestones, payments, submissions, users, verdictItems } from "@/db/schema";
import { env } from "@/lib/env";

export const demoEnabled = () => Boolean(env.DEMO_PAYOUT_EMAIL);

const BAKERY_CHECKLIST = [
  "Site has Home, Menu, About and Contact pages", "Menu page lists items with prices", "All links on the site work (no broken links)",
  "Contact page shows the email hello@sunrisebakery.com", "Contact form can be submitted and shows a confirmation", "Pages fit a phone screen without sideways scrolling",
];

// A private set of accounts and jobs per visitor, so judges never step on each other.
// Jobs stop before funding: no fake PayPal transactions, the visitor creates real sandbox ones.
export async function createDemoWorkspace() {
  const group = randomUUID();
  const base = { isDemo: true, demoGroup: group, onboardedAt: new Date(), payoutEmail: env.DEMO_PAYOUT_EMAIL ?? null };
  const person = (key: string, p: Partial<typeof users.$inferInsert>) => ({ ...base, email: `${key}.${group}@demo.verifund.app`, ...p });
  const [client, priya, , mei] = await db.insert(users).values([
    person("alex", { roles: ["client"], displayName: "Alex Rivera", company: "Sunrise Bakery" }),
    person("priya", { roles: ["freelancer"], displayName: "Priya Shah", headline: "Web developer · small-business sites", skills: ["Next.js", "Tailwind", "SEO", "Accessibility"], bio: "I build fast, accessible websites for local businesses and hand over everything you need to run them.", portfolioUrl: "https://shantanushinde99.github.io/PayPal/demo-sites/bakery-v2/" }),
    person("diego", { roles: ["freelancer"], displayName: "Diego Morales", headline: "Painter & decorator", skills: ["Interior painting", "Plastering", "Wallpaper"], bio: "Ten years of tidy, on-time interior work. Before/after photos for every job." }),
    person("mei", { roles: ["freelancer"], displayName: "Mei Chen", headline: "Brand & web designer", skills: ["Branding", "Figma", "Menus", "Webflow"], bio: "Identity, menus and websites for cafés and restaurants." }),
  ]).returning();

  const job = async (j: { freelancer: typeof priya; title: string; description: string; status: string }, ms: { title: string; amountMinor: number; proofType: string; checklist: string[] }[]) => {
    const [row] = await db.insert(jobs).values({
      clientId: client.id, freelancerId: j.freelancer.id, freelancerEmail: j.freelancer.payoutEmail ?? j.freelancer.email,
      title: j.title, description: j.description, currency: "USD", status: j.status, acceptedAt: j.status === "accepted" ? new Date() : null,
    }).returning();
    for (const [position, m] of ms.entries()) {
      const [mm] = await db.insert(milestones).values({ jobId: row.id, position, title: m.title, amountMinor: m.amountMinor, proofType: m.proofType }).returning();
      await db.insert(checklistItems).values(m.checklist.map((requirement, i) => ({ milestoneId: mm.id, position: i, requirement })));
    }
  };
  await job({ freelancer: priya, status: "accepted", title: "Sunrise Bakery website", description: "A small website for Sunrise Bakery: home, menu with prices, about and contact pages, a working contact form, and the email hello@sunrisebakery.com. Must work on phones." },
    [{ title: "Full website launch", amountMinor: 30000, proofType: "website", checklist: BAKERY_CHECKLIST }]);
  await job({ freelancer: priya, status: "invited", title: "Repaint the shop wall", description: "Repaint the back wall of the shop in warm white and cover the old stains." },
    [{ title: "Wall repainted", amountMinor: 8000, proofType: "photo", checklist: ["Whole wall is painted warm white", "No old stains are visible", "Floor and skirting are free of paint splashes"] }]);
  await job({ freelancer: mei, status: "invited", title: "Menu redesign", description: "A one-page menu on the website, matching our brand colours." },
    [{ title: "Online menu page", amountMinor: 15000, proofType: "website", checklist: ["Menu page lists every item with a price", "Uses the brand colour #7C4A1E for headings", "Menu fits a phone screen"] }]);
  return { group, clientId: client.id, freelancerId: priya.id };
}

// Short-lived signed ticket to log in as the other side of the same workspace.
const mac = (payload: string) => createHmac("sha256", env.AUTH_SECRET).update(`demo-switch:${payload}`).digest("base64url");

export function signSwitch(userId: string, group: string, ttlSeconds = 600) {
  const payload = `${userId}.${group}.${Math.floor(Date.now() / 1000) + ttlSeconds}`;
  return `${payload}.${mac(payload)}`;
}

export async function verifySwitch(token: string) {
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [userId, group, exp, sig] = parts;
  const want = Buffer.from(mac(`${userId}.${group}.${exp}`)), got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got) || Number(exp) < Date.now() / 1000) return null;
  const [u] = await db.select().from(users).where(and(eq(users.id, userId), eq(users.isDemo, true), eq(users.demoGroup, group)));
  return u ?? null;
}

// next-auth Credentials authorize. Visitor input can't name a user: only a signed ticket can.
export const DEMO_RATE_LIMIT = 10; // new workspaces per minute, across all visitors

export async function demoAuthorize(credentials: Partial<Record<string, unknown>>) {
  if (!demoEnabled()) return null; // the provider exists even when the demo is off
  if (typeof credentials.switch === "string" && credentials.switch) {
    const u = await verifySwitch(credentials.switch);
    return u ? { id: u.id, email: u.email, name: u.displayName } : null;
  }
  const [recent] = await db.select({ n: count() }).from(users)
    .where(and(eq(users.isDemo, true), gt(users.createdAt, new Date(Date.now() - 60_000))));
  if (recent.n >= DEMO_RATE_LIMIT * 4) return null; // 4 users per workspace
  const ws = await createDemoWorkspace();
  const [u] = await db.select().from(users).where(eq(users.id, ws.clientId));
  return { id: u.id, email: u.email, name: u.displayName };
}

export async function deleteOldDemos(hours = 48) {
  const cutoff = new Date(Date.now() - hours * 3600_000);
  const groups = (await db.selectDistinct({ g: users.demoGroup }).from(users)
    .where(and(eq(users.isDemo, true), lt(users.createdAt, cutoff)))).flatMap((r) => (r.g ? [r.g] : []));
  if (!groups.length) return 0;
  return db.transaction(async (tx) => {
    const ids = (await tx.select({ id: users.id }).from(users).where(and(eq(users.isDemo, true), inArray(users.demoGroup, groups)))).map((u) => u.id);
    const js = (await tx.select({ id: jobs.id }).from(jobs).where(or(inArray(jobs.clientId, ids), inArray(jobs.freelancerId, ids)))).map((j) => j.id);
    const ms = js.length ? (await tx.select({ id: milestones.id }).from(milestones).where(inArray(milestones.jobId, js))).map((m) => m.id) : [];
    if (ms.length) {
      const subs = (await tx.select({ id: submissions.id }).from(submissions).where(inArray(submissions.milestoneId, ms))).map((s) => s.id);
      if (subs.length) await tx.delete(verdictItems).where(inArray(verdictItems.submissionId, subs));
      await tx.delete(submissions).where(inArray(submissions.milestoneId, ms));
      await tx.delete(payments).where(inArray(payments.milestoneId, ms));
      await tx.delete(events).where(inArray(events.milestoneId, ms));
      await tx.delete(checklistItems).where(inArray(checklistItems.milestoneId, ms));
      await tx.delete(milestones).where(inArray(milestones.id, ms));
    }
    if (js.length) await tx.delete(jobs).where(inArray(jobs.id, js));
    await tx.delete(users).where(inArray(users.id, ids));
    return ids.length;
  });
}
