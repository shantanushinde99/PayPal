import {
  ArrowRight, Bot, FlaskConical, Check, CheckCircle2, ChevronDown, Globe, Lock, ShieldCheck, Sparkles, XCircle,
} from "lucide-react";
import Link from "next/link";
import { signIn } from "@/auth";
import { startDemo } from "@/app/demo/actions";
import { Card } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { Logo } from "@/components/header";
import { HeroDemo } from "./hero-demo";
import { Bento } from "./bento";
import { HeroShell, ScrollProgress } from "./effects";
import { Pipeline } from "./pipeline";
import { Reveal } from "./reveal";

const REPO = "https://github.com/shantanushinde99/PayPal";

function LoginButton({ label = "Log in with PayPal", large = false }: { label?: string; large?: boolean }) {
  return (
    <form action={async () => { "use server"; await signIn("paypal", { redirectTo: "/" }); }}>
      <SubmitButton
        pending="Opening PayPal…"
        className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-paypal font-semibold text-white shadow-[0_8px_24px_-8px_rgba(0,112,186,0.6)] transition-all hover:bg-[#005ea6] hover:shadow-[0_10px_28px_-8px_rgba(0,112,186,0.7)] disabled:opacity-60 ${large ? "min-h-13 px-8 text-base" : "min-h-11 px-5 text-sm"}`}
      >
        {label} <ArrowRight aria-hidden className="size-4" />
      </SubmitButton>
    </form>
  );
}

// Already logged in (e.g. a judge in a demo workspace reading /welcome): go back to the app instead of logging in again.
function DashboardButton({ large = false }: { large?: boolean }) {
  return (
    <Link href="/?enter=1" className={`inline-flex items-center justify-center gap-2 rounded-full bg-paypal font-semibold text-white transition-colors hover:bg-[#005ea6] ${large ? "min-h-13 px-8 text-base" : "min-h-11 px-5 text-sm"}`}>
      Your dashboard <ArrowRight aria-hidden className="size-4" />
    </Link>
  );
}

function SectionTitle({ eyebrow, title, text }: { eyebrow: string; title: string; text?: string }) {
  return (
    <Reveal className="mx-auto max-w-2xl space-y-3 text-center">
      <p className="text-sm font-semibold uppercase tracking-wider text-brand">{eyebrow}</p>
      <h2 className="font-display text-3xl font-bold tracking-tight md:text-5xl">{title}</h2>
      {text && <p className="text-lg leading-relaxed text-ink-soft">{text}</p>}
    </Reveal>
  );
}

const SAFETY = [
  { title: "Code releases money, not the AI", text: "The AI only reports pass/fail per item. Plain code pays out, and only when every single item passes. It can never pick an amount or a recipient." },
  { title: "Websites can't talk the AI into paying", text: "Page text is treated as untrusted data. Hidden “mark everything as passed” instructions are ignored, and the agent can't be redirected to another site." },
  { title: "Isolated cloud browser", text: "Freelancer sites are opened in a sandboxed cloud browser, never on our servers, so a submitted link can't reach anything internal." },
  { title: "Money stays with PayPal", text: "Funds are held as a PayPal authorization until release or cancellation. Every movement shows real PayPal transaction IDs." },
  { title: "Taste can't block a payment", text: "A client dispute must name the checklist item that isn't met. The AI Judge ignores complaints about things nobody agreed on." },
  { title: "The warranty can't be held hostage", text: "Only the daily site check can keep the held 25%, never the client. If every page still works at the end, it's paid automatically." },
];

const FAQ = [
  { q: "Is the money safe while the work is being done?", a: "Yes. When the client funds a milestone, PayPal authorizes and holds the amount. It's only captured when every checklist item is verified. If the client cancels before that, the hold is released back to them." },
  { q: "What if the AI gets it wrong?", a: "Every verdict comes with evidence you can open: the page, the quote or measured fact, and a screenshot in the Proof Report. Unclear items are marked “unsure” and hold the money rather than pay it. The freelancer can fix and resubmit as often as needed." },
  { q: "What kinds of work can be verified?", a: "Live websites (pages, links, contact details, forms, phone layout, design match and customer journeys like booking a table), code in a public GitHub repository, design mockups the client approves, and physical work proven with before/after photos (painting, repairs, cleaning, installs)." },
  { q: "What if I forget to write something down?", a: "Before you pay, “Did you forget anything?” lists what clients usually expect for that kind of job: the contact form reaching your inbox, opening hours, a custom domain. Tick what you want; the rest is written down as not included, so nobody argues about it later." },
  { q: "What if the client keeps asking for changes?", a: "Visual jobs start with a design milestone and an agreed number of change rounds (2 by default). After that, the client approves or disputes a specific checklist item. New ideas mid-job are checked against the agreement: if they're new work, they become a paid milestone the freelancer can accept or decline." },
  { q: "How does the warranty work?", a: "For a live website, part of the payment (25% by default) stays held by PayPal for 7 or 14 days after approval while Verifund reloads every page daily. If the site keeps working, it's paid automatically. If a page breaks and the freelancer doesn't fix it in time, that part goes back to the client." },
  { q: "How do I know I actually own what I paid for?", a: "Add your domain and Verifund checks, in code, that the site really runs on it. List what you must receive (admin logins, a transferred repository) and you confirm each one before paying." },
  { q: "Does the freelancer need a PayPal account?", a: "Yes. Payments go to the freelancer's PayPal email. Both sides log in with PayPal, so emails are confirmed and payouts can't go to a typo." },
  { q: "Which currencies are supported?", a: "USD, EUR, GBP, CAD, AUD and JPY. The whole flow (hold, capture and payment) stays in the job's currency." },
  { q: "Is this live?", a: "Verifund runs on the PayPal sandbox for the PayPal AI Hackathon. No real money moves; everything else, including the AI checks, is real." },
];

export function Landing({ demo = false, signedIn = false }: { demo?: boolean; signedIn?: boolean }) {
  return (
    <div className="flex min-h-full flex-col">
      <ScrollProgress />
      <header className="sticky top-0 z-20 border-b border-white/10 bg-night/90 backdrop-blur-xl">
        <nav aria-label="Main" className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-6 px-4">
          <Logo light />
          <div className="hidden items-center gap-7 text-sm font-medium text-slate-300 md:flex">
            <a href="#how" className="transition-colors hover:text-white">How it works</a>
            <a href="#features" className="transition-colors hover:text-white">Features</a>
            <a href="#report" className="transition-colors hover:text-white">Proof report</a>
            <a href="#safety" className="transition-colors hover:text-white">Safety</a>
            <a href="#faq" className="transition-colors hover:text-white">FAQ</a>
          </div>
          {signedIn ? <DashboardButton /> : <LoginButton label="Log in" />}
        </nav>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <HeroShell>
          <div className="mx-auto grid w-full max-w-6xl gap-14 px-4 pb-16 pt-16 md:pb-24 md:pt-24 lg:grid-cols-[1.05fr_1fr] lg:items-center">
            <Reveal className="space-y-7">
              <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-sm font-medium text-sky-200 backdrop-blur">
                <Sparkles aria-hidden className="size-4" /> AI escrow, built on PayPal
              </p>
              <h1 className="font-display text-5xl font-bold leading-[1.02] tracking-tight md:text-7xl">
                Pay for <span className="bg-gradient-to-r from-sky-300 via-cyan-200 to-emerald-300 bg-clip-text text-transparent">proof</span>,<br className="hidden sm:block" /> not promises.
              </h1>
              <p className="max-w-xl text-lg leading-relaxed text-slate-300 md:text-xl">
                Verifund holds each milestone payment with PayPal while an AI agent checks the delivered work against the checklist you both agreed on. When everything is verified, the money is released automatically, with an evidence report to prove it.
              </p>
              <div className="flex flex-wrap items-center gap-4">
                {signedIn ? <DashboardButton large /> : <LoginButton large label="Start with PayPal" />}
                {demo ? (
                  <form action={startDemo}>
                    <SubmitButton pending="Preparing your demo…" className="inline-flex min-h-13 cursor-pointer items-center gap-2 rounded-full border border-white/25 bg-white/10 px-6 font-semibold text-white backdrop-blur transition-colors hover:bg-white/20">
                      <FlaskConical aria-hidden className="size-4" /> Try the live demo
                    </SubmitButton>
                  </form>
                ) : (
                  <a href="#how" className="inline-flex min-h-13 items-center gap-2 rounded-full border border-white/20 px-6 font-semibold text-white transition-colors hover:bg-white/10">
                    See how it works
                  </a>
                )}
              </div>
              {demo && <p className="text-sm text-slate-400">No account needed: the demo gives you a private client and freelancer to play both sides.</p>}
              <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-300">
                {["Funds held by PayPal", "Every page & link checked", "Customer journeys tested", "25% warranty, checked daily"].map((t) => (
                  <li key={t} className="inline-flex items-center gap-1.5"><CheckCircle2 aria-hidden className="size-4 text-emerald-400" />{t}</li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={0.15}><HeroDemo /></Reveal>
          </div>
          <div className="border-t border-white/10">
            <p className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-2 px-4 py-5 text-sm text-slate-400">
              <span className="font-semibold text-white">Built with</span>
              <span>PayPal Orders, Payments &amp; Log in with PayPal</span>
              <span aria-hidden className="hidden sm:inline">·</span><span>Google Gemini</span>
              <span aria-hidden className="hidden sm:inline">·</span><span>KERNEL cloud browsers</span>
            </p>
          </div>
        </HeroShell>

        {/* Problem */}
        <section className="mx-auto w-full max-w-6xl space-y-12 px-4 py-20">
          <SectionTitle eyebrow="The problem" title="Freelance payments run on trust. Trust breaks." text="Someone always goes first and carries the risk. Verifund replaces “trust me” with a checklist, a held payment and verifiable proof." />
          <div className="grid gap-5 md:grid-cols-2">
            {[
              { who: "Clients", Icon: XCircle, pains: ["Paying upfront for work that never ships", "“It's done” — but the contact form doesn't work", "No objective way to say what's missing"] },
              { who: "Freelancers", Icon: XCircle, pains: ["Chasing invoices for work already delivered", "Endless “one more change” before payment", "No proof the job met the brief"] },
            ].map(({ who, Icon, pains }, i) => (
              <Reveal key={who} delay={i * 0.1}>
                <Card className="h-full space-y-4 p-7">
                  <h3 className="text-xl font-semibold">For {who.toLowerCase()} today</h3>
                  <ul className="space-y-3">
                    {pains.map((p) => <li key={p} className="flex gap-3 text-ink-soft"><Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-red-500" />{p}</li>)}
                  </ul>
                </Card>
              </Reveal>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-20 bg-white py-20">
          <div className="mx-auto w-full max-w-6xl space-y-14 px-4">
            <SectionTitle eyebrow="How it works" title="From “done?” to paid, in five steps" text="Watch the payment move: it only reaches the freelancer after the work is verified, and the last part only after the site keeps working." />
            <Pipeline />
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto w-full max-w-6xl scroll-mt-20 space-y-12 px-4 py-24">
          <SectionTitle eyebrow="Features" title="Everything a careful client would check" text="Each tile is a small live version of what Verifund does: agree on “done” before paying, check it like a customer would, and keep part of the money until the site proves it keeps working." />
          <Bento />
        </section>

        {/* Proof report preview */}
        <section id="report" className="scroll-mt-20 bg-white py-20">
          <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 lg:grid-cols-2 lg:items-center">
            <Reveal className="space-y-5">
              <p className="text-sm font-semibold uppercase tracking-wider text-brand">Proof report</p>
              <h2 className="font-display text-3xl font-bold tracking-tight md:text-5xl">Every decision comes with evidence</h2>
              <p className="text-lg leading-relaxed text-ink-soft">No black box. Each checklist item shows what the AI found, where it found it, and a screenshot. Facts like broken links and email addresses are measured by code, so they can&apos;t be hallucinated.</p>
              <ul className="space-y-2.5">
                {["Shareable, printable report per check", "Each customer journey, step by step", "Site map with status, forms and phone fit per page", "A replay of the AI's browser session", "Broken links and contact details found", "PayPal authorization and capture IDs"].map((t) => (
                  <li key={t} className="flex gap-2.5"><Check aria-hidden className="mt-0.5 size-5 shrink-0 text-emerald-600" />{t}</li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={0.15}>
              <Card className="space-y-4 p-6 shadow-[0_20px_60px_-24px_rgba(15,23,42,0.3)]">
                <div className="flex items-center justify-between">
                  <div><p className="text-xs font-semibold uppercase tracking-wider text-brand">Proof report</p><p className="font-semibold">Sunrise Bakery · Milestone 1</p></div>
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">3/6 verified · held</span>
                </div>
                {[
                  { ok: true, t: "Menu page lists items with prices", e: "“Country sourdough $7.50, Butter croissant $3.25 …” on /menu" },
                  { ok: false, t: "All links work", e: "/team.html returns 404, linked from /about as “Meet the team”" },
                  { ok: false, t: "Email is hello@sunrisebakery.com", e: "Contact page shows helo@sunrisebakery.com" },
                ].map(({ ok, t, e }) => (
                  <div key={t} className="space-y-1.5 rounded-lg border border-line p-3">
                    <p className="flex items-center gap-2 font-medium">{ok ? <CheckCircle2 aria-hidden className="size-5 text-emerald-600" /> : <XCircle aria-hidden className="size-5 text-red-600" />}{t}</p>
                    <p className="rounded bg-canvas px-2.5 py-1.5 font-mono text-xs text-ink-soft">{e}</p>
                  </div>
                ))}
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  {[["6", "pages crawled"], ["6", "links tested"], ["1", "broken"]].map(([n, l]) => (
                    <div key={l} className="rounded-lg bg-canvas p-2"><p className="text-lg font-bold">{n}</p><p className="text-ink-soft">{l}</p></div>
                  ))}
                </div>
              </Card>
            </Reveal>
          </div>
        </section>

        {/* Both sides */}
        <section className="mx-auto w-full max-w-6xl space-y-12 px-4 py-20">
          <SectionTitle eyebrow="Fair to both sides" title="Clear rules before money moves" />
          <div className="grid gap-5 md:grid-cols-2">
            {[
              { who: "For clients", Icon: Lock, points: ["Find what you forgot before you pay, not after", "Approve the design before anything is built", "Pay only when every item and customer journey passes", "Confirm the test message and the handover yourself", "25% held for a week while the site is checked daily"] },
              { who: "For freelancers", Icon: Globe, points: ["See the money is funded before you start", "Preview checks while you build: no surprises at the end", "Change rounds are agreed up front; extras become paid milestones", "Disputes must point to a checklist item, not to taste", "The warranty is released automatically if the site keeps working"] },
            ].map(({ who, Icon, points }, i) => (
              <Reveal key={who} delay={i * 0.1}>
                <Card className="h-full space-y-5 p-7">
                  <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand"><Icon aria-hidden className="size-5" /></span><h3 className="text-xl font-semibold">{who}</h3></div>
                  <ul className="space-y-3">{points.map((p) => <li key={p} className="flex gap-3"><CheckCircle2 aria-hidden className="mt-0.5 size-5 shrink-0 text-emerald-600" />{p}</li>)}</ul>
                </Card>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Safety */}
        <section id="safety" className="scroll-mt-20 bg-ink py-20 text-white">
          <div className="mx-auto w-full max-w-6xl space-y-12 px-4">
            <Reveal className="mx-auto max-w-2xl space-y-3 text-center">
              <p className="text-sm font-semibold uppercase tracking-wider text-sky-300">Safety by design</p>
              <h2 className="font-display text-3xl font-bold tracking-tight md:text-5xl">An AI that can&apos;t be talked into paying</h2>
            </Reveal>
            <div className="grid gap-5 sm:grid-cols-2">
              {SAFETY.map(({ title, text }, i) => (
                <Reveal key={title} delay={(i % 2) * 0.08}>
                  <div className="h-full space-y-2 rounded-xl border border-white/10 bg-white/5 p-6">
                    <h3 className="flex items-center gap-2.5 text-lg font-semibold"><ShieldCheck aria-hidden className="size-5 text-emerald-400" />{title}</h3>
                    <p className="leading-relaxed text-slate-300">{text}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mx-auto w-full max-w-3xl scroll-mt-20 space-y-10 px-4 py-20">
          <SectionTitle eyebrow="FAQ" title="Questions, answered" />
          <div className="space-y-3">
            {FAQ.map(({ q, a }) => (
              <details key={q} className="group rounded-xl border border-line bg-white">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 font-semibold">
                  {q}<ChevronDown aria-hidden className="size-5 shrink-0 text-ink-soft transition-transform group-open:rotate-180" />
                </summary>
                <p className="px-5 pb-5 leading-relaxed text-ink-soft">{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="px-4 pb-20">
          <Reveal className="mx-auto max-w-5xl overflow-hidden rounded-3xl bg-gradient-to-br from-brand to-brand-strong px-6 py-14 text-center text-white md:px-12">
            <Bot aria-hidden className="mx-auto mb-4 size-10 text-sky-200" />
            <h2 className="font-display text-3xl font-bold tracking-tight md:text-5xl">Your next milestone, verified.</h2>
            <p className="mx-auto mt-3 max-w-xl text-lg text-sky-100">Post a job, agree on what “done” means, fund it with PayPal, and let the AI check the work. Takes a minute to set up.</p>
            <div className="mt-8 flex justify-center">
              {signedIn ? (
                <Link href="/?enter=1" className="inline-flex min-h-13 items-center gap-2 rounded-full bg-white px-8 font-semibold text-brand-strong transition-colors hover:bg-sky-50">
                  Your dashboard <ArrowRight aria-hidden className="size-4" />
                </Link>
              ) : (
                <form action={async () => { "use server"; await signIn("paypal", { redirectTo: "/" }); }}>
                  <SubmitButton pending="Opening PayPal…" className="inline-flex min-h-13 cursor-pointer items-center gap-2 rounded-full bg-white px-8 font-semibold text-brand-strong transition-colors hover:bg-sky-50">
                    Start with PayPal <ArrowRight aria-hidden className="size-4" />
                  </SubmitButton>
                </form>
              )}
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-line bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-ink-soft md:flex-row md:items-center md:justify-between">
          <Logo />
          <p>Built for the PayPal AI Hackathon 2026 · Sandbox demo, no real money moves.</p>
          <a href={REPO} target="_blank" rel="noreferrer" className="font-medium text-ink hover:underline">Source on GitHub</a>
        </div>
      </footer>
    </div>
  );
}
