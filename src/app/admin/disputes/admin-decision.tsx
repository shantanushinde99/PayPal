"use client";
import { useActionState, useState } from "react";
import type { DisputeState } from "@/app/jobs/dispute-actions";
import { SubmitButton } from "@/components/submit-button";
import { btn, field } from "@/components/ui";

export function AdminDecision({ action, defaultShare }: { action: (p: DisputeState, f: FormData) => Promise<DisputeState>; defaultShare: number }) {
  const [state, run] = useActionState(action, {});
  const [share, setShare] = useState(defaultShare);
  return (
    <form action={run} className="space-y-3">
      <label className="block space-y-1 text-sm font-medium">Freelancer&apos;s share: {share}%
        <input type="range" name="share" min={0} max={100} step={5} value={share} onChange={(e) => setShare(Number(e.target.value))} className="w-full" />
      </label>
      <label className="block space-y-1 text-sm font-medium">Note to both sides
        <textarea name="note" rows={2} maxLength={1000} className={field} placeholder="Why this split." />
      </label>
      {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      <SubmitButton className={btn.primary} pending="Settling…">Settle: {share}% to freelancer</SubmitButton>
    </form>
  );
}
