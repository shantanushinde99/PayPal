"use server";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { parseProfile } from "@/lib/profile";
import { importProfile, type ImportedProfile, type ImportRole } from "@/lib/profile-import";
import { ownershipCode, OWNERSHIP_JS } from "@/lib/ownership";
import { withCloudBrowser } from "@/lib/verify/website";
import { RateLimiter } from "@/lib/rate-limiter";
import { AiBusyError } from "@/lib/gemini";

export type ProfileState = { error?: string };

export async function saveProfile(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const user = await requireUser({ onboarded: false });
  if (user.isDemo) return { error: "Demo profiles can't be changed." };
  // The role is chosen once, at sign-up; after that the form can't change it (whatever it sends).
  if (user.onboardedAt && user.roles.length) { formData.delete("roles"); formData.set("roleChoice", user.roles[0]); }
  let profile;
  try { profile = parseProfile(formData); } catch (e) { return { error: (e as Error).message }; }
  await db.update(users).set({ ...profile, onboardedAt: user.onboardedAt ?? new Date() }).where(eq(users.id, user.id));
  redirect(user.onboardedAt ? "/profile?saved=1" : "/");
}

// Reading a site uses a cloud browser and the shared AI quota, so each person gets a few imports.
const imports = new RateLimiter(3, 10);

function siteUrl(raw: string): string {
  let u: URL;
  try { u = new URL(raw.trim()); } catch { throw new Error("That doesn't look like a link. Use a full address like https://you.dev"); }
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("The link must start with https://");
  const h = u.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || /^[\d.]+$/.test(h) || h.includes(":")) throw new Error("Use your site's public address.");
  if (/linkedin\.com$/.test(h)) throw new Error("LinkedIn doesn't let other sites read profiles. Use your portfolio or personal website instead.");
  u.hash = "";
  return u.toString();
}

export type ImportState = ImportedProfile & { url: string; verified: boolean };

// Drafts a profile from the user's own site. Nothing is saved except the ownership check, which is a fact
// about that link (the badge only shows while the saved portfolio link is the same one).
export async function importProfileAction(rawUrl: string, role: ImportRole): Promise<{ result?: ImportState; error?: string }> {
  const user = await requireUser({ onboarded: false });
  if (user.isDemo) return { error: "Demo profiles can't be changed." };
  let url: string;
  try { url = siteUrl(rawUrl); } catch (e) { return { error: (e as Error).message }; }
  if (imports.waitMs(user.id) > 0) return { error: "You've imported a few times already. Try again later, or fill the fields yourself." };
  imports.record(user.id);
  try {
    const r = await importProfile({ url, role, ownershipCode: ownershipCode(user.id) }, withCloudBrowser);
    const verified = role === "freelancer" && !!r.ownedVia;
    if (verified) await db.update(users).set({ portfolioVerifiedUrl: url }).where(eq(users.id, user.id));
    return { result: { ...r, url, verified } };
  } catch (e) {
    console.error("profile import failed", url, e);
    const msg = (e as Error).message ?? "";
    if (e instanceof AiBusyError) return { error: "The AI is busy right now. Try again in a minute." };
    if (/redirects to a different website|almost no readable text|couldn't find profile details/.test(msg)) return { error: msg };
    return { error: "We couldn't read that site right now. Check the link and try again." };
  }
}

// Re-checks the saved portfolio link for the user's ownership code (after they've added it to their site).
export async function verifyPortfolioAction(): Promise<{ verified?: boolean; error?: string }> {
  const user = await requireUser({ onboarded: false });
  if (!user.portfolioUrl) return { error: "Save a portfolio link first." };
  if (imports.waitMs(user.id) > 0) return { error: "Please wait a little before checking again." };
  imports.record(user.id);
  try {
    const found = await withCloudBrowser(async (page) => {
      await page.goto(user.portfolioUrl!, { waitUntil: "domcontentloaded", timeout: 25_000 });
      return (await page.evaluate(OWNERSHIP_JS(ownershipCode(user.id))).catch(() => "")) as string;
    });
    await db.update(users).set({ portfolioVerifiedUrl: found ? user.portfolioUrl : null }).where(eq(users.id, user.id));
    return { verified: !!found };
  } catch (e) {
    console.error("portfolio verify failed", e);
    return { error: "We couldn't open your portfolio right now. Try again in a minute." };
  }
}
