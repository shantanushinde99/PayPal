import Link from "next/link";
import { eq } from "drizzle-orm";
import { auth, signIn, signOut } from "@/auth";
import { db } from "@/db";
import { jobs } from "@/db/schema";

export default async function Home() {
  const session = await auth();
  if (!session?.user?.id) {
    return (
      <main className="mx-auto max-w-xl p-8 space-y-6">
        <h1 className="text-3xl font-bold">Proof-of-Done</h1>
        <p>Pay freelancers only when an AI has verified the work is actually done.</p>
        <form action={async () => { "use server"; await signIn("paypal", { redirectTo: "/" }); }}>
          <button className="rounded bg-[#0070ba] px-5 py-3 font-semibold text-white">Log in with PayPal</button>
        </form>
      </main>
    );
  }
  const { id, email } = session.user;
  const posted = await db.select().from(jobs).where(eq(jobs.clientId, id));
  const working = await db.select().from(jobs).where(eq(jobs.freelancerEmail, email));
  const list = (items: typeof posted) =>
    items.length ? (
      <ul className="space-y-2">{items.map((j) => (
        <li key={j.id}><Link className="underline" href={`/jobs/${j.id}`}>{j.title}</Link></li>
      ))}</ul>
    ) : <p className="text-gray-500">None yet.</p>;

  return (
    <main className="mx-auto max-w-3xl p-8 space-y-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Proof-of-Done</h1>
        <form action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}>
          <span className="mr-3 text-sm text-gray-500">{email}</span>
          <button className="text-sm underline">Log out</button>
        </form>
      </header>
      <Link href="/jobs/new" className="inline-block rounded bg-black px-4 py-2 text-white">+ Post a job</Link>
      <section><h2 className="mb-2 font-semibold">Jobs I posted</h2>{list(posted)}</section>
      <section><h2 className="mb-2 font-semibold">Jobs I&apos;m working on</h2>{list(working)}</section>
    </main>
  );
}
