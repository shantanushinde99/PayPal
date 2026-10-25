"use server";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { parseProfile } from "@/lib/profile";

export type ProfileState = { error?: string };

export async function saveProfile(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const user = await requireUser({ onboarded: false });
  if (user.isDemo) return { error: "Demo profiles can't be changed." };
  let profile;
  try { profile = parseProfile(formData); } catch (e) { return { error: (e as Error).message }; }
  await db.update(users).set({ ...profile, onboardedAt: user.onboardedAt ?? new Date() }).where(eq(users.id, user.id));
  redirect(user.onboardedAt ? "/profile?saved=1" : "/");
}
