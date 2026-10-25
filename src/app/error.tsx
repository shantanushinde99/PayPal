"use client";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto grid min-h-[60vh] max-w-md place-items-center px-4 text-center">
      <div className="space-y-4">
        <AlertTriangle aria-hidden className="mx-auto size-10 text-amber-600" />
        <h1 className="text-xl font-semibold">Something didn&apos;t work</h1>
        <p className="text-ink-soft">{error.message || "Please try again."}</p>
        <div className="flex justify-center gap-3">
          <button onClick={reset} className="min-h-11 cursor-pointer rounded-lg bg-brand px-4 font-semibold text-white">Try again</button>
          <Link href="/" className="inline-flex min-h-11 items-center rounded-lg border border-line px-4 font-medium">Dashboard</Link>
        </div>
      </div>
    </main>
  );
}
