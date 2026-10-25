import Link from "next/link";
import { requireUser } from "@/lib/session";
import { formatMoney, toPayPalValue } from "@/lib/money";
import { saveMilestone, fundMilestone, cancelMilestone, submitProof, retryRelease } from "../actions";
import { AutoRefresh } from "./auto-refresh";
import { loadJobForUser } from "../load";

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { job, role, milestones } = await loadJobForUser((await params).id, user);

  return (
    <main className="mx-auto max-w-3xl p-8 space-y-6">
      <AutoRefresh active={milestones.some((m) => m.state === "verifying" || m.state === "passed")} />
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

          {role === "client" && ["draft", "funding"].includes(m.state) && (
            <form action={fundMilestone.bind(null, m.id)}>
              <button className="rounded bg-[#0070ba] px-4 py-2 text-white">Fund {formatMoney(m.amountMinor, job.currency)} with PayPal</button>
            </form>
          )}
          {role === "client" && ["draft", "funding", "funded", "failed"].includes(m.state) && (
            <form action={cancelMilestone.bind(null, m.id)}>
              <button className="text-sm text-red-600 underline">Cancel milestone{m.authorizationId ? " & release hold" : ""}</button>
            </form>
          )}
          {role === "freelancer" && ["funded", "failed"].includes(m.state) && (
            <form action={submitProof.bind(null, m.id)} className="flex gap-2">
              <input name="url" type="url" required placeholder="https://your-site.com" defaultValue={m.submission?.url}
                className="flex-1 rounded border p-2" />
              <button className="rounded bg-black px-4 py-2 text-white">Submit for AI check</button>
            </form>
          )}
          {role === "client" && m.state === "passed" && (
            <form action={retryRelease.bind(null, m.id)}><button className="rounded border px-3 py-1">Retry payment</button></form>
          )}
          {m.failReason && <p className="text-amber-700">⚠️ {m.failReason}</p>}

          {m.verdict.length > 0 && (
            <ul className="space-y-1">
              {m.checklist.map((c) => {
                const v = m.verdict.find((x) => x.checklistItemId === c.id);
                const icon = v?.status === "pass" ? "✅" : v?.status === "fail" ? "❌" : "❔";
                return <li key={c.id}>{icon} <b>{c.requirement}</b> — <span className="text-gray-600">{v?.reason}</span></li>;
              })}
            </ul>
          )}

          {m.events.length > 0 && (
            <details open={m.state === "verifying"} className="text-sm">
              <summary className="cursor-pointer text-gray-500">Activity ({m.events.length})</summary>
              <ol className="mt-2 space-y-2">
                {m.events.map((e) => (
                  <li key={e.id}>
                    <span className="text-gray-400">{e.createdAt.toLocaleTimeString()}</span>{" "}
                    <span className={e.kind === "error" ? "text-red-600" : e.kind === "payment" ? "text-green-700 font-medium" : ""}>{e.message}</span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {e.image && <img src={`data:image/jpeg;base64,${e.image}`} alt="What the AI saw" className="mt-1 max-h-48 rounded border" />}
                  </li>
                ))}
              </ol>
            </details>
          )}
        </section>
      ))}
    </main>
  );
}
