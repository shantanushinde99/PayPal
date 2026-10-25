import Link from "next/link";
import { LayoutDashboard, LogOut, UserRound, Users, Wallet } from "lucide-react";
import { LogoMark } from "@/components/logo-mark";
import { signOut } from "@/auth";
import type { User } from "@/db/schema";
import { currentView } from "@/lib/view";
import { setView } from "@/app/view/actions";
import { DemoBanner } from "@/components/demo-banner";

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className={`inline-flex items-center gap-2 font-display text-lg font-bold tracking-tight ${light ? "text-white" : "text-ink"}`}>
      <LogoMark />
      Verifund
    </Link>
  );
}

const link = "inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-ink-soft transition-colors hover:bg-canvas hover:text-ink";

export async function Header({ user }: { user?: User }) {
  const view = user ? await currentView(user) : null;
  const both = user && user.roles.length > 1;
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-2 px-4">
        <Logo />
        {user && (
          <nav aria-label="Account" className="flex items-center gap-0.5 text-sm font-medium">
            <Link href="/" className={link}><LayoutDashboard aria-hidden className="size-4" /><span className="hidden md:inline">Dashboard</span></Link>
            {view === "client" && <Link href="/freelancers" className={link}><Users aria-hidden className="size-4" /><span className="hidden md:inline">Freelancers</span></Link>}
            <Link href="/wallet" className={link}><Wallet aria-hidden className="size-4" /><span className="hidden md:inline">Wallet</span></Link>
            <Link href="/profile" className={link}><UserRound aria-hidden className="size-4" /><span className="hidden md:inline">Profile</span></Link>
          </nav>
        )}
        {user && (
          <div className="flex items-center gap-2">
            {both && (
              <div role="group" aria-label="Switch view" className="hidden rounded-full border border-line p-0.5 text-xs font-semibold sm:flex">
                {(["client", "freelancer"] as const).map((v) => (
                  <form key={v} action={setView.bind(null, v)}>
                    <button aria-pressed={view === v} className={`min-h-9 cursor-pointer rounded-full px-3 capitalize ${view === v ? "bg-ink text-white" : "text-ink-soft hover:text-ink"}`}>{v}</button>
                  </form>
                ))}
              </div>
            )}
            <span className="hidden text-sm text-ink-soft lg:inline">{user.displayName ?? user.email}</span>
            <form action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}>
              <button aria-label="Log out" className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-ink-soft transition-colors hover:bg-canvas hover:text-ink">
                <LogOut aria-hidden className="size-4" /><span className="hidden sm:inline">Log out</span>
              </button>
            </form>
          </div>
        )}
      </div>
      {user && <DemoBanner user={user} />}
    </header>
  );
}
