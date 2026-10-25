import NextAuth from "next-auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { env } from "@/lib/env";

declare module "next-auth" {
  interface Session { user: { id: string; email: string; name?: string | null } }
}

type PayPalProfile = { user_id: string; name?: string; emails?: { value: string; primary?: boolean }[] };

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  providers: [{
    id: "paypal",
    name: "PayPal",
    type: "oauth",
    clientId: env.PAYPAL_CLIENT_ID,
    clientSecret: env.PAYPAL_CLIENT_SECRET,
    checks: ["state"],
    authorization: {
      url: `${env.PAYPAL_WEB_BASE}/signin/authorize`,
      params: { scope: "openid email profile", flowEntry: "static" },
    },
    token: `${env.PAYPAL_API_BASE}/v1/oauth2/token`,
    userinfo: `${env.PAYPAL_API_BASE}/v1/identity/oauth2/userinfo?schema=paypalv1.1`,
    profile(p: PayPalProfile) {
      const email = (p.emails?.find((e) => e.primary) ?? p.emails?.[0])?.value;
      return { id: p.user_id, name: p.name, email };
    },
  }],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.email) {
        const email = user.email.toLowerCase();
        const [row] = await db.insert(users).values({ email, name: user.name })
          .onConflictDoUpdate({ target: users.email, set: { name: user.name } })
          .returning();
        token.uid = row.id;
        token.email = email;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.uid as string;
      session.user.email = token.email as string;
      return session;
    },
  },
});
