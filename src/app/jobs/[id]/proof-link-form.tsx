"use client";
import { useState, type FormEvent } from "react";
import { Code2, Eye, FlaskConical, Globe, Send } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { CopyId } from "@/components/copy-id";
import { btn, field } from "@/components/ui";
import { checkProofLink } from "@/lib/proof-link";

// The freelancer's link: a live website or a public GitHub repo. Problems are explained here, before a check starts.
export function ProofLinkForm({ action, id, defaultUrl, demo, code, preview = false }: {
  action: (formData: FormData) => void; id: string; defaultUrl?: string; demo: boolean; code: string; preview?: boolean;
}) {
  const [url, setUrl] = useState(defaultUrl ?? "");
  const [touched, setTouched] = useState(false);
  const link = url.trim() ? checkProofLink(url) : null;
  const block = (e: FormEvent) => { if (!link || link.problem) { e.preventDefault(); setTouched(true); } };
  return (
    <div className="space-y-3">
      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <p className="flex gap-2 rounded-lg bg-white/70 p-2.5"><Globe aria-hidden className="mt-0.5 size-4 shrink-0 text-brand" />
          <span><b>Live website</b>: the deployed link (Vercel, Netlify, your domain). The AI opens it in a real browser, visits the pages and tests forms.</span></p>
        <p className="flex gap-2 rounded-lg bg-white/70 p-2.5"><Code2 aria-hidden className="mt-0.5 size-4 shrink-0 text-brand" />
          <span><b>Public GitHub repo</b>: e.g. github.com/you/project (or a folder: /tree/main/web). The AI reads the code. Private repos, GitLab and Bitbucket aren&apos;t supported yet.</span></p>
      </div>
      <form action={action} onSubmit={block} className="flex flex-col gap-3 sm:flex-row">
        <label htmlFor={`url-${id}`} className="sr-only">Website or GitHub repository link</label>
        <input id={`url-${id}`} name="url" required value={url} onChange={(e) => setUrl(e.target.value)} onBlur={() => setTouched(true)}
          placeholder="https://your-site.com or https://github.com/you/project" className={field} aria-describedby={`url-help-${id}`} />
        <SubmitButton className={`${btn.primary} shrink-0`} pending="Submitting…"><Send aria-hidden className="size-4" /> Submit for AI check</SubmitButton>
        {preview && (
          <button type="submit" name="intent" value="preview" className={`${btn.secondary} shrink-0`} title="Runs the same check on work in progress. Nothing about the payment changes.">
            <Eye aria-hidden className="size-4" /> Preview check
          </button>
        )}
      </form>
      {preview && <p className="text-xs text-ink-soft"><b>Preview check</b>: run the AI on a work-in-progress or staging link any time. You and the client see how many items are done; nothing about the payment changes.</p>}
      <p id={`url-help-${id}`} role={link?.problem && touched ? "alert" : undefined} className="text-sm">
        {link?.problem && touched && <span className="text-red-700">{link.problem}</span>}
        {link?.kind === "website" && <span className="text-ink-soft">Detected: <b>website</b>. The AI will check it in a browser.</span>}
        {link?.kind === "repo" && <span className="text-ink-soft">Detected: <b>GitHub repository</b>. The AI will review the code.</span>}
      </p>
      {demo ? (
        <p className="inline-flex items-start gap-1.5 text-xs text-ink-soft"><FlaskConical aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          Demo workspace: any public website or GitHub repo works here; the ownership check is skipped. On a real account you prove it&apos;s yours.</p>
      ) : (
        <details className="text-sm text-ink-soft">
          <summary className="cursor-pointer font-medium text-ink">Prove it&apos;s yours (required)</summary>
          <div className="mt-2 space-y-1.5">
            <p><b>Website:</b> add this tag inside the homepage <code>&lt;head&gt;</code>, or a file <code>.well-known/verifund.txt</code> containing the code:</p>
            <CopyId value={`<meta name="verifund-verification" content="${code}">`} label="Copy verification tag" />
            <p><b>GitHub repo:</b> add a file <code>verifund.txt</code> to the repository root containing the code (or put the code in the README).</p>
            <p>Your code: <CopyId value={code} label="Copy verification code" /></p>
            <p className="text-xs">Verifund&apos;s sample sites are exempt.</p>
          </div>
        </details>
      )}
    </div>
  );
}
