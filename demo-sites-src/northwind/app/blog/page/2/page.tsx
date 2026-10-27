import Link from "next/link";
import { Crumbs } from "@/components/chrome";
import { OLDER } from "@/components/data";

export const metadata = { title: "Journal – page 2", description: "Older travel stories from Northwind guides." };

export default function JournalPage2() {
  return (
    <>
      <Crumbs items={[["/", "Home"], ["/blog/", "Journal"], [null, "Page 2"]]} />
      <section><div className="wrap"><h1>Journal</h1><p className="lead">Page 2 of 2 · older stories are being moved to our new site.</p>
        <div className="cards">{OLDER.map(([t, d]) => <article className="card" key={t}><div className="body"><p className="meta">{d}</p><h2 style={{ fontSize: "1.3rem" }}>{t}</h2><p className="meta">Coming back soon.</p></div></article>)}</div>
        <nav className="pager" aria-label="Pages"><Link href="/blog/" style={{ alignSelf: "center" }}>← Newer posts</Link><Link className="btn" href="/blog/">1</Link><span className="btn alt" aria-current="page">2</span></nav>
      </div></section>
    </>
  );
}
