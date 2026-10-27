import Link from "next/link";
import { POSTS, TOURS } from "@/components/data";
import { Price } from "@/components/providers";
import { SearchForm } from "@/components/widgets";

export default function Home() {
  return (
    <>
      <section className="hero"><div className="wrap">
        <h1>Travel further, in smaller groups</h1>
        <p>Hand-crafted adventures in Japan, Peru and Iceland. Never more than 14 travellers, always with local guides.</p>
        <SearchForm />
      </div></section>
      <section><div className="wrap"><h2>Featured tours</h2><p className="lead">Departures every month from March to November.</p>
        <div className="cards">{TOURS.map((t) => (
          <article className="card" key={t.slug}><div className="art">{t.emoji}</div><div className="body"><span className="badge">{t.region}</span><h3>{t.title}</h3>
            <p className="meta">{t.days} days · max {t.group} travellers</p><p>From <Price usd={t.usd} /> per person</p>
            <Link className="btn alt" href={`/tours/${t.slug}/`}>View tour</Link></div></article>
        ))}</div></div></section>
      <section style={{ background: "var(--sand)" }}><div className="wrap"><h2>Why travel with Northwind?</h2>
        <div className="cards"><div className="panel"><h3>🧭 Local experts</h3><p>Every trip is led by guides who live there.</p></div>
          <div className="panel"><h3>🌱 Carbon-balanced</h3><p>We offset 150% of the emissions from every tour.</p></div>
          <div className="panel"><h3>🛡️ Fully protected</h3><p>ATOL licence 11847: your money is safe.</p></div></div></div></section>
      <section><div className="wrap"><h2>From the journal</h2><p className="lead">Tips from our guides. <Link href="/blog/">Read all stories</Link></p>
        <ul>{POSTS.map((p) => <li key={p.slug}><Link href={`/blog/${p.slug}/`}>{p.title}</Link></li>)}</ul></div></section>
    </>
  );
}
