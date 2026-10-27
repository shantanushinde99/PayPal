"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useApp, type Currency } from "./providers";

const NAV = [["/", "Home"], ["/tours/", "Tours"], ["/blog/", "Journal"], ["/help/faq/", "Help"], ["/contact/", "Contact"]] as const;
const DEST = [["/destinations/", "All destinations"], ["/destinations/japan/", "Japan"], ["/destinations/peru/", "Peru"], ["/destinations/iceland/", "Iceland"]] as const;

export function Header() {
  const path = usePathname();
  const { currency, setCurrency } = useApp();
  const [menu, setMenu] = useState(false);
  const [drop, setDrop] = useState(false);
  useEffect(() => { setMenu(false); setDrop(false); }, [path]); // close menus after client-side navigation
  useEffect(() => { const close = () => setDrop(false); document.addEventListener("click", close); return () => document.removeEventListener("click", close); }, []);
  const cur = (href: string) => (path === href || path + "/" === href ? "page" : undefined);
  return (
    <header id="site-header"><div className="wrap">
      <Link className="brand" href="/">North<b>wind</b> Travel</Link>
      <button className="burger" aria-expanded={menu} aria-controls="main-nav" onClick={() => setMenu(!menu)}>Menu</button>
      <nav id="main-nav" aria-label="Main" className={menu ? "open" : ""}>
        <Link href="/" aria-current={cur("/")}>Home</Link>
        <div className={`drop${drop ? " open" : ""}`}>
          <button aria-expanded={drop} onClick={(e) => { e.stopPropagation(); setDrop(!drop); }}>Destinations ▾</button>
          <div className="drop-menu">{DEST.map(([h, t]) => <Link key={h} href={h} aria-current={cur(h)}>{t}</Link>)}</div>
        </div>
        {NAV.slice(1).map(([h, t]) => <Link key={h} href={h} aria-current={cur(h)}>{t}</Link>)}
      </nav>
      <div className="tools">
        <select aria-label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}><option>USD</option><option>EUR</option><option>GBP</option></select>
        <Link href="/account/login/">Sign in</Link>
      </div>
    </div></header>
  );
}

export function Footer() {
  const { toast } = useApp();
  const [done, setDone] = useState(false);
  const subscribe = (e: FormEvent) => { e.preventDefault(); setDone(true); toast("Thanks, you're subscribed!"); };
  return (
    <footer id="site-footer"><div className="wrap cols">
      <div><h4>Northwind Travel</h4><p>Small-group adventures since 2012.<br />21 Harbour Row, Bristol BS1 4QD, United Kingdom</p><p>ATOL protected · Licence no. 11847</p></div>
      <div><h4>Explore</h4><ul><li><Link href="/tours/">All tours</Link></li><li><Link href="/destinations/">Destinations</Link></li><li><Link href="/booking/">Book a trip</Link></li><li><Link href="/blog/">Journal</Link></li></ul></div>
      <div><h4>Company</h4><ul><li><Link href="/contact/">Contact</Link></li><li><Link href="/help/faq/">FAQ</Link></li><li><Link href="/legal/privacy/">Privacy</Link></li><li><Link href="/legal/terms/">Terms</Link></li></ul></div>
      <div><h4>Newsletter</h4>
        {done ? <p>Thanks, you&apos;re subscribed!</p> : (
          <form onSubmit={subscribe}><label htmlFor="nl">Monthly travel ideas, no spam.</label>
            <input id="nl" name="email" type="email" placeholder="you@example.com" required /><button className="btn alt" type="submit">Subscribe</button></form>
        )}
        <p>📞 <a href="tel:+442079460958">+44 20 7946 0958</a><br />✉️ <a href="mailto:hello@northwindtravel.co">hello@northwindtravel.co</a></p>
      </div>
    </div></footer>
  );
}

// A real-world obstacle for the checker: a consent bar over the bottom of every page until dismissed.
export function CookieBar() {
  const [show, setShow] = useState(false);
  useEffect(() => { try { setShow(!localStorage.getItem("nw-consent")); } catch { setShow(true); } }, []);
  const close = (v: string) => { try { localStorage.setItem("nw-consent", v); } catch {} setShow(false); };
  if (!show) return null;
  return (
    <div className="cookie" role="dialog" aria-label="Cookie consent">
      <p>We use cookies to remember your currency and improve the site.</p>
      <button className="btn alt" onClick={() => close("all")}>Accept</button>
      <button className="btn ghost" onClick={() => close("essential")}>Essential only</button>
    </div>
  );
}

export function Crumbs({ items }: { items: [string | null, string][] }) {
  return (
    <nav className="crumbs wrap" aria-label="Breadcrumb">
      {items.map(([h, t], i) => <span key={t}>{i > 0 && " › "}{h ? <Link href={h}>{t}</Link> : <span aria-current="page">{t}</span>}</span>)}
    </nav>
  );
}
