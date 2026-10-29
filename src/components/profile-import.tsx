"use client";
import { useState, useTransition } from "react";
import { BadgeCheck, Loader2, Sparkles } from "lucide-react";
import { importProfileAction, verifyPortfolioAction, type ImportState } from "@/app/profile/actions";
import { CopyId } from "@/components/copy-id";
import { btn, field } from "@/components/ui";
import type { ImportRole } from "@/lib/profile-import";

const STEPS = ["Opening your site…", "Reading every section…", "Writing your profile…"];

// "Build my profile from a link": reads the user's own site and hands a draft to the form. Nothing is saved here.
export function ProfileImport({ role, initialUrl, onDraft }: { role: ImportRole; initialUrl: string; onDraft: (r: ImportState) => void }) {
  const [url, setUrl] = useState(initialUrl);
  const [error, setError] = useState("");
  const [step, setStep] = useState(0);
  const [pending, start] = useTransition();
  const run = () => start(async () => {
    setError(""); setStep(0);
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 9_000);
    const r = await importProfileAction(url, role).finally(() => clearInterval(t));
    if (r.error) setError(r.error); else if (r.result) onDraft(r.result);
  });
  return (
    <section className="space-y-3 rounded-2xl border border-brand/30 bg-gradient-to-br from-brand-soft/60 to-white p-5">
      <div className="flex items-center gap-2"><Sparkles aria-hidden className="size-5 text-brand" /><h2 className="font-semibold">Build your profile from a link</h2></div>
      <p className="text-sm text-ink-soft">
        {role === "freelancer" ? "Paste your portfolio or personal website. The AI reads it and writes your headline, bio and skills." : "Paste your company's website. The AI fills in your company name."}
        {" "}You check everything before it&apos;s saved.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="import-url" className="sr-only">Website link</label>
        <input id="import-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder={role === "freelancer" ? "https://you.dev" : "https://yourcompany.com"} className={field} disabled={pending} />
        <button type="button" onClick={run} disabled={pending || !url.trim()} className={`${btn.primary} shrink-0`}>
          {pending ? <><Loader2 aria-hidden className="size-4 animate-spin" /> {STEPS[step]}</> : <><Sparkles aria-hidden className="size-4" /> Build my profile</>}
        </button>
      </div>
      {pending && <p className="text-xs text-ink-soft">This takes about 30–60 seconds.</p>}
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
    </section>
  );
}

// The "Verified owner" badge: the user's own code on the portfolio proves the site is theirs.
export function PortfolioOwnership({ code, savedUrl, verified: initial }: { code: string; savedUrl: string | null; verified: boolean }) {
  const [verified, setVerified] = useState(initial);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  if (!savedUrl) return null;
  if (verified) return <p className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-800"><BadgeCheck aria-hidden className="size-4" /> Verified owner of this portfolio</p>;
  const check = () => start(async () => {
    const r = await verifyPortfolioAction();
    if (r.error) setMsg(r.error); else if (r.verified) setVerified(true); else setMsg("Your code isn't on the site yet. Deploy the change and check again.");
  });
  return (
    <details className="rounded-lg bg-canvas p-3 text-sm">
      <summary className="cursor-pointer font-medium">Get a <span className="text-emerald-700">✓ Verified owner</span> badge in the freelancer directory</summary>
      <div className="mt-2 space-y-1.5 text-ink-soft">
        <p>Add this tag inside your portfolio&apos;s <code>&lt;head&gt;</code>, or a file <code>.well-known/verifund.txt</code> containing the code:</p>
        <CopyId value={`<meta name="verifund-verification" content="${code}">`} label="Copy verification tag" />
        <p>Code only: <CopyId value={code} label="Copy verification code" /></p>
        <button type="button" onClick={check} disabled={pending} className={btn.secondary}>{pending ? <><Loader2 aria-hidden className="size-4 animate-spin" /> Checking…</> : "Check again"}</button>
        {msg && <p role="status">{msg}</p>}
      </div>
    </details>
  );
}
