"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { BASE, FAQ, type CatalogueTour } from "./data";
import { Price, useApp } from "./providers";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const ref = (p: string) => p + "-" + Math.random().toString(36).slice(2, 7).toUpperCase();

// The catalogue isn't in the HTML: it's fetched after the page loads, like most React apps do.
function useCatalogue() {
  const [tours, setTours] = useState<CatalogueTour[] | null>(null);
  useEffect(() => { fetch(`${BASE}/tours.json`).then((r) => r.json()).then(setTours).catch(() => setTours([])); }, []);
  return tours;
}

export function SearchForm() {
  const router = useRouter();
  const go = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = new URLSearchParams([...new FormData(e.currentTarget)].filter(([, v]) => v) as [string, string][]);
    router.push(`/tours/${q.size ? "?" + q : ""}`);
  };
  return (
    <form className="search" role="search" onSubmit={go}>
      <select name="region" aria-label="Destination"><option value="">Anywhere</option><option>Japan</option><option>Peru</option><option>Iceland</option></select>
      <select name="max" aria-label="Budget"><option value="">Any budget</option><option value="2000">Under $2,000</option><option value="3000">Under $3,000</option></select>
      <select name="sort" aria-label="Sort"><option value="rating">Top rated</option><option value="price">Lowest price</option></select>
      <button className="btn" type="submit">Find tours</button>
    </form>
  );
}

const BADGE: Record<string, [string, string]> = { "sold-out": ["badge out", "Sold out"], "coming-soon": ["badge soon", "Coming soon"] };

export function ToursList() {
  const params = useSearchParams();
  const tours = useCatalogue();
  const [f, setF] = useState({ region: params.get("region") ?? "", max: params.get("max") ?? "", sort: params.get("sort") ?? "rating", available: false });
  const list = useMemo(() => (tours ?? [])
    .filter((t) => (!f.region || t.region === f.region) && (!f.max || t.priceUsd <= +f.max) && (!f.available || t.status === "available"))
    .sort((a, b) => f.sort === "price" ? a.priceUsd - b.priceUsd : f.sort === "days" ? a.days - b.days : b.rating - a.rating), [tours, f]);
  return (
    <>
      <p className="lead">{tours ? `${list.length} of ${tours.length} tours` : "Loading tours…"}</p>
      <div className="filters">
        <label>Destination<select value={f.region} onChange={(e) => setF({ ...f, region: e.target.value })}><option value="">All</option><option>Japan</option><option>Peru</option><option>Iceland</option></select></label>
        <label>Max price (USD)<input type="number" min={0} step={100} placeholder="Any" value={f.max} onChange={(e) => setF({ ...f, max: e.target.value })} /></label>
        <label>Sort by<select value={f.sort} onChange={(e) => setF({ ...f, sort: e.target.value })}><option value="rating">Top rated</option><option value="price">Lowest price</option><option value="days">Shortest</option></select></label>
        <label><span><input type="checkbox" checked={f.available} onChange={(e) => setF({ ...f, available: e.target.checked })} /> Only bookable</span></label>
      </div>
      <div className="cards" aria-live="polite">
        {tours && !list.length && <p>No tours match these filters.</p>}
        {list.map((t) => (
          <article className="card" key={t.slug}><div className="body">
            <span><span className="badge">{t.region}</span> {BADGE[t.status] && <span className={BADGE[t.status][0]}>{BADGE[t.status][1]}</span>}</span>
            <h3>{t.title}</h3><p>{t.summary}</p><p className="meta">{t.days} days · ★ {t.rating}</p>
            <p>From <Price usd={t.priceUsd} /></p>
            {t.status === "available" ? <Link className="btn alt" href={`/tours/${t.slug}/`}>View tour</Link> : <button className="btn" disabled>Not bookable</button>}
          </div></article>
        ))}
      </div>
    </>
  );
}

type Errors = Record<string, string>;
export function BookingWizard() {
  const params = useSearchParams();
  const tours = useCatalogue();
  const { price } = useApp();
  const [step, setStep] = useState(1);
  const [v, setV] = useState({ tour: params.get("tour") ?? "", start: "", people: "2", name: "", email: "", phone: "", country: "", terms: false });
  const [err, setErr] = useState<Errors>({});
  const [done, setDone] = useState<string | null>(null);
  const minDate = useMemo(() => new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10), []);
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });
  const tour = tours?.find((t) => t.slug === v.tour);
  const total = tour ? tour.priceUsd * +v.people : 0;

  const check: Record<number, () => Errors> = {
    1: () => ({ ...(!v.tour && { tour: "Please choose a tour." }), ...(!v.start ? { start: "Please pick a departure date." } : v.start < minDate ? { start: "Departures must be at least 14 days from today." } : {}),
      ...(!(+v.people >= 1 && +v.people <= 8) && { people: "Between 1 and 8 travellers per booking." }) }),
    2: () => ({ ...(v.name.trim().split(/\s+/).length < 2 && { name: "Please enter your first and last name." }), ...(!EMAIL.test(v.email) && { email: "Please enter a valid email." }),
      ...(!/^\+?[\d\s-]{8,}$/.test(v.phone) && { phone: "Please enter a mobile number with country code." }), ...(!v.country && { country: "Please choose a country." }) }),
  };
  const next = () => { const e = check[step](); setErr(e); if (!Object.keys(e).length) setStep(step + 1); };
  const confirm = (e: FormEvent) => { e.preventDefault(); if (!v.terms) return setErr({ terms: "Please accept the booking terms." }); setDone(ref("NW")); };
  const E = ({ k }: { k: string }) => <span className="err">{err[k] ?? ""}</span>;

  if (done) return <div className="ok" role="status"><h2>Booking confirmed 🎉</h2><p>Reference <b>{done}</b>. A confirmation has been sent to <b>{v.email}</b>. Your 20% deposit of <b>{price(total * 0.2)}</b> secures your place.</p></div>;
  return (
    <>
      <div className="steps" aria-hidden="true">{["1. Trip", "2. Lead traveller", "3. Review & pay"].map((s, i) => <span key={s} className={i < step ? "on" : ""}>{s}</span>)}</div>
      <form className="panel" noValidate onSubmit={confirm}>
        {step === 1 && <>
          <div className="field"><label htmlFor="tour">Tour</label><select id="tour" value={v.tour} onChange={set("tour")}><option value="">Choose a tour…</option>
            {tours?.filter((t) => t.status === "available").map((t) => <option key={t.slug} value={t.slug}>{t.title} ({t.days} days)</option>)}</select><E k="tour" /></div>
          <div className="field"><label htmlFor="start">Departure date</label><input id="start" type="date" min={minDate} value={v.start} onChange={set("start")} /><E k="start" /></div>
          <div className="field"><label htmlFor="people">Travellers</label><input id="people" type="number" min={1} max={8} value={v.people} onChange={set("people")} /><E k="people" /></div>
          <button className="btn alt" type="button" onClick={next}>Continue</button>
        </>}
        {step === 2 && <>
          <div className="field"><label htmlFor="name">Full name (as on passport)</label><input id="name" autoComplete="name" value={v.name} onChange={set("name")} /><E k="name" /></div>
          <div className="field"><label htmlFor="email">Email</label><input id="email" type="email" autoComplete="email" value={v.email} onChange={set("email")} /><E k="email" /></div>
          <div className="field"><label htmlFor="phone">Mobile number</label><input id="phone" type="tel" autoComplete="tel" value={v.phone} onChange={set("phone")} /><E k="phone" /></div>
          <div className="field"><label htmlFor="country">Passport country</label><select id="country" value={v.country} onChange={set("country")}><option value="">Choose…</option>
            {["United Kingdom", "United States", "Canada", "Australia", "India", "Germany", "Other"].map((c) => <option key={c}>{c}</option>)}</select><E k="country" /></div>
          <button className="btn ghost" type="button" onClick={() => setStep(1)}>Back</button> <button className="btn alt" type="button" onClick={next}>Review booking</button>
        </>}
        {step === 3 && tour && <>
          <dl className="summary">
            <dt>Tour</dt><dd>{tour.title}</dd><dt>Departure</dt><dd>{new Date(v.start).toDateString()}</dd><dt>Travellers</dt><dd>{v.people}</dd>
            <dt>Lead traveller</dt><dd>{v.name} · {v.email}</dd><dt>Total</dt><dd>{price(total)}</dd><dt>Deposit due today (20%)</dt><dd>{price(total * 0.2)}</dd>
          </dl>
          <div className="field"><label style={{ fontWeight: 400 }}><input type="checkbox" checked={v.terms} onChange={(e) => setV({ ...v, terms: e.target.checked })} /> I accept the <Link href="/legal/terms/">booking terms</Link></label><E k="terms" /></div>
          <button className="btn ghost" type="button" onClick={() => setStep(2)}>Back</button> <button className="btn" type="submit">Confirm &amp; pay deposit</button>
        </>}
      </form>
    </>
  );
}

export function LoginForm() {
  const [user, setUser] = useState(false);
  const [msg, setMsg] = useState("");
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget), email = String(d.get("email")).trim().toLowerCase(), pw = String(d.get("password"));
    if (!email || !pw) return setMsg("Enter your email and password.");
    if (email !== "demo@northwindtravel.co" || pw !== "travel2026") return setMsg("Incorrect email or password.");
    setMsg(""); setUser(true);
  };
  if (user) return <div className="ok"><h2>Welcome back, Demo Traveller</h2><p>Upcoming trip: <b>Kyoto Temples &amp; Tea</b>, 12 April 2027 · 2 travellers · deposit paid.</p><button className="btn" onClick={() => setUser(false)}>Sign out</button></div>;
  return (
    <form className="panel" noValidate onSubmit={submit}>
      <div className="field"><label htmlFor="le">Email</label><input id="le" name="email" type="email" autoComplete="username" /></div>
      <div className="field"><label htmlFor="lp">Password</label><input id="lp" name="password" type="password" autoComplete="current-password" /></div>
      <p className="err" role="alert">{msg}</p>
      <button className="btn alt" type="submit">Sign in</button>
      <p className="meta">Demo account: demo@northwindtravel.co / travel2026 · <Link href="/contact/">Forgot password?</Link></p>
    </form>
  );
}

export function ContactForm() {
  const [err, setErr] = useState<Errors>({});
  const [sent, setSent] = useState<{ ticket: string; email: string } | null>(null);
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const x: Errors = { ...(!d.name?.trim() && { name: "Please tell us your name." }), ...(!EMAIL.test(d.email ?? "") && { email: "Please enter a valid email." }),
      ...(!d.topic && { topic: "Please choose a topic." }), ...((d.message ?? "").trim().length < 20 && { message: "Please write at least 20 characters." }) };
    setErr(x); if (!Object.keys(x).length) setSent({ ticket: "#" + (10000 + Math.floor(Math.random() * 89999)), email: d.email });
  };
  if (sent) return <div className="ok" role="status"><h2>Message sent ✓</h2><p>Thanks! Ticket <b>{sent.ticket}</b> — we&apos;ll reply to <b>{sent.email}</b> within 24 hours.</p></div>;
  return (
    <form className="panel" noValidate onSubmit={submit}>
      <div className="field"><label htmlFor="cn">Your name</label><input id="cn" name="name" autoComplete="name" /><span className="err">{err.name}</span></div>
      <div className="field"><label htmlFor="ce">Email</label><input id="ce" name="email" type="email" autoComplete="email" /><span className="err">{err.email}</span></div>
      <div className="field"><label htmlFor="cs">Topic</label><select id="cs" name="topic" defaultValue=""><option value="">Choose…</option><option>A new booking</option><option>An existing booking</option><option>Group or private tours</option><option>Something else</option></select><span className="err">{err.topic}</span></div>
      <div className="field"><label htmlFor="cm">Message</label><textarea id="cm" name="message" rows={5} /><span className="err">{err.message}</span></div>
      <button className="btn alt" type="submit">Send message</button>
    </form>
  );
}

export function Faq() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="accordion">
      {FAQ.map(([q, a], i) => (
        <div key={q}>
          <button aria-expanded={open === i} aria-controls={`a${i}`} onClick={() => setOpen(open === i ? null : i)}>{q}</button>
          {open === i && <div className="answer" id={`a${i}`}><p>{a}</p></div>}
        </div>
      ))}
    </div>
  );
}

export function EnquireButton({ tour }: { tour: string }) {
  const { toast } = useApp();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!EMAIL.test(String(new FormData(e.currentTarget).get("email")))) return setErr("Please enter a valid email.");
    setOpen(false); toast(`Enquiry sent about ${tour}. We'll reply within 24 hours.`);
  };
  return (
    <>
      <button className="btn ghost" onClick={() => setOpen(true)}>Ask a question</button>
      {open && (
        <div className="modal-bg" onClick={() => setOpen(false)}>
          <div className="modal panel" role="dialog" aria-modal="true" aria-label={`Ask about ${tour}`} onClick={(e) => e.stopPropagation()}>
            <h3>Ask about {tour}</h3>
            <form noValidate onSubmit={submit}>
              <div className="field"><label htmlFor="qe">Your email</label><input id="qe" name="email" type="email" /></div>
              <div className="field"><label htmlFor="qm">Question</label><textarea id="qm" name="q" rows={3} /></div>
              <p className="err">{err}</p>
              <button className="btn alt" type="submit">Send question</button> <button className="btn ghost" type="button" onClick={() => setOpen(false)}>Close</button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
