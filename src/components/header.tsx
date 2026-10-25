import Link from "next/link";
import { LogOut, ShieldCheck } from "lucide-react";
import { signOut } from "@/auth";

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className={`inline-flex items-center gap-2 font-display text-lg font-bold tracking-tight ${light ? "text-white" : "text-ink"}`}>
      <span className="grid size-8 place-items-center rounded-lg bg-brand text-white"><ShieldCheck aria-hidden className="size-5" /></span>
      Verifund
    </Link>
  );
}

export function Header({ email }: { email?: string }) {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        <Logo />
        {email && (
          <form action={async () => { "use server"; await signOut({ redirectTo: "/" }); }} className="flex items-center gap-3">
            <span className="hidden text-sm text-ink-soft sm:inline">{email}</span>
            <button className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-ink-soft transition-colors hover:bg-canvas hover:text-ink">
              <LogOut aria-hidden className="size-4" /> Log out
            </button>
          </form>
        )}
      </div>
    </header>
  );
}
