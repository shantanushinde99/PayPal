"use client";
import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

// Shows a spinner while the parent form's server action runs.
export function SubmitButton({ children, pending, className }: { children: ReactNode; pending?: string; className: string }) {
  const { pending: busy } = useFormStatus();
  return (
    <button type="submit" disabled={busy} className={className} aria-busy={busy}>
      {busy && <Loader2 aria-hidden className="size-4 animate-spin" />}
      {busy && pending ? pending : children}
    </button>
  );
}
