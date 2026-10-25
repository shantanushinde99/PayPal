import Link from "next/link";
import { requireUser } from "@/lib/session";
import { formatMoney, toPayPalValue } from "@/lib/money";
import { saveMilestone } from "../actions";
import { loadJobForUser } from "../load";

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { job, role, milestones } = await loadJobForUser((await params).id, user);

  return (
    <main className="mx-auto max-w-3xl p-8 space-y-6">
      <Link href="/" className="text-sm underline">← Dashboard</Link>
      <h1 className="text-2xl font-bold">{job.title}</h1>
      <p className="text-gray-600 whitespace-pre-wrap">{job.description}</p>
      <p className="text-sm">You are the <b>{role}</b> · Freelancer: {job.freelancerEmail}</p>

      {milestones.map((m) => (
        <section key={m.id} className="rounded border p-4 space-y-3">
          <div className="flex justify-between">
            <h2 className="font-semibold">{m.position + 1}. {m.title}</h2>
            <span>{formatMoney(m.amountMinor, job.currency)} · <code>{m.state}</code></span>
          </div>

          {role === "client" && m.state === "draft" ? (
            <form action={saveMilestone.bind(null, m.id)} className="space-y-2">
              <input name="title" defaultValue={m.title} className="w-full rounded border p-2" />
              <input name="amount" type="number" step="0.01" defaultValue={toPayPalValue(m.amountMinor, job.currency)} className="rounded border p-2" />
              <textarea name="checklist" rows={5} className="w-full rounded border p-2"
                defaultValue={m.checklist.map((c) => c.requirement).join("\n")} />
              <button className="rounded border px-3 py-1">Save checklist</button>
            </form>
          ) : (
            <ul className="list-disc pl-5">{m.checklist.map((c) => <li key={c.id}>{c.requirement}</li>)}</ul>
          )}
        </section>
      ))}
    </main>
  );
}
