"use client";
import { useActionState } from "react";
import { Scale } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { btn, field } from "@/components/ui";

type Action = (prev: { error?: string }, form: FormData) => Promise<{ error?: string }>;

// Either side asks whether a request is already part of the agreement, or new (paid) work.
export function ScopeAsk({ action, role }: { action: Action; role: "client" | "freelancer" }) {
  const [state, run] = useActionState(action, {});
  return (
    <form action={run} className="space-y-2">
      <label className="block space-y-1 text-sm font-medium">{role === "client" ? "What would you like to add or change?" : "What did the client ask for?"}
        <textarea name="request" required minLength={10} maxLength={500} rows={2} className={field}
          placeholder={role === "client" ? "Can customers order cakes online?" : "The client wants online ordering added."} />
      </label>
      {state.error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{state.error}</p>}
      <SubmitButton className={btn.secondary} pending="The AI is comparing it with the agreement…"><Scale aria-hidden className="size-4" /> Ask the AI</SubmitButton>
    </form>
  );
}
