import Link from "next/link";
import { Search, UserPlus } from "lucide-react";
import { requireUser } from "@/lib/session";
import { listFreelancers } from "@/lib/directory";
import { Header } from "@/components/header";
import { Card, btn, field } from "@/components/ui";
import { FreelancerSummary, PortfolioLink, SkillChips } from "@/components/freelancer-card";

export default async function Freelancers({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  const q = ((await searchParams).q ?? "").slice(0, 80);
  const list = await listFreelancers(user, q);
  const canHire = user.roles.includes("client");
  return (
    <>
      <Header user={user} />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">Freelancers</h1>
            <p className="text-ink-soft">Hire someone, agree a checklist, and pay only when the AI verifies the work.</p>
          </div>
          <form role="search" className="flex w-full gap-2 sm:w-auto">
            <label htmlFor="q" className="sr-only">Search freelancers</label>
            <input id="q" name="q" defaultValue={q} placeholder="Search name or skill…" className={`${field} sm:w-72`} />
            <button className={btn.secondary} aria-label="Search"><Search aria-hidden className="size-4" /></button>
          </form>
        </div>
        {list.length === 0 ? (
          <Card className="p-10 text-center text-ink-soft">{q ? `No freelancers match “${q}”.` : "No freelancers yet."} You can also <Link href="/jobs/new" className="font-semibold text-brand underline">invite one by email</Link>.</Card>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {list.map((f) => (
              <li key={f.id}>
                <Card className="flex h-full flex-col gap-4 p-5">
                  <FreelancerSummary f={f} />
                  {f.bio && <p className="line-clamp-3 text-sm leading-relaxed text-ink-soft">{f.bio}</p>}
                  <SkillChips skills={f.skills} />
                  <div className="mt-auto flex items-center justify-between gap-3 pt-1">
                    <PortfolioLink url={f.portfolioUrl} verified={f.portfolioVerified} />
                    {canHire && <Link href={`/jobs/new?freelancer=${f.id}`} className={btn.primary}><UserPlus aria-hidden className="size-4" /> Hire</Link>}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
