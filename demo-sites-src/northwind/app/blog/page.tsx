import Link from "next/link";
import { Crumbs } from "@/components/chrome";
import { POSTS } from "@/components/data";

export const metadata = { title: "Journal", description: "Travel stories and tips from Northwind guides." };

export default function Journal() {
  return (
    <>
      <Crumbs items={[["/", "Home"], [null, "Journal"]]} />
      <section><div className="wrap"><h1>Journal</h1><p className="lead">Page 1 of 2</p>
        <div className="cards">{POSTS.map((p) => (
          <article className="card" key={p.slug}><div className="body"><p className="meta">{p.date}</p><h2 style={{ fontSize: "1.3rem" }}>{p.title}</h2><p>{p.lead}</p>
            <Link href={`/blog/${p.slug}/`}>Read more</Link></div></article>
        ))}</div>
        <nav className="pager" aria-label="Pages"><span className="btn alt" aria-current="page">1</span><Link className="btn" href="/blog/page/2/">2</Link><Link href="/blog/page/2/" style={{ alignSelf: "center" }}>Older posts →</Link></nav>
      </div></section>
    </>
  );
}
