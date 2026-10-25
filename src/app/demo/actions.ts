"use server";
import { signIn } from "@/auth";
import { demoEnabled, signSwitch } from "@/lib/demo";
import { requireUser } from "@/lib/session";
import { db } from "@/db";
import { users } from "@/db/schema";
import { and, eq, ne } from "drizzle-orm";

export async function startDemo() {
  if (!demoEnabled()) throw new Error("The demo isn't available right now.");
  await signIn("demo", { redirectTo: "/" });
}

// Log in as the other side of the same demo workspace (client ⇄ Priya).
export async function switchDemoSide() {
  const me = await requireUser();
  if (!me.isDemo || !me.demoGroup) throw new Error("Only demo accounts can switch sides.");
  const wantRole = me.roles.includes("client") ? "freelancer" : "client";
  const peers = await db.select().from(users).where(and(eq(users.demoGroup, me.demoGroup), ne(users.id, me.id)));
  const target = wantRole === "client" ? peers.find((u) => u.roles.includes("client")) : peers.find((u) => u.email.startsWith("priya."));
  if (!target) throw new Error("Demo workspace incomplete.");
  await signIn("demo", { switch: signSwitch(target.id, me.demoGroup), redirectTo: "/" });
}
