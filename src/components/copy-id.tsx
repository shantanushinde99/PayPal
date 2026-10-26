"use client";
import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyId({ value, label = `Copy PayPal transaction ID ${value}` }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => { await navigator.clipboard.writeText(value).catch(() => {}); setDone(true); setTimeout(() => setDone(false), 1500); }}
      className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded px-1 text-left font-mono break-all text-xs text-ink-soft hover:bg-canvas hover:text-ink"
      aria-label={label}
    >
      {value}{done ? <Check aria-hidden className="size-3.5 text-emerald-600" /> : <Copy aria-hidden className="size-3.5" />}
    </button>
  );
}
