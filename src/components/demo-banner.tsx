import Link from "next/link";
import { ArrowLeftRight, FlaskConical, Info, KeyRound, LogOut } from "lucide-react";
import type { User } from "@/db/schema";
import { env } from "@/lib/env";
import { exitDemo, switchDemoSide } from "@/app/demo/actions";
import { SubmitButton } from "@/components/submit-button";
import { CopyId } from "@/components/copy-id";

const SITES = "https://shantanushinde99.github.io/verifund-demo-sites";

export function DemoBanner({ user }: { user: User }) {
  if (!user.isDemo) return null;
  const isClient = user.roles.includes("client");
  return (
    <div className="border-b border-amber-200 bg-amber-50 text-amber-950">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5 text-sm">
        <span className="inline-flex items-center gap-1.5 font-semibold"><FlaskConical aria-hidden className="size-4" /> Demo workspace · you&apos;re {user.displayName} ({isClient ? "client" : "freelancer"})</span>
        <form action={switchDemoSide}>
          <SubmitButton className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full bg-amber-900 px-3 text-xs font-semibold text-white hover:bg-amber-800" pending="Switching…">
            <ArrowLeftRight aria-hidden className="size-3.5" /> Switch to the {isClient ? "freelancer" : "client"} side
          </SubmitButton>
        </form>
        {isClient && env.DEMO_BUYER_EMAIL && (
          <span className="inline-flex flex-wrap items-center gap-1"><KeyRound aria-hidden className="size-4" /> PayPal sandbox buyer: <CopyId value={env.DEMO_BUYER_EMAIL} />{env.DEMO_BUYER_PASSWORD && <> / <CopyId value={env.DEMO_BUYER_PASSWORD} /></>}</span>
        )}
        {!isClient && (
          <span className="inline-flex flex-wrap items-center gap-1">Proof to submit: <CopyId value={`${SITES}/bakery-v1/`} /> (broken) then <CopyId value={`${SITES}/bakery-v2/`} /> (fixed)</span>
        )}
        <Link href="/welcome" className="ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-amber-950 underline-offset-2 hover:underline">
          <Info aria-hidden className="size-3.5" /> About Verifund
        </Link>
        <form action={exitDemo}>
          <SubmitButton className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border border-amber-900/30 px-3 text-xs font-semibold text-amber-950 hover:bg-amber-100" pending="Leaving…">
            <LogOut aria-hidden className="size-3.5" /> Exit demo
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}
