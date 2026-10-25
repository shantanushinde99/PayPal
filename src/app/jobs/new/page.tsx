import Link from "next/link";
import { ArrowLeft, Sparkles, Users } from "lucide-react";
import { listFreelancers } from "@/lib/directory";
import { FreelancerSummary } from "@/components/freelancer-card";
import { requireUser } from "@/lib/session";
import { CURRENCIES } from "@/lib/money";
import { Header } from "@/components/header";
import { Card, btn, field } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { createJob } from "../actions";

export default async function NewJob({ searchParams }: { searchParams: Promise<{ freelancer?: string }> }) {
  const user = await requireUser();
  const wanted = (await searchParams).freelancer;
  // Looked up through the directory, so only hireable freelancers can be pre-selected.
  const chosen = wanted ? (await listFreelancers(user)).find((f) => f.id === wanted) : undefined;
  if (!user.roles.includes("client")) {
    return (
      <>
        <Header user={user} />
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
          <Card className="space-y-3 p-6"><h1 className="text-xl font-semibold">Posting jobs is for clients</h1><p className="text-ink-soft">Add the client role in your profile to hire freelancers.</p><Link href="/profile" className={btn.primary}>Open profile</Link></Card>
        </main>
      </>
    );
  }
  return (
    <>
      <Header user={user} />
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
        <Link href="/" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-ink"><ArrowLeft aria-hidden className="size-4" /> Dashboard</Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Post a job</h1>
          <p className="text-ink-soft">Describe the work in plain words. AI splits it into milestones with a checklist you can edit before paying.</p>
        </div>
        <Card className="p-6">
          <form action={createJob} className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="description" className="text-sm font-semibold">What needs to be done?</label>
              <textarea id="description" name="description" required rows={5} className={field}
                placeholder="Build a landing page for my bakery with a menu, opening hours and a contact form." />
              <p className="text-sm text-ink-soft">Websites are checked live by an AI browser; physical jobs (painting, repairs) with before/after photos.</p>
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold">Freelancer</legend>
              {chosen ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand/30 bg-brand-soft/30 p-4">
                  <FreelancerSummary f={chosen} />
                  <input type="hidden" name="freelancerId" value={chosen.id} />
                  <Link href="/freelancers" className="text-sm font-semibold text-brand hover:underline">Change</Link>
                </div>
              ) : (
                <div className="space-y-3">
                  <Link href="/freelancers" className={`${btn.secondary} w-full`}><Users aria-hidden className="size-4" /> Choose from the freelancer directory</Link>
                  {!user.isDemo && (
                    <div className="space-y-1.5">
                      <label htmlFor="freelancerEmail" className="text-sm text-ink-soft">…or invite someone who isn&apos;t on Verifund yet by their PayPal email</label>
                      <input id="freelancerEmail" name="freelancerEmail" type="email" required autoComplete="off" className={field} placeholder="freelancer@example.com" />
                    </div>
                  )}
                </div>
              )}
              <p className="text-sm text-ink-soft">They&apos;ll get an invitation and must accept the milestones before you can fund.</p>
            </fieldset>
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <div className="space-y-1.5">
                <label htmlFor="budget" className="text-sm font-semibold">Total budget</label>
                <input id="budget" name="budget" type="number" min="1" step="0.01" required inputMode="decimal" className={field} placeholder="300" />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="currency" className="text-sm font-semibold">Currency</label>
                <select id="currency" name="currency" className={field}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
              </div>
            </div>
            <SubmitButton className={`${btn.primary} w-full ${!chosen && user.isDemo ? "pointer-events-none opacity-50" : ""}`} pending="AI is drafting milestones…">
              <Sparkles aria-hidden className="size-4" /> Draft milestones with AI
            </SubmitButton>
          </form>
        </Card>
      </main>
    </>
  );
}
