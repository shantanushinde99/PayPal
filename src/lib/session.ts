import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { users, type User } from "@/db/schema";

// The signed-in user's full row, or null (no session, or the account no longer exists).
export async function currentUser(): Promise<User | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const [row] = await db.select().from(users).where(eq(users.id, session.user.id));
  return row ?? null;
}

// Pages and actions call this. Everyone must finish onboarding before using the app.
export async function requireUser({ onboarded = true }: { onboarded?: boolean } = {}): Promise<User> {
  const user = await currentUser();
  if (!user) redirect("/");
  if (onboarded && !user.onboardedAt) redirect("/onboarding");
  return user;
}
